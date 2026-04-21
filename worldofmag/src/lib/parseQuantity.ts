import type { ParsedItem } from "@/types";

const UNIT_PATTERNS = [
  "szt", "sztuk", "sztuki",
  "kg", "g", "dag", "l", "ml", "cl",
  "op", "opak", "opakowanie",
  "paczka", "paczki", "paczek",
  "butelka", "butelki", "butelek",
  "słoik", "słoika", "słoików",
  "puszka", "puszki", "puszek",
  "torebka", "torebki", "torebek",
  "litr", "litra", "litrów",
  "gram", "grama", "gramów",
  "piece", "pieces", "pack", "packs",
  "bottle", "bottles", "jar", "jars",
  "can", "cans", "bag", "bags",
  "liter", "liters", "gram", "grams",
  "oz", "lb", "lbs", "cup", "cups",
];

const UNIT_REGEX = UNIT_PATTERNS.join("|");

const PATTERNS: Array<{ regex: RegExp; extract: (m: RegExpMatchArray) => ParsedItem }> = [
  // "mleko x2" or "mleko x 2"
  {
    regex: new RegExp(`^(.+?)\\s+[xX]\\s*(\\d+(?:[.,]\\d+)?)$`),
    extract: (m) => ({ name: m[1].trim(), quantity: parseNum(m[2]), unit: null }),
  },
  // "5x jajka" or "5 x jajka"
  {
    regex: new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*[xX]\\s+(.+)$`),
    extract: (m) => ({ name: m[2].trim(), quantity: parseNum(m[1]), unit: null }),
  },
  // "2 butelki mleka" — qty + unit + name
  {
    regex: new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s+(${UNIT_REGEX})\\s+(.+)$`, "i"),
    extract: (m) => ({ name: m[3].trim(), quantity: parseNum(m[1]), unit: m[2].toLowerCase() }),
  },
  // "mleko 2l" or "mleko 500ml" — name + qty+unit glued
  {
    regex: new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)(kg|g|dag|l|ml|cl|szt|oz|lb)$`, "i"),
    extract: (m) => ({ name: m[1].trim(), quantity: parseNum(m[2]), unit: m[3].toLowerCase() }),
  },
  // "3 kg mąki" — qty + unit (space) + name
  {
    regex: new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s+(kg|g|dag|l|ml|cl|szt|oz|lb)\\s+(.+)$`, "i"),
    extract: (m) => ({ name: m[3].trim(), quantity: parseNum(m[1]), unit: m[2].toLowerCase() }),
  },
  // "mleko 2" — name + bare number at end
  {
    regex: /^(.+?)\s+(\d+(?:[.,]\d+)?)$/,
    extract: (m) => ({ name: m[1].trim(), quantity: parseNum(m[2]), unit: null }),
  },
  // "2 mleko" — bare number + name
  {
    regex: /^(\d+(?:[.,]\d+)?)\s+(.+)$/,
    extract: (m) => ({ name: m[2].trim(), quantity: parseNum(m[1]), unit: null }),
  },
];

function parseNum(s: string): number {
  return parseFloat(s.replace(",", "."));
}

export function parseQuantity(raw: string): ParsedItem {
  const trimmed = raw.trim();
  for (const { regex, extract } of PATTERNS) {
    const m = trimmed.match(regex);
    if (m) {
      const result = extract(m);
      if (result.name.length > 0) return result;
    }
  }
  return { name: trimmed, quantity: null, unit: null };
}
