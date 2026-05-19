/** Fallback list kept in sync with the 0013_system_categories migration.
 *  Used only when the DB is unavailable or during initial seed.
 *  Production code should read from Category table (userId=null, teamId=null). */
export const BASE_CATEGORIES: Array<{ name: string; emoji: string }> = [
  { name: "Warzywa i owoce",     emoji: "🥕" },
  { name: "Nabiał i jaja",       emoji: "🧀" },
  { name: "Mięso i ryby",        emoji: "🥩" },
  { name: "Piekarnia",           emoji: "🍞" },
  { name: "Suche produkty",      emoji: "🌾" },
  { name: "Napoje",              emoji: "🍺" },
  { name: "Mrożone",             emoji: "🧊" },
  { name: "Przekąski i słodycze", emoji: "🍫" },
  { name: "Przyprawy i oleje",   emoji: "🫙" },
  { name: "Zioła i przyprawy",   emoji: "🌿" },
  { name: "Chemia i higiena",    emoji: "🧴" },
  { name: "Konserwy i przetwory", emoji: "🥫" },
  { name: "Inne",                emoji: "📦" },
];
