import { test } from "node:test"
import assert from "node:assert/strict"
import { observedWmo, precipKind, wmo } from "@/lib/weather/openMeteo"

// 044: zgłoszenie właściciela — „mam deszcz, a moduł pogody pokazuje chmurkę i 82%".
// Błąd tego rodzaju jest CICHY: ikona zawsze wygląda wiarygodnie, więc nieprawdy nie widać
// inaczej niż przez okno. Stąd test na regule, a nie na wyglądzie.

// ─── Korekta zmierzonym opadem ──────────────────────────────────────────────

test("pochmurno + zmierzony deszcz → ikona i opis mówią o deszczu (AC-A1)", () => {
  const meta = observedWmo({ code: 3, isDay: true, precip: 1.2, rain: 1.2 })
  assert.equal(meta.label, "Deszcz")
  assert.notEqual(meta.emoji, wmo(3).emoji, "chmurka nie może przetrwać zmierzonego opadu")
})

test("bezchmurnie + zmierzony deszcz → deszcz (korekta działa też przy kodzie 0)", () => {
  assert.equal(observedWmo({ code: 0, isDay: true, precip: 0.8 }).label, "Deszcz")
})

test("pochmurno bez opadu → bez zmiany, zero regresji (AC-A2)", () => {
  const meta = observedWmo({ code: 3, isDay: true, precip: 0, rain: 0, showers: 0, snowfall: 0 })
  assert.deepEqual(meta, wmo(3))
})

test("opad śladowy (0,05 mm) NIE uruchamia korekty (AC-A2)", () => {
  const meta = observedWmo({ code: 3, isDay: true, precip: 0.05, rain: 0.05 })
  assert.deepEqual(meta, wmo(3), "wilgoć na granicy czułości to nie deszcz")
})

test("brak danych o opadzie → zachowanie sprzed 044 (AC-A7)", () => {
  const meta = observedWmo({ code: 3, isDay: true, precip: null, rain: null, showers: null, snowfall: null })
  assert.deepEqual(meta, wmo(3))
  // Pola całkiem nieobecne — ta sama ścieżka, bez wyjątku.
  assert.deepEqual(observedWmo({ code: 3, isDay: true }), wmo(3))
})

test("kod opadowy dostawcy jest nietykalny — burzy nie spłaszczamy do deszczu", () => {
  assert.deepEqual(observedWmo({ code: 61, isDay: true, precip: 5 }), wmo(61))
  assert.deepEqual(observedWmo({ code: 95, isDay: true, precip: 12 }), wmo(95))
  assert.equal(observedWmo({ code: 95, isDay: true, precip: 12 }).label, "Burza")
})

// ─── Rodzaj i natężenie opadu ───────────────────────────────────────────────

test("rodzaj opadu rozpoznany z pomiarów", () => {
  assert.equal(precipKind({ code: 3, snowfall: 1.0 }), "snow")
  assert.equal(precipKind({ code: 3, showers: 1.0 }), "showers")
  assert.equal(precipKind({ code: 3, rain: 1.0 }), "rain")
  assert.equal(precipKind({ code: 3, precip: 1.0 }), "rain", "sam `precipitation` traktujemy jak deszcz")
  assert.equal(precipKind({ code: 3 }), "none")
})

test("śnieg i przelotny opad dostają własne opisy, nie „Deszcz”", () => {
  assert.equal(observedWmo({ code: 3, isDay: true, precip: 1.0, snowfall: 1.0 }).label, "Śnieg")
  assert.equal(
    observedWmo({ code: 3, isDay: true, precip: 1.0, showers: 1.0 }).label,
    "Przelotny deszcz"
  )
})

test("natężenie opadu przekłada się na kod o rosnącej sile", () => {
  // Etykieta jest wspólna dla całego zakresu, więc sprawdzamy przez zgodność z konkretnym kodem WMO.
  assert.deepEqual(observedWmo({ code: 3, isDay: true, precip: 0.5 }), wmo(61), "słaby")
  assert.deepEqual(observedWmo({ code: 3, isDay: true, precip: 3.0 }), wmo(63), "umiarkowany")
  assert.deepEqual(observedWmo({ code: 3, isDay: true, precip: 10.0 }), wmo(65), "silny")
})

// ─── Warianty nocne (AC-A5) ─────────────────────────────────────────────────

const SUN_EMOJI = ["☀️", "🌤️", "⛅", "🌦️"]

test("żaden wariant nocny nie zawiera słońca (AC-A5)", () => {
  for (const code of [0, 1, 2, 3, 45, 51, 53, 55, 61, 71, 80, 81, 82, 95]) {
    const night = wmo(code, true)
    assert.ok(
      !SUN_EMOJI.includes(night.emoji),
      `kod ${code}: nocny wariant pokazuje słońce (${night.emoji})`
    )
  }
})

test("warianty dzienne nadal pokazują słońce tam, gdzie powinny", () => {
  for (const code of [0, 1, 2, 51, 80]) {
    assert.ok(
      SUN_EMOJI.includes(wmo(code, false).emoji),
      `kod ${code}: wariant dzienny stracił słońce`
    )
  }
})

test("mżawka i przelotny deszcz mają odrębny wariant nocny (luka domknięta w 044)", () => {
  assert.notEqual(wmo(51, true).emoji, wmo(51, false).emoji)
  assert.notEqual(wmo(80, true).emoji, wmo(80, false).emoji)
})

test("korekta zachowuje porę doby — nocny deszcz nie świeci słońcem", () => {
  const night = observedWmo({ code: 3, isDay: false, precip: 1.0, showers: 1.0 })
  assert.ok(!SUN_EMOJI.includes(night.emoji))
  assert.equal(night.label, "Przelotny deszcz")
})

test("brak `isDay` traktujemy jak dzień (prognoza dobowa nie ma pory doby)", () => {
  assert.deepEqual(observedWmo({ code: 0 }), wmo(0, false))
})
