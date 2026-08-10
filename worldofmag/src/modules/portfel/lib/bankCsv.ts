// Z-300: parser wyciągów bankowych CSV → transakcje do zaksięgowania w Portfelu.
//
// Banki eksportują CSV w różnych formatach (separator `;`/`,`/tab, daty
// dd.mm.yyyy / yyyy-mm-dd / dd/mm/yyyy, kwoty z przecinkiem dziesiętnym i spacją
// jako separatorem tysięcy, znak +/-). Parser wykrywa separator i kolumny
// heurystycznie (po zawartości, nie po nagłówkach — te bywają różne/brak),
// więc działa bez ręcznego mapowania dla typowych wyciągów.

export interface ParsedTransaction {
  date: string; // ISO yyyy-mm-dd
  amount: number; // ze znakiem: + przychód, − rozchód
  description: string;
}

export interface BankCsvResult {
  transactions: ParsedTransaction[];
  /** Indeksy wykrytych kolumn (do podglądu/diagnostyki); -1 gdy nie znaleziono. */
  columns: { date: number; amount: number; description: number };
  /** Liczba wierszy pominiętych (nieparsowalna data lub kwota). */
  skipped: number;
}

const DELIMITERS = [";", "\t", ","] as const;

function detectDelimiter(line: string): string {
  let best = ";";
  let bestCount = -1;
  for (const d of DELIMITERS) {
    const count = line.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return bestCount > 0 ? best : ";";
}

function splitCells(line: string, delim: string): string[] {
  // Minimalna obsługa cudzysłowów: "a;b" nie jest dzielone po delimiterze w środku.
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim().replace(/^"|"$/g, "").trim());
}

/** Parsuje datę w formatach yyyy-mm-dd, dd.mm.yyyy, dd/mm/yyyy → ISO; null gdy się nie da. */
export function parseBankDate(cell: string): string | null {
  const s = cell.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/.exec(s);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    if (+mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31) return `${m[3]}-${mo}-${d}`;
  }
  return null;
}

/** Parsuje kwotę: „1 234,56", „-1234.56", „+50,00", „(50,00)" → liczba; null gdy nie kwota. */
export function parseBankAmount(cell: string): number | null {
  let s = cell.trim();
  if (!s) return null;
  // nawias księgowy = wartość ujemna
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  // usuń walutę/spacje/separatory tysięcy; ujednolić przecinek dziesiętny
  s = s.replace(/[  ]/g, "").replace(/(zł|PLN|EUR|USD|€|\$)/gi, "");
  // jeśli są i kropki i przecinki — ostatni znak to separator dziesiętny
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else {
    s = s.replace(",", ".");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return negative ? -n : n;
}

export function parseBankCsv(text: string): BankCsvResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return { transactions: [], columns: { date: -1, amount: -1, description: -1 }, skipped: 0 };

  const delim = detectDelimiter(lines[0]);
  const rows = lines.map((l) => splitCells(l, delim));
  const colCount = Math.max(...rows.map((r) => r.length));

  // Skoruj kolumny po zawartości (ile wierszy parsuje się jako data / kwota).
  const dateScore = new Array(colCount).fill(0);
  const amountScore = new Array(colCount).fill(0);
  const textLen = new Array(colCount).fill(0);
  for (const r of rows) {
    for (let c = 0; c < colCount; c++) {
      const cell = r[c] ?? "";
      if (parseBankDate(cell)) dateScore[c]++;
      if (parseBankAmount(cell) !== null) amountScore[c]++;
      textLen[c] += cell.length;
    }
  }
  const dateCol = argmax(dateScore);
  // kwota: najlepsza kolumna liczbowa różna od kolumny daty
  let amountCol = -1;
  let amountBest = 0;
  for (let c = 0; c < colCount; c++) {
    if (c === dateCol) continue;
    if (amountScore[c] > amountBest) {
      amountBest = amountScore[c];
      amountCol = c;
    }
  }
  // opis: najdłuższa tekstowo kolumna różna od daty/kwoty
  let descCol = -1;
  let descBest = -1;
  for (let c = 0; c < colCount; c++) {
    if (c === dateCol || c === amountCol) continue;
    if (textLen[c] > descBest) {
      descBest = textLen[c];
      descCol = c;
    }
  }

  const transactions: ParsedTransaction[] = [];
  let skipped = 0;
  for (const r of rows) {
    const date = dateCol >= 0 ? parseBankDate(r[dateCol] ?? "") : null;
    const amount = amountCol >= 0 ? parseBankAmount(r[amountCol] ?? "") : null;
    if (date === null || amount === null) {
      skipped++; // nagłówek lub wiersz śmieciowy
      continue;
    }
    const description = (descCol >= 0 ? r[descCol] : "")?.slice(0, 200) ?? "";
    transactions.push({ date, amount, description });
  }

  return { transactions, columns: { date: dateCol, amount: amountCol, description: descCol }, skipped };
}

function argmax(arr: number[]): number {
  let idx = -1;
  let best = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > best) {
      best = arr[i];
      idx = i;
    }
  }
  return idx;
}
