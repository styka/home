# -*- coding: utf-8 -*-
"""Transform raw.tsv (messy spreadsheet export) into app-shaped Task JSON.

Output: scripts/import-lz/zadania-lz.json  (read later by another agent that
writes DB INSERTs for project "LZ" of user tyka.szymon@gmail.com).

Spec: worldofmag/docs/tasks/import-spec-zadania.md
"""
import csv, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw.tsv")
OUT = os.path.join(HERE, "zadania-lz.json")

# Column indices (0-based) in raw.tsv
C_TYPE, C_P, C_CYCL, C_CZAS, C_KONTEKST, C_PRIO, C_PP, C_LEVEL, C_LP, \
    C_MIEJSCE, C_TERMIN = range(11)
# 11..15 = irrelevant (👽 score, who, urgency, n1, n2)
C_ZADANIE, C_OPIS, C_OPIS2 = 16, 17, 18

PRIORITY = {
    "1": "URGENT",   # Blocker
    "2": "HIGH",     # Critical
    "3": "MEDIUM",   # High
    "4": "LOW",      # Normal
    "5": "LOW",      # Low
    "6": "NONE",     # Trivial
}

MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
          "lipca", "sierpnia", "września", "października", "listopada", "grudnia"]

# Polish weekday → JS day number (0=Sun … 6=Sat)
WEEKDAYS = [("poniedział", 1), ("wtorek", 2), ("środ", 3), ("czwart", 4),
            ("piąt", 5), ("sobot", 6), ("niedziel", 0)]
WEEKDAY_SHORT = {"pn": 1, "wt": 2, "śr": 3, "czw": 4, "pt": 5, "sb": 6, "nd": 0}


def get(row, i):
    return row[i].strip() if i < len(row) and row[i] is not None else ""


def est_mins(czas):
    czas = czas.strip()
    if not czas:
        return None
    try:
        h = float(czas.replace(",", "."))
    except ValueError:
        return None          # e.g. garbage "1899-12-31"
    mins = int(round(h * 60))
    return mins or None       # 0 → null


def due_iso(termin):
    termin = termin.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", termin):
        return f"{termin}T00:00:00.000Z"
    return None


def parse_recurring(typ, cykl_raw):
    """Map Polish cadence text → RecurringRule dict, or None when not cyclic /
    not machine-parseable (raw text is preserved in the description either way).
    Day-of-month and specific annual dates are carried by dueDate, NOT dayOfMonth
    (which is dead in our codebase — see import-spec)."""
    if typ != "C":
        return None
    t = cykl_raw.strip().lower()
    if not t:
        return None

    # 1) fixed weekday ("pn", "co pt", "co sobotę", "wt", …)
    tokens = re.split(r"[\s/]+", t)
    for tok in tokens:
        if tok in WEEKDAY_SHORT:
            return {"type": "WEEKLY", "interval": 1, "daysOfWeek": [WEEKDAY_SHORT[tok]]}
    for stem, num in WEEKDAYS:
        if stem in t:
            return {"type": "WEEKLY", "interval": 1, "daysOfWeek": [num]}

    # 2) daily
    if "codzien" in t or "co dzień" in t:
        return {"type": "DAILY", "interval": 1}
    m = re.search(r"co\s+(\d+)\s+dni", t)
    if m:
        return {"type": "DAILY", "interval": int(m.group(1))}

    # 3) weekly ("co tydzień", "co N tygodni(e)", "co wyjazd / co tydzień")
    if "co tydzień" in t or "co tydzien" in t:
        return {"type": "WEEKLY", "interval": 1}
    m = re.search(r"co\s+(\d+)\s+tygodn", t)
    if m:
        return {"type": "WEEKLY", "interval": int(m.group(1))}

    # 4) half-year vs ambiguous "co rok pół roku"
    if "pół roku" in t:
        return None if "rok" in t.replace("pół roku", "") else {"type": "MONTHLY", "interval": 6}

    # 5) "co 1,5 roku" → 18 months
    if re.search(r"1[.,]5\s*rok", t):
        return {"type": "MONTHLY", "interval": 18}

    # 6) years
    m = re.search(r"co\s+(\d+)\s+lat", t)
    if m:
        return {"type": "YEARLY", "interval": int(m.group(1))}
    if "co rok" in t or "co roku" in t:
        return {"type": "YEARLY", "interval": 1}

    # 7) months (explicit interval, "miesiąc/miesiące/miiesiące"); odd-month ≈ every 2
    m = re.search(r"co\s+(\d+)\s+mi+esi", t)
    if m:
        return {"type": "MONTHLY", "interval": int(m.group(1))}
    if "miesiąc" in t or "miesięc" in t or "miesiace" in t:
        interval = 2 if "nieparzyst" in t else 1
        return {"type": "MONTHLY", "interval": interval}

    # 8) "N dnia miesiąca" / "do N dnia (nieparzystego) miesiąca" (no "co X")
    if "dnia" in t and "miesi" in t:
        return {"type": "MONTHLY", "interval": 2 if "nieparzyst" in t else 1}

    # 9) annual specific date by month name ("1 lipca", "co 5 maja", "1 kwietnia")
    if any(mon in t for mon in MONTHS):
        return {"type": "YEARLY", "interval": 1}

    # 10) unknown / event-based ("co ile trzeba", "co wyjazd", "co ile? Maj")
    return None


