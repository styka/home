#!/usr/bin/env node
/**
 * Bramka POKRYCIA akcji użytkownika przez asystenta AI.
 *
 * Problem, który rozwiązuje: możliwości asystenta (katalog w prompt'cie + egzekutory)
 * są utrzymywane RĘCZNIE i osobno od Server Actions (`src/actions/*`), którymi
 * użytkownik dysponuje ręcznie w UI. `check-action-coverage.js` pilnuje tylko
 * spójności katalog↔egzekutor. NIC nie pilnowało, czy KAŻDA akcja użytkownika jest
 * w ogóle wystawiona dla AI — dlatego np. „otaguj zadanie" (updateTaskTags) długo
 * nie istniało po stronie asystenta.
 *
 * Ten skrypt wymusza świadomą decyzję dla KAŻDEJ akcji użytkownika — zarówno
 * MUTUJĄCEJ (zapis), jak i ODCZYTU (get.../list.../search..., czyli to, co użytkownik
 * PRZEGLĄDA w aplikacji). Statusy:
 *   - "ai"       → wystawiona dla asystenta (egzekutor+katalog dla mutacji; read-tool dla odczytu),
 *   - "pending"  → powinna być wystawiona, ale jeszcze nie jest (lista luk / roadmapa),
 *   - "excluded" → świadomie NIE dla AI (z powodem: admin/settings/internal/…).
 * Wpisy odczytu mają w manifeście `"kind":"read"`; mutacje nie mają `kind`.
 *
 * Źródło prawdy klasyfikacji: `src/lib/ai/action-coverage.json`.
 * Gdy ktoś doda NOWĄ mutującą Server Action i jej NIE sklasyfikuje — build PADA,
 * więc nowa możliwość użytkownika nie „prześlizgnie się" bez rozważenia dla AI.
 *
 * Skrypt jest czysto statyczny (czyta pliki źródłowe) — nie dotyka bazy ani sieci.
 * Flaga `--report` dopisuje/aktualizuje czytelny raport luk w docs/ai/pokrycie-akcji.md.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const actionsDir = path.join(root, "src/actions");
const manifestPath = path.join(root, "src/lib/ai/action-coverage.json");

// Odczyt użytkownika = get*/list*/search* (to, co przegląda w aplikacji).
const READ = /^(get|list|search)/;
// Prefiksy/nazwy wewnętrzne — nie są akcją użytkownika (ani zapisem, ani odczytem do wystawienia).
const INTERNAL = /^(assert|ensure|find|preview|describe|has|is|count|resolve|read)/;
const SKIP_EXTRA = new Set([
  "healthAiAllowed", "evaluateWatchers", "getOrCreateInbox", "getUserScope", "getUserTeamIds",
]);
const VALID = new Set(["ai", "pending", "excluded"]);

