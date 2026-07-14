import { test } from "node:test"
import assert from "node:assert/strict"
import { resilientFetch, fetchJsonSafe } from "@/lib/integrations/resilientFetch"

const noSleep = async () => {}
function res(status: number, body: unknown = {}): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}
/** Fake fetch oddający kolejne wyniki/wyjątki z listy; liczy wywołania. */
function fakeFetch(seq: (Response | Error)[]) {
  let i = 0
  const fn = async () => {
    const v = seq[Math.min(i, seq.length - 1)]
    i++
    if (v instanceof Error) throw v
    return v
  }
  return Object.assign(fn, { calls: () => i })
}

test("sukces za pierwszym razem — brak retry", async () => {
  const f = fakeFetch([res(200, { ok: 1 })])
  const r = await resilientFetch("u", { fetchImpl: f as unknown as typeof fetch, sleep: noSleep })
  assert.equal(r.status, 200)
  assert.equal(f.calls(), 1)
})

test("503 → ponawia i zwraca kolejny 200", async () => {
  const f = fakeFetch([res(503), res(200)])
  const r = await resilientFetch("u", { fetchImpl: f as unknown as typeof fetch, sleep: noSleep, retries: 2 })
  assert.equal(r.status, 200)
  assert.equal(f.calls(), 2)
})

test("503 zawsze → po wyczerpaniu retry zwraca ostatnią (non-ok) odpowiedź", async () => {
  const f = fakeFetch([res(503), res(503), res(503)])
  const r = await resilientFetch("u", { fetchImpl: f as unknown as typeof fetch, sleep: noSleep, retries: 2 })
  assert.equal(r.status, 503)
  assert.equal(f.calls(), 3) // 1 + 2 retry
})

test("404 (poza retryOn) → zwraca od razu, bez ponawiania", async () => {
  const f = fakeFetch([res(404), res(200)])
  const r = await resilientFetch("u", { fetchImpl: f as unknown as typeof fetch, sleep: noSleep, retries: 2 })
  assert.equal(r.status, 404)
  assert.equal(f.calls(), 1)
})

test("błąd sieci → ponawia, potem sukces", async () => {
  const f = fakeFetch([new Error("ECONNRESET"), res(200)])
  const r = await resilientFetch("u", { fetchImpl: f as unknown as typeof fetch, sleep: noSleep, retries: 2 })
  assert.equal(r.status, 200)
  assert.equal(f.calls(), 2)
})

test("błąd sieci zawsze → rzuca po wyczerpaniu retry", async () => {
  const f = fakeFetch([new Error("timeout"), new Error("timeout"), new Error("timeout")])
  await assert.rejects(
    resilientFetch("u", { fetchImpl: f as unknown as typeof fetch, sleep: noSleep, retries: 2 }),
    /timeout/,
  )
  assert.equal(f.calls(), 3)
})

test("fetchJsonSafe: zwraca JSON na 200", async () => {
  const f = fakeFetch([res(200, { v: 42 })])
  const j = await fetchJsonSafe<{ v: number }>("u", { fetchImpl: f as unknown as typeof fetch, sleep: noSleep })
  assert.deepEqual(j, { v: 42 })
})

test("fetchJsonSafe: null przy trwałym błędzie sieci (degradacja, nie wyjątek)", async () => {
  const f = fakeFetch([new Error("down"), new Error("down"), new Error("down")])
  const j = await fetchJsonSafe("u", { fetchImpl: f as unknown as typeof fetch, sleep: noSleep, retries: 2 })
  assert.equal(j, null)
})

test("fetchJsonSafe: null przy non-ok", async () => {
  const f = fakeFetch([res(500), res(500), res(500)])
  const j = await fetchJsonSafe("u", { fetchImpl: f as unknown as typeof fetch, sleep: noSleep, retries: 2 })
  assert.equal(j, null)
})