def build(idx, row):
    typ = get(row, C_TYPE)
    cykl = get(row, C_CYCL)
    kontekst = get(row, C_KONTEKST)
    miejsce = get(row, C_MIEJSCE)
    level = get(row, C_LEVEL)
    postponed = get(row, C_P)

    zadanie = row[C_ZADANIE] if C_ZADANIE < len(row) else ""
    lines = [l.rstrip() for l in zadanie.split("\n")]
    title = lines[0].strip()
    body_rest = "\n".join(lines[1:]).strip()

    desc_parts = []
    if body_rest:
        desc_parts.append(body_rest)
    for ci in (C_OPIS, C_OPIS2):
        val = get(row, ci)
        if val:
            desc_parts.append(val)

    # Meta footer for spreadsheet info without a first-class Task field.
    meta = []
    meta.append("Typ: cykliczne" if typ == "C" else "Typ: jednorazowe")
    if level:
        meta.append(f"Poziom trudności: {level}")
    if postponed:
        meta.append(f"Przełożone: {postponed}×")
    if typ == "C" and cykl:
        meta.append(f"Cykliczność (oryg.): {cykl}")
    desc_parts.append("— Meta (z arkusza) —\n" + "\n".join(meta))
    description = "\n\n".join(desc_parts) if desc_parts else None

    # tags ← Kontekst + Miejsce (deduped, skip placeholder)
    tags = []
    for v in (kontekst, miejsce):
        v = v.strip()
        if v and v != "-----" and v not in tags:
            tags.append(v)

    return {
        "title": title,
        "description": description,
        "status": "TODO",
        "priority": PRIORITY.get(get(row, C_PRIO)[:1], "NONE"),
        "dueDate": due_iso(get(row, C_TERMIN)),
        "startDate": None,
        "completedAt": None,
        "estimatedMins": est_mins(get(row, C_CZAS)),
        "recurring": parse_recurring(typ, cykl),
        "category": "Other",
        "tags": tags,
        "order": idx,
    }


def main():
    with open(RAW, encoding="utf-8") as f:
        rows = list(csv.reader(f, delimiter="\t", quotechar='"'))
    data_rows = rows[1:]  # skip header
    tasks = [build(i, r) for i, r in enumerate(data_rows)]

    unparsed = [t["title"] for t, r in zip(tasks, data_rows)
                if get(r, C_TYPE) == "C" and t["recurring"] is None]

    payload = {
        "_meta": {
            "source": "Arkusz kalkulacyjny (TSV), import 2026-06-02",
            "targetUserEmail": "tyka.szymon@gmail.com",
            "targetProject": "LZ",
            "spec": "worldofmag/docs/tasks/import-spec-zadania.md",
            "taskCount": len(tasks),
            "conventions": {
                "status": "wszystkie 'TODO'",
                "priority": "1.Blocker→URGENT, 2.Critical→HIGH, 3.High→MEDIUM, 4.Normal→LOW, 5.Low→LOW, 6.Trivial→NONE",
                "tags": "Kontekst + Miejsce jako tagi (TaskTagDef/TaskTaskTag); 'category' zostaje 'Other'",
                "estimatedMins": "Czas(h) × 60, int; niedające się sparsować → null",
                "dueDate": "Termin → ISO 8601 UTC; dzień miesiąca/data roczna kodowane w dueDate (nie w dayOfMonth)",
                "recurring": "obiekt RecurringRule (przed INSERT-em do DB serializować JSON.stringify do kolumny Task.recurring jako string); null = jednorazowe lub cadencja niejednoznaczna (oryginał w opisie)",
                "description": "Zadanie (po 1. linii) + Opis + Opis 2 + stopka 'Meta' (Poziom trudności, Przełożone, oryg. Cykliczność)",
            },
            "recurringNullButCyclic": unparsed,
        },
        "tasks": tasks,
    }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    rec = sum(1 for t in tasks if t["recurring"])
    print(f"tasks: {len(tasks)}")
    print(f"recurring parsed: {rec} | cyclic-but-null: {len(unparsed)}")
    import collections
    print("priorities:", dict(collections.Counter(t["priority"] for t in tasks)))
    print("cyclic-but-null titles:", unparsed)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