// Zbierz kandydatów (mutacje + odczyty) jako klucze `plik:funkcja`, z rozróżnieniem rodzaju.
function collectCandidates() {
  const out = [];
  for (const f of fs.readdirSync(actionsDir)) {
    if (!f.endsWith(".ts")) continue;
    const mod = f.replace(/\.ts$/, "");
    const src = fs.readFileSync(path.join(actionsDir, f), "utf8");
    // 031: zapamiętujemy też CIAŁO funkcji — bramka kontroli dostępu sprawdza w nim wywołanie guardu.
    const found = [...src.matchAll(/export async function ([a-zA-Z0-9_]+)/g)];
    found.forEach((m, i) => {
      const fn = m[1];
      const body = src.slice(m.index, i + 1 < found.length ? found[i + 1].index : src.length);
      if (SKIP_EXTRA.has(fn)) return;
      if (READ.test(fn)) { out.push({ key: `${mod}:${fn}`, kind: "read", body }); return; }
      if (INTERNAL.test(fn)) return; // pomocnik wewnętrzny — pomiń
      out.push({ key: `${mod}:${fn}`, kind: "mutation", body });
    });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const candidates = collectCandidates();
const candidateSet = new Set(candidates.map((c) => c.key));

// 1) Każdy kandydat MUSI mieć wpis o poprawnym statusie.
const unclassified = [];
const badStatus = [];
for (const { key } of candidates) {
  const entry = manifest[key];
  if (!entry) { unclassified.push(key); continue; }
  if (!VALID.has(entry.status)) badStatus.push(`${key} (status="${entry.status}")`);
}

// 2) Wpisy w manifeście, które nie odpowiadają już żadnej akcji (przestarzałe) — ostrzeżenie.
const stale = Object.keys(manifest).filter((k) => !k.startsWith("__") && !candidateSet.has(k)).sort();

// Liczniki per rodzaj (mutacja/odczyt).
const counts = {
  mutation: { ai: 0, pending: 0, excluded: 0 },
  read: { ai: 0, pending: 0, excluded: 0 },
};
for (const { key, kind } of candidates) {
  const s = manifest[key]?.status;
  if (counts[kind]?.[s] !== undefined) counts[kind][s]++;
}

// --report: zapisz czytelny raport luk (roadmapa integracji z AI).
if (process.argv.includes("--report")) {
  const byModule = {};
  for (const { key, kind } of candidates) {
    const [mod, fn] = key.split(":");
    const e = manifest[key] ?? {};
    (byModule[mod] ??= []).push({ fn, kind, st: e.status ?? "?", reason: e.reason, action: e.action });
  }
  const tag = (st) => (st === "ai" ? "✅ ai" : st === "pending" ? "🕓 pending" : "⛔ excluded");
  let md = `# Pokrycie akcji użytkownika przez asystenta AI\n\n`;
  md += `> Plik generowany przez \`scripts/check-ai-coverage.js --report\`. Nie edytuj ręcznie.\n\n`;
  md += `Mutacje (zapis): **${counts.mutation.ai} ai / ${counts.mutation.pending} pending / ${counts.mutation.excluded} excluded**. `;
  md += `Odczyty (podgląd danych): **${counts.read.ai} ai / ${counts.read.pending} pending / ${counts.read.excluded} excluded**.\n\n`;
  md += `Legenda: \`ai\` = asystent to potrafi · \`pending\` = luka do domknięcia · \`excluded\` = nie dla AI (admin/ustawienia/wewnętrzne/interaktywne).\n\n`;
  for (const mod of Object.keys(byModule).sort()) {
    const rows = byModule[mod];
    const ai = rows.filter((r) => r.st === "ai").length;
    md += `## ${mod} — ${ai}/${rows.length} wystawionych\n\n`;
    md += `| Akcja | Rodzaj | Status | Uwaga |\n|---|---|---|---|\n`;
    for (const r of rows.sort((a, b) => a.fn.localeCompare(b.fn))) {
      const kind = r.kind === "read" ? "odczyt" : "zapis";
      md += `| \`${r.fn}\` | ${kind} | ${tag(r.st)} | ${r.action ? "→ " + r.action : r.reason ?? ""} |\n`;
    }
    md += `\n`;
  }
  const outDir = path.join(root, "docs/ai");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "pokrycie-akcji.md"), md);
  console.log("✓ Zapisano raport: docs/ai/pokrycie-akcji.md");
}

// ── 031: BRAMKA KONTROLI DOSTĘPU ─────────────────────────────────────────────
// Dwa warunki, oba obowiązkowe:
//  1) DEKLARACJA — każdy wpis w manifeście musi mieć `access` z zamkniętej listy. To wymusza
//     świadomą decyzję „kto ma prawo do tych danych" przy KAŻDEJ nowej akcji.
//  2) KOD — w ciele akcji musi znaleźć się wywołanie guardu (sesja / uprawnienie / dostęp do
//     rekordu) albo delegacja do innej akcji, która guard woła. Sama deklaracja nie dowodzi
//     niczego, więc bez tego drugiego warunku bramka dawałaby fałszywe poczucie bezpieczeństwa.
// Odstępstwo jest możliwe TYLKO jawnie: access "open" + `accessReason` (np. skrzynka zgłoszeń).
const VALID_ACCESS = new Set([
  "owner", // dane właściciela / udostępnione (guard modułu, model ownerId/ownerTeamId)
  "self", // dane wyłącznie zalogowanego użytkownika (ustawienia, preferencje, konto)
  "shared", // wspólny słownik systemowy (kategorie, jednostki, tagi) — wymaga zalogowania
  "admin", // wymaga uprawnienia module.admin
  "internal", // wołane wyłącznie serwerowo (nie z UI), bez danych użytkownika
  "open", // świadome odstępstwo — WYMAGA "accessReason"
]);

