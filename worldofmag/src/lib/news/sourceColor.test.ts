import { test } from "node:test"
import assert from "node:assert/strict"
import { sourceColor, isNeutralSourceColor } from "@/lib/news/sourceColor"

// 040: kolor rozróżnia źródła na liście wiadomości i na osi czasu. Gdyby zmieniał się między
// wejściami na stronę, użytkownik uczyłby się skojarzenia „niebieskie = Onet" na darmo. Stąd test
// na stabilność, a nie tylko na to, że funkcja coś zwraca.

const PALETTE = [
  "var(--accent-blue)",
  "var(--accent-green)",
  "var(--accent-purple)",
  "var(--accent-amber)",
  "var(--accent-red)",
]

test("ten sam opis daje zawsze ten sam kolor", () => {
  const a = sourceColor("pop-science")
  const b = sourceColor("pop-science")
  assert.equal(a, b)
})

test("kolor pochodzi wyłącznie z palety zmiennych CSS", () => {
  for (const d of ["lewica", "nature", "pop-science", "gaming", "Śląsk", "technologia", "x"]) {
    assert.ok(PALETTE.includes(sourceColor(d)), `${d} → ${sourceColor(d)} spoza palety`)
  }
})

test("zapis nie ma znaczenia — wielkość liter, interpunkcja i spacje", () => {
  const base = sourceColor("pop-science")
  assert.equal(sourceColor("Pop-Science"), base)
  assert.equal(sourceColor("POP SCIENCE"), base)
  assert.equal(sourceColor("  pop   science  "), base)
})

test("polskie znaki nie rozdzielają tego samego opisu na dwa kolory", () => {
  assert.equal(sourceColor("Śląsk"), sourceColor("slask"))
  assert.equal(sourceColor("Żeglarstwo"), sourceColor("zeglarstwo"))
})

test("brak opisu daje kolor neutralny, a nie losowy z palety", () => {
  for (const empty of ["", "   ", null, undefined]) {
    const c = sourceColor(empty as string)
    assert.ok(isNeutralSourceColor(c), `${JSON.stringify(empty)} → ${c}`)
    assert.ok(!PALETTE.includes(c))
  }
  // Opis z samej interpunkcji też nie niesie treści — traktujemy go jak brak.
  assert.ok(isNeutralSourceColor(sourceColor("!!! ???")))
})

test("różne opisy trafiają w więcej niż jeden kolor", () => {
  // Nie wymagamy pełnego rozrzutu (paleta jest mała, kolizje są dozwolone), ale funkcja zwracająca
  // wszystkim jeden kolor byłaby bezużyteczna — a tak wygląda typowa pomyłka w haszowaniu.
  const colors = new Set(
    ["lewica", "prawica", "centrum", "nature", "pop-science", "sport", "kultura"].map(sourceColor)
  )
  assert.ok(colors.size >= 3, `za mały rozrzut: ${colors.size}`)
})

test("kolor nie zależy od kolejności wywołań ani od stanu modułu", () => {
  const first = sourceColor("nature")
  sourceColor("lewica")
  sourceColor("")
  sourceColor("technologia")
  assert.equal(sourceColor("nature"), first)
})
