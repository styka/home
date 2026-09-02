// 030 (niezawodność asystenta): tolerancyjne parsowanie odpowiedzi protokołu agenta.
//
// Model bywa niesforny: dokleja prozę przed/po JSON, zostawia płotki markdown albo
// trailing commas. Zamiast kończyć turę błędem „LLM zwrócił nieprawidłowy format",
// wyciągamy z treści to, co się da:
//   1. `extractJsonLoose` — próbuje sparsować obiekt protokołu mimo typowych usterek,
//   2. `salvageAnswerText` — ostatnia deska ratunku: wyciąga treść odpowiedzi z surowego
//      tekstu (preferując pole "answer"), żeby użytkownik zawsze dostał sensowną odpowiedź.
// Czyste funkcje (bez I/O) — testowane w __tests__/agentProtocol.test.ts.

/** Zdejmuje płotki markdown (```json … ```) z początku/końca treści. */
function stripFences(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/, "")
    .trim();
}

/** Zwraca pierwszy ZBALANSOWANY blok `{…}` z tekstu (świadomy stringów i escape'ów). */
function firstBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Usuwa trailing commas przed `}`/`]` (poza stringami) — częsta usterka LLM. */
function stripTrailingCommas(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      out += ch;
      continue;
    }
    if (ch === '"') inString = true;
    if (ch === ",") {
      // Zajrzyj do następnego niebiałego znaku — jeśli to } lub ], pomiń przecinek.
      let j = i + 1;
      while (j < json.length && /\s/.test(json[j])) j++;
      if (json[j] === "}" || json[j] === "]") continue;
    }
    out += ch;
  }
  return out;
}

function tryParseObject(text: string): Record<string, unknown> | null {
  try {
    const j = JSON.parse(text);
    return j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Tolerancyjne wydobycie obiektu protokołu z odpowiedzi modelu. Kolejno: surowa treść
 * bez płotków → pierwszy zbalansowany blok `{…}` (model dokleił prozę) → to samo po
 * usunięciu trailing commas. Zwraca `null` zamiast rzucać.
 */
export function extractJsonLoose(content: string): Record<string, unknown> | null {
  const cleaned = stripFences(content);
  const direct = tryParseObject(cleaned);
  if (direct) return direct;
  const block = firstBalancedObject(cleaned);
  if (!block) return null;
  return tryParseObject(block) ?? tryParseObject(stripTrailingCommas(block));
}

const SALVAGE_MAX_CHARS = 4000;
const SALVAGE_FALLBACK = "Przepraszam, nie udało mi się poprawnie sformułować odpowiedzi. Spróbuj ponownie.";

/**
 * Ostatnia deska ratunku, gdy odpowiedź nie parsuje się mimo prób naprawy: wyciąga
 * z treści tekst dla użytkownika. Preferuje wartość pola "answer" (nawet z niedomkniętego
 * JSON-a), inaczej zwraca treść oczyszczoną z płotków i artefaktów JSON. Nigdy nie
 * zwraca pustego stringa.
 */
export function salvageAnswerText(content: string): string {
  const cleaned = stripFences(content);

  // 1) Pole "answer" z poprawnie wyciągalnego fragmentu (extractJsonLoose już zawiódł
  //    na całym obiekcie, ale spróbujmy jeszcze raz — wołający może podać inną treść).
  const parsed = extractJsonLoose(cleaned);
  if (parsed && typeof parsed.answer === "string" && parsed.answer.trim()) {
    return parsed.answer.trim().slice(0, SALVAGE_MAX_CHARS);
  }

  // 2) Wartość "answer" wycięta regexem — działa też przy niedomkniętym JSON-ie
  //    (łapiemy do ostatniego cudzysłowu przed kolejnym polem albo do końca).
  const m = /"answer"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(cleaned);
  if (m && m[1].trim()) {
    let text = m[1];
    try {
      text = JSON.parse(`"${text}"`);
    } catch {
      text = text.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
    if (text.trim()) return text.trim().slice(0, SALVAGE_MAX_CHARS);
  }

  // 3) Surowa treść bez nawiasów JSON-owych artefaktów na brzegach.
  const raw = cleaned.replace(/^[{[\s]+/, "").replace(/[}\]\s]+$/, "").trim();
  return (raw || SALVAGE_FALLBACK).slice(0, SALVAGE_MAX_CHARS);
}

/**
 * 120: ODZYSK KOMPLETNYCH AKCJI Z UCIĘTEGO PLANU.
 *
 * Gdy model buduje plan większy niż budżet wyjścia, odpowiedź wraca urwana w połowie — zwykle
 * w środku którejś akcji. Do 120 lądowała w koszu w całości, choć zawierała kilkanaście gotowych,
 * poprawnych akcji. Zgłoszona sesja: kilkanaście obowiązków psa do przeniesienia, pięć uciętych
 * odpowiedzi, użytkownik bez ani jednej akcji.
 *
 * Wyciągamy z tablicy `"actions"` wyłącznie obiekty ZBALANSOWANE — ten urwany na końcu pomijamy.
 * Świadomość stringów i escape'ów jest tu konieczna z tego samego powodu co w `firstBalancedObject`:
 * nawias klamrowy wewnątrz opisu akcji („zabieg {co 3 miesiące}") nie może przesunąć głębokości.
 *
 * Funkcja jest CZYSTA i celowo NIE waliduje semantyki akcji — odzyskane obiekty przechodzą dalej
 * przez `normalizeActions` i kontrakt akcji, czyli tę samą bramkę co akcje z pełnego planu.
 *
 * `kompletna` mówi, czy tablica akcji zdążyła się **domknąć** (`]`). Rozróżnienie jest potrzebne,
 * bo model bywa ucięty DOPIERO ZA nią (na kolejnym polu) — plan jest wtedy całością, mimo że
 * odpowiedź jest urwana. Bez tego ostrzegalibyśmy o „niepełnym planie" i odsyłali użytkownika po
 * resztę, której nie ma — czyli popełnialibyśmy dokładnie ten błąd, który ten przebieg naprawia.
 */
export function odzyskajAkcjeZUcietego(content: string): {
  akcje: Record<string, unknown>[];
  kompletna: boolean;
} {
  const text = stripFences(content ?? "");
  const klucz = /"actions"\s*:\s*\[/.exec(text);
  if (!klucz) return { akcje: [], kompletna: false };

  const out: Record<string, unknown>[] = [];
  let kompletna = false;
  let i = klucz.index + klucz[0].length;
  while (i < text.length) {
    // Do początku kolejnego obiektu; napotkany `]` kończy tablicę akcji.
    while (i < text.length && text[i] !== "{" && text[i] !== "]") i++;
    if (i >= text.length) break;
    if (text[i] === "]") {
      kompletna = true;
      break;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    let koniec = -1;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          koniec = j;
          break;
        }
      }
    }
    // Obiekt niedomknięty = ten urwany limitem. Nic po nim nie będzie kompletne.
    if (koniec === -1) break;

    const kandydat = tryParseObject(stripTrailingCommas(text.slice(i, koniec + 1)));
    if (kandydat) out.push(kandydat);
    i = koniec + 1;
  }
  return { akcje: out, kompletna };
}
