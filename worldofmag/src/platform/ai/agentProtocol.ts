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