// Nazwy guardów obecnych w repo (whitelist). Delegacja do innej akcji też się liczy — dlatego
// dopuszczamy wywołanie funkcji z rodziny `assert*`/`require*` oraz helperów zakresu.
const GUARD_RE =
  /require(?:Auth|Admin|UserId|QaAccess|[A-Z][A-Za-z]*)\s*\(|assert[A-Za-z]*\s*\(|getAccessibleTeamIds\s*\(|getUserTeamIds\s*\(|getUserScope\s*\(|hasPermission\s*\(|auth\s*\(\)|ownershipFilter\s*\(|scopeWhere\s*\(/;

const missingAccess = [];
const badAccess = [];
const openWithoutReason = [];
const noGuard = [];
for (const { key, body } of candidates) {
  const entry = manifest[key];
  if (!entry) continue; // brak wpisu zgłosi sekcja pokrycia AI
  const access = entry.access;
  if (!access) { missingAccess.push(key); continue; }
  if (!VALID_ACCESS.has(access)) { badAccess.push(`${key} (access="${access}")`); continue; }
  if (access === "open" && !entry.accessReason) { openWithoutReason.push(key); continue; }
  // Delegacja/guard w kodzie — wymagany dla wszystkiego poza jawnym odstępstwem.
  // `guardedVia` obsługuje cienkie nakładki (np. `setPetStatus` → `updatePet`): deklarujemy
  // JAWNIE, przez którą akcję idzie sprawdzenie, a bramka weryfikuje, że wywołanie tam jest.
  if (access === "open") continue;
  if (entry.guardedVia) {
    const delegate = new RegExp(`\\b${entry.guardedVia}\\s*\\(`);
    if (!body || !delegate.test(body)) {
      noGuard.push(`${key} (deklaruje guardedVia="${entry.guardedVia}", ale go nie woła)`);
    }
    continue;
  }
  if (body && !GUARD_RE.test(body)) noGuard.push(key);
}

if (process.argv.includes("--report")) {
  const byMod = {};
  for (const { key, kind } of candidates) {
    const [mod, fn] = key.split(":");
    const e = manifest[key] ?? {};
    (byMod[mod] ??= []).push({ fn, kind, access: e.access ?? "?", accessReason: e.accessReason });
  }
  const ACCESS_LABEL = {
    owner: "właściciel / udostępnienie",
    self: "tylko własne konto",
    shared: "wspólny słownik (wymaga zalogowania)",
    admin: "administrator",
    internal: "wyłącznie serwerowo",
    open: "świadome odstępstwo",
  };
  let md = `# Kontrola dostępu do akcji użytkownika\n\n`;
  md += `> Plik generowany przez \`node scripts/check-ai-coverage.js --report\`. Nie edytuj ręcznie.\n\n`;
  md += `Każda akcja odczytu i mutacji w \`src/actions/*\` ma zadeklarowany zakres dostępu, a bramka\n`;
  md += `sprawdza dodatkowo, czy w jej kodzie faktycznie wywoływany jest guard. Nowa akcja bez\n`;
  md += `deklaracji albo bez guardu **przerywa build**.\n\n`;
  md += `Akcji objętych kontrolą: **${candidates.length}**. Pozycji „brak guardu": **${noGuard.length}**.\n\n`;
  md += `## Model własności słowników\n\n`;
  md += `- \`NoteGroup\`, \`Tag\` i \`ItemHistory\` mają właściciela (migracja 0212). Grupy notatek i\n`;
  md += `  etykiety mogą należeć do użytkownika albo do zespołu; podpowiedzi zakupowe są prywatne.\n`;
  md += `- Rekord bez właściciela (\`ownerId\` i \`ownerTeamId\` puste) jest **systemowy**: widzi go każde\n`;
  md += `  zalogowane konto, ale zmienić może go tylko administrator.\n`;
  md += `- Unikalność nazwy etykiety i podpowiedzi zakupowej obowiązuje **w obrębie właściciela**, więc\n`;
  md += `  dwoje użytkowników może mieć wpis o tej samej nazwie.\n\n`;
  for (const mod of Object.keys(byMod).sort()) {
    md += `## ${mod}\n\n| Akcja | Rodzaj | Zakres dostępu | Uwaga |\n|---|---|---|---|\n`;
    for (const r of byMod[mod].sort((a, b) => a.fn.localeCompare(b.fn))) {
      const kind = r.kind === "read" ? "odczyt" : "zapis";
      md += `| \`${r.fn}\` | ${kind} | ${ACCESS_LABEL[r.access] ?? r.access} | ${r.accessReason ?? ""} |\n`;
    }
    md += `\n`;
  }
  const outDir2 = path.join(root, "docs/ai");
  fs.mkdirSync(outDir2, { recursive: true });
  fs.writeFileSync(path.join(outDir2, "kontrola-dostepu.md"), md);
  console.log("✓ Zapisano raport: docs/ai/kontrola-dostepu.md");
}

if (missingAccess.length) {
  console.error("\n✖ Kontrola dostępu: akcje BEZ zadeklarowanego zakresu `access` w src/lib/ai/action-coverage.json:");
  console.error("  " + missingAccess.join("\n  "));
  console.error("\n  Dodaj do wpisu pole \"access\": jedno z: " + [...VALID_ACCESS].join(" | "));
  console.error("  → \"owner\": dane właściciela/udostępnione · \"self\": tylko własne konto · \"shared\": wspólny słownik");
  console.error("  → \"admin\": wymaga module.admin · \"internal\": wołane tylko serwerowo");
  console.error("  → \"open\": świadome odstępstwo — dopisz też \"accessReason\" z uzasadnieniem.\n");
}
if (badAccess.length) {
  console.error("\n✖ Kontrola dostępu: nieprawidłowa wartość `access` (dozwolone: " + [...VALID_ACCESS].join("|") + "):");
  console.error("  " + badAccess.join("\n  "));
}
if (openWithoutReason.length) {
  console.error("\n✖ Kontrola dostępu: access=\"open\" BEZ pola \"accessReason\" (odstępstwo musi być uzasadnione):");
  console.error("  " + openWithoutReason.join("\n  "));
}
if (noGuard.length) {
  console.error("\n✖ Kontrola dostępu: akcje BEZ wywołania guardu w kodzie:");
  console.error("  " + noGuard.join("\n  "));
  console.error("\n  Każda akcja musi sprawdzić uprawnienia — wywołaj `requireAuth()` (sesja),");
  console.error("  guard modułu (`assert…Access`), `requireAdmin()`/`hasPermission()` albo deleguj do akcji,");
  console.error("  która to robi. Jeśli akcja świadomie jest dostępna bez tego — ustaw access=\"open\"");
  console.error("  i opisz powód w \"accessReason\". Dla cienkiej nakładki na inną akcję użyj");
  console.error("  \"guardedVia\": \"<nazwaAkcji>\" — bramka sprawdzi, że faktycznie ją wołasz.\n");
}

if (badStatus.length) {
  console.error("\n✖ Pokrycie AI: wpisy z nieprawidłowym statusem (dozwolone: ai|pending|excluded):");
  console.error("  " + badStatus.join("\n  "));
}
if (unclassified.length) {
  console.error("\n✖ Pokrycie AI: nowe mutujące Server Actions BEZ klasyfikacji w src/lib/ai/action-coverage.json:");
  console.error("  " + unclassified.join("\n  "));
  console.error("\n  Dodaj wpis {\"status\":\"ai|pending|excluded\", ...} dla każdej z nich.");
  console.error("  → \"ai\": wystaw akcję dla asystenta (egzekutor + katalog). \"pending\": luka do zrobienia.");
  console.error("  → \"excluded\": nie dla AI — podaj \"reason\" (admin/settings/internal/interactive/teams/account).\n");
}
if (badStatus.length || unclassified.length || missingAccess.length || badAccess.length || openWithoutReason.length || noGuard.length) process.exit(1);

if (stale.length) {
  console.warn("⚠ Pokrycie AI: przestarzałe wpisy w manifeście (akcja już nie istnieje): " + stale.join(", "));
}

console.log(
  `✓ Kontrola dostępu: ${candidates.length} akcji z zadeklarowanym zakresem i guardem w kodzie.`
);
console.log(
  `✓ Pokrycie AI: ${candidates.length} akcji sklasyfikowanych — ` +
    `MUTACJE ${counts.mutation.ai} ai/${counts.mutation.pending} pending/${counts.mutation.excluded} excluded · ` +
    `ODCZYTY ${counts.read.ai} ai/${counts.read.pending} pending/${counts.read.excluded} excluded.`
);
