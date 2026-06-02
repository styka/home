# -*- coding: utf-8 -*-
"""Emit a Prisma migration that seeds the LZ task list for tyka.szymon@gmail.com
from scripts/import-lz/zadania-lz.json.

Behaviour (idempotent / replay-safe):
  * find user by email; if missing → NOTICE + skip (no error).
  * find project "LZ" owned by that user; create it only if absent.
  * seed the 149 tasks ONLY if that LZ project currently has no tasks
    (so re-running, or an already-populated LZ, won't duplicate).
  * all tasks: status 'TODO', createdById = user, projectId = LZ.
  * tags (Kontekst + Miejsce) → TaskTagDef (global, unique name) + TaskTaskTag.
  * recurring object → JSON string in Task.recurring.

Run:  python3 scripts/import-lz/gen_migration.py
Out:  prisma/migrations/0068_import_lz_tasks/migration.sql
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "zadania-lz.json")
OUT_DIR = os.path.join(HERE, "..", "..", "prisma", "migrations", "0068_import_lz_tasks")
EMAIL = "tyka.szymon@gmail.com"
OUTER = "$LZ_IMPORT$"   # outer DO block dollar tag (data has no '$...$' sequences)


def dq(s: str) -> str:
    """Dollar-quoted string literal with a tag guaranteed absent from s."""
    i = 0
    while True:
        tag = "$v$" if i == 0 else f"$v{i}$"
        if tag not in s and tag != OUTER:
            return f"{tag}{s}{tag}"
        i += 1


def sql_str(s: str) -> str:
    """Single-quoted literal (for short, safe values like tag names)."""
    return "'" + s.replace("'", "''") + "'"


def task_block(idx: int, t: dict) -> str:
    title = dq(t["title"])
    desc = dq(t["description"]) if t["description"] is not None else "NULL"
    prio = sql_str(t["priority"])
    due = f"TIMESTAMPTZ '{t['dueDate']}'" if t["dueDate"] else "NULL"
    est = str(t["estimatedMins"]) if t["estimatedMins"] is not None else "NULL"
    rec = dq(json.dumps(t["recurring"], ensure_ascii=False)) if t["recurring"] is not None else "NULL"
    cat = sql_str(t["category"])
    order = int(t["order"])

    lines = [
        f"  -- [{idx}] {t['title'][:70].replace(chr(10), ' ')}",
        "  v_task_id := gen_random_uuid()::text;",
        '  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", "startDate", "completedAt", "estimatedMins", recurring, category, "order", "projectId", "parentTaskId", "createdById", "assigneeId", "createdAt", "updatedAt")',
        f"  VALUES (v_task_id, {title}, {desc}, 'TODO', {prio}, {due}, NULL, NULL, {est}, {rec}, {cat}, {order}, v_project_id, NULL, v_user_id, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    ]
    if t["tags"]:
        arr = ", ".join(sql_str(tag) for tag in t["tags"])
        lines.append(
            f'  INSERT INTO "TaskTaskTag" ("taskId", "tagId") SELECT v_task_id, id FROM "TaskTagDef" WHERE name = ANY(ARRAY[{arr}]);'
        )
    return "\n".join(lines)


def main():
    data = json.load(open(SRC, encoding="utf-8"))
    tasks = data["tasks"]
    all_tags = sorted({tag for t in tasks for tag in t["tags"]})
    tags_array = ", ".join(sql_str(tg) for tg in all_tags)

    body = "\n\n".join(task_block(i, t) for i, t in enumerate(tasks))

    sql = f"""-- Import listy zadań „LZ" dla użytkownika {EMAIL}.
-- {len(tasks)} zadań z arkusza (scripts/import-lz/zadania-lz.json), wszystkie w
-- statusie 'TODO' (nowe, niezaczęte; zaległe/teraźniejsze/przyszłe + cykliczne).
-- Idempotentne: tworzy projekt LZ tylko gdy go nie ma; seeduje zadania tylko
-- gdy LZ jest pusty. PostgreSQL-only (gen_random_uuid).

DO {OUTER}
DECLARE
  v_user_id    text;
  v_project_id text;
  v_count      int;
  v_task_id    text;
BEGIN
  SELECT id INTO v_user_id FROM "User" WHERE email = {sql_str(EMAIL)};
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Import LZ: brak użytkownika {EMAIL} — pomijam.';
    RETURN;
  END IF;

  -- Projekt LZ właściciela; utwórz tylko jeśli nie istnieje.
  SELECT id INTO v_project_id FROM "TaskProject"
    WHERE name = 'LZ' AND "ownerId" = v_user_id
    ORDER BY "createdAt" LIMIT 1;
  IF v_project_id IS NULL THEN
    v_project_id := gen_random_uuid()::text;
    INSERT INTO "TaskProject" (id, name, description, color, emoji, "isInbox", "ownerId", "ownerTeamId", "statusConfig", "createdAt", "updatedAt")
    VALUES (v_project_id, 'LZ', 'Lista zadań — import z arkusza', '#6b7280', '📋', false, v_user_id, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  -- Replay-safety: seeduj tylko gdy LZ nie ma jeszcze zadań.
  SELECT count(*) INTO v_count FROM "Task" WHERE "projectId" = v_project_id;
  IF v_count > 0 THEN
    RAISE NOTICE 'Import LZ: projekt LZ ma już % zadań — pomijam seed.', v_count;
    RETURN;
  END IF;

  -- Definicje tagów (globalne, unikalne po nazwie).
  INSERT INTO "TaskTagDef" (id, name, color)
  SELECT gen_random_uuid()::text, x, '#6b7280'
  FROM unnest(ARRAY[{tags_array}]) AS x
  ON CONFLICT (name) DO NOTHING;

  -- ===== ZADANIA ({len(tasks)}) =====
{body}

  RAISE NOTICE 'Import LZ: wstawiono {len(tasks)} zadań do projektu LZ (%).', v_project_id;
END
{OUTER};
"""

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, "migration.sql")
    with open(out, "w", encoding="utf-8") as f:
        f.write(sql)
    print(f"tasks: {len(tasks)} | tags: {all_tags}")
    print(f"wrote {os.path.relpath(out)} ({len(sql)} bytes)")


if __name__ == "__main__":
    main()
