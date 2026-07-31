// 039: podział tekstu na zdania dla lektora Wiadomości.
//
// Lektor czyta zdanie po zdaniu i podświetla to, które właśnie leci. Podział jest więc widoczny
// wprost: zły przecina wypowiedź w środku („…w 2024. | r. wydarzyło się…"), a odsłuch rozjeżdża się
// z podświetleniem. Robimy to lokalnie i deterministycznie — bez modelu i bez zależności.

/**
 * Skróty, po których kropka NIE kończy zdania. Zapisane bez kropki, porównywane po zamianie na małe
 * litery. Lista jest świadomie krótka: obejmuje to, co realnie występuje w polskich tekstach
 * prasowych. Skrót nierozpoznany daje w najgorszym razie zdanie przecięte o jedno słowo za wcześnie
 * — nic się nie gubi, więc nie ma po co puchnąć.
 */
const ABBREVIATIONS = new Set([
  // ogólne
  "np", "tzn", "tj", "itp", "itd", "m.in", "min", "ok", "ww", "tzw", "ds", "ur", "zm",
  // czas i miary
  "r", "w", "godz", "tys", "mln", "mld", "zł", "gr", "km", "kg", "proc",
  // tytuły i osoby
  "dr", "hab", "prof", "inż", "mgr", "gen", "płk", "mjr", "kpt", "por", "ks", "św", "im",
  "p", "pt", "ul", "al", "pl", "nr", "poz", "art", "ust", "par", "rys", "tab", "str", "s",
  // instytucje i formy prawne
  "sp", "z", "o", "o.o", "s.a", "spółdz",
]);

/** Znaki kończące zdanie. Wielokropek i „?!" obsługuje zbijanie ciągów w pętli. */
const TERMINATORS = new Set([".", "!", "?", "…"]);

/** Domykające cudzysłowy/nawiasy, które należą jeszcze do kończonego zdania. */
const CLOSERS = new Set(["”", "“", '"', "'", ")", "]", "»", "’"]);

// Klasy `\p{L}` / `\p{N}` wymagają flagi `u`, a ta jest niedostępna przy docelowym ES5 tego projektu
// (TS1501). Stąd jawny zakres liter: łacinka podstawowa + rozszerzenia (polskie, niemieckie,
// francuskie znaki w cytatach i nazwiskach).
const LETTER_CLASS = "A-Za-z\\u00C0-\\u024F";
const LETTER_RE = new RegExp(`[${LETTER_CLASS}]`);
/** Ostatni „wyraz" przed kropką — litery, cyfry i kropki wewnętrzne (żeby złapać `m.in`, `o.o`). */
const WORD_BEFORE_DOT_RE = new RegExp(`([${LETTER_CLASS}0-9.]+)$`);

/** Czy wyraz bezpośrednio przed kropką jest znanym skrótem. */
function endsWithAbbreviation(before: string): boolean {
  const m = before.match(WORD_BEFORE_DOT_RE);
  if (!m) return false;
  const word = m[1].toLowerCase().replace(/\.+$/, "");
  if (!word) return false;
  if (ABBREVIATIONS.has(word)) return true;
  // Pojedyncza litera z kropką to prawie zawsze inicjał („J. Kowalski"), nie koniec zdania.
  return word.length === 1 && LETTER_RE.test(word);
}

/**
 * Czy dalszy ciąg zaczyna się od małej litery. Sprawdzamy przez porównanie z własną wersją
 * wielką/małą zamiast wypisywać zakres — działa dla każdego alfabetu i nie wymaga flagi `u`.
 */
function startsWithLowercase(rest: string): boolean {
  const m = rest.match(/^\s*(\S)/);
  if (!m) return false;
  const c = m[1];
  return LETTER_RE.test(c) && c === c.toLowerCase() && c !== c.toUpperCase();
}

/**
 * Dzieli polski tekst na zdania.
 *
 * Zwraca zdania z zachowaną interpunkcją i bez otaczających białych znaków; puste fragmenty są
 * pomijane. Tekst bez żadnego znaku końca zdania wraca jako jedno zdanie — lektor ma zawsze co czytać.
 *
 * Nie kończymy zdania, gdy kropka: należy do znanego skrótu („np.", „r.", „godz."), stoi między
 * cyframi („3.14", „1.500"), stoi po inicjale („J. Kowalski") albo po niej idzie mała litera
 * (pewny znak, że zdanie trwa).
 */
export function splitSentences(text: string): string[] {
  if (!text) return [];
  const src = text.replace(/\r\n?/g, "\n");
  const out: string[] = [];
  let start = 0;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    // Nowy akapit kończy zdanie niezależnie od interpunkcji — tak czyta to człowiek.
    if (ch === "\n" && src[i + 1] === "\n") {
      const piece = src.slice(start, i).trim();
      if (piece) out.push(piece);
      start = i + 1;
      continue;
    }

    if (!TERMINATORS.has(ch)) continue;

    const before = src.slice(start, i);
    const isDot = ch === ".";

    // Liczba z kropką: „3.14", „1.500" — kropka jest częścią liczby.
    if (isDot && /[0-9]$/.test(before) && /^[0-9]/.test(src.slice(i + 1))) continue;
    if (isDot && endsWithAbbreviation(before)) continue;

    // Zbijamy ciąg znaków końca („?!", „...") w jeden koniec zdania.
    let end = i + 1;
    while (end < src.length && TERMINATORS.has(src[end])) end++;
    // …a razem z nim domykający cudzysłów lub nawias.
    while (end < src.length && CLOSERS.has(src[end])) end++;

    const rest = src.slice(end);
    // Po kropce mała litera = zdanie trwa (np. nierozpoznany skrót). Wykrzyknik i pytajnik zdanie
    // kończą zawsze — po nich mała litera to zapis stylistyczny, nie kontynuacja.
    if (isDot && startsWithLowercase(rest)) continue;
    // Koniec zdania musi być oddzielony od dalszego ciągu — inaczej to adres, skrót albo wersja.
    if (rest && !/^[\s\n]/.test(rest)) continue;

    const piece = src.slice(start, end).trim();
    if (piece) out.push(piece);
    start = end;
    i = end - 1;
  }

  const tail = src.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}
