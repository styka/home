import { test } from "node:test"
import assert from "node:assert/strict"
import { moonPhase } from "@/lib/weather/moon"

// 038: błąd w rachunku faz księżyca byłby CICHY i wiarygodnie wyglądający — „Pełnia" zamiast „Nów"
// niczym się nie objawia poza tym, że jest nieprawdą. Stąd test na rzeczywistych datach.
// Daty nowiów i pełni wg efemeryd (UTC, południe doby zdarzenia).

test("nów rozpoznany dla rzeczywistych dat nowiu", () => {
  const newMoons = [
    new Date("2024-01-11T12:00:00Z"),
    new Date("2024-06-06T12:00:00Z"),
    new Date("2025-03-29T12:00:00Z"),
  ]
  for (const d of newMoons) {
    assert.equal(moonPhase(d).name, "Nów", `nów dla ${d.toISOString()}`)
  }
})

test("pełnia rozpoznana dla rzeczywistych dat pełni", () => {
  const fullMoons = [
    new Date("2024-01-25T12:00:00Z"),
    new Date("2024-06-22T12:00:00Z"),
    new Date("2025-04-13T12:00:00Z"),
  ]
  for (const d of fullMoons) {
    assert.equal(moonPhase(d).name, "Pełnia", `pełnia dla ${d.toISOString()}`)
  }
})

test("kwadry wypadają mniej więcej w połowie drogi", () => {
  // 2024-01-18 — pierwsza kwadra, 2024-02-02 — ostatnia kwadra.
  assert.equal(moonPhase(new Date("2024-01-18T12:00:00Z")).name, "Pierwsza kwadra")
  assert.equal(moonPhase(new Date("2024-02-02T12:00:00Z")).name, "Ostatnia kwadra")
})

test("ułamek cyklu zawsze mieści się w [0, 1) — także dla dat sprzed punktu odniesienia", () => {
  for (const iso of ["1969-07-20T20:17:00Z", "1990-05-01T00:00:00Z", "2030-12-31T23:59:00Z"]) {
    const f = moonPhase(new Date(iso)).fraction
    assert.ok(f >= 0 && f < 1, `ułamek poza zakresem dla ${iso}: ${f}`)
  }
})

test("cykl się zamyka — po jednym miesiącu synodycznym wracamy do tej samej fazy", () => {
  const a = new Date("2024-03-10T12:00:00Z")
  const b = new Date(a.getTime() + 29.530588853 * 86_400_000)
  assert.equal(moonPhase(a).name, moonPhase(b).name)
})
