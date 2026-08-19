import { test } from "node:test"
import assert from "node:assert/strict"
import { extractText, metaContent, extractPublishedAt, fetchArticle, ARTICLE_MAX_ATTEMPTS } from "@/lib/news/article"

test("metaContent: property przed content", () => {
  const html = `<meta property="og:image" content="https://e.pl/i.jpg">`
  assert.equal(metaContent(html, "og:image"), "https://e.pl/i.jpg")
})

test("metaContent: name= też działa", () => {
  const html = `<meta name="og:title" content="Tytuł">`
  assert.equal(metaContent(html, "og:title"), "Tytuł")
})

test("metaContent: odwrotna kolejność (content przed property)", () => {
  const html = `<meta content="https://e.pl/x.png" property="og:image">`
  assert.equal(metaContent(html, "og:image"), "https://e.pl/x.png")
})

test("metaContent: brak → null", () => {
  assert.equal(metaContent("<html></html>", "og:image"), null)
})

test("extractPublishedAt: meta article:published_time", () => {
  const d = extractPublishedAt(`<meta property="article:published_time" content="2026-01-02T10:00:00Z">`)
  assert.ok(d instanceof Date)
  assert.equal(d?.getUTCFullYear(), 2026)
})

test("extractPublishedAt: <time datetime>", () => {
  const d = extractPublishedAt(`<article><time datetime="2026-03-04T08:00:00Z">4 marca</time></article>`)
  assert.equal(d?.getUTCMonth(), 2) // marzec = 2
})

test("extractPublishedAt: JSON-LD datePublished", () => {
  const d = extractPublishedAt(`<script type="application/ld+json">{"datePublished":"2026-05-06T00:00:00Z"}</script>`)
  assert.equal(d?.getUTCFullYear(), 2026)
})

test("extractPublishedAt: brak daty → null", () => {
  assert.equal(extractPublishedAt("<html><body>brak</body></html>"), null)
})

test("extractText: wycina <script>/<style> i dekoduje encje", () => {
  const html = `<html><head><style>.a{color:red}</style></head><body>
    <script>var x = 1; alert("zło")</script>
    <p>Cena 5&nbsp;zł &amp; więcej</p>
  </body></html>`
  const text = extractText(html)
  assert.doesNotMatch(text, /alert|color:red|var x/)
  assert.match(text, /Cena 5 zł & więcej/)
})

test("extractText: preferuje treść <article> gdy długa", () => {
  const long = "Treść artykułu. ".repeat(40) // > 400 znaków
  const html = `<nav>menu nieistotne</nav><article><p>${long}</p></article><footer>stopka</footer>`
  const text = extractText(html)
  assert.match(text, /Treść artykułu\./)
  assert.doesNotMatch(text, /menu nieistotne|stopka/)
})

test("extractText: limit 6000 znaków", () => {
  const html = `<body><p>${"x".repeat(9000)}</p></body>`
  assert.ok(extractText(html).length <= 6000)
})

// ── 080 (Z5): ponowienie semantyczne ────────────────────────────────────────
//
// Sedno tych testów: odpowiedź 200, z której nie da się wyciągnąć treści, jest dla warstwy
// transportowej SUKCESEM, a dla nas porażką. Gdyby ponowienie siedziało tylko w `resilientFetch`,
// żaden z poniższych przypadków nie zostałby ponowiony ani razu.

const noSleep = async () => {}

/** Fake fetch oddający kolejne odpowiedzi z listy (ostatnia się powtarza); liczy wywołania. */
function fakeHtmlFetch(bodies: string[]) {
  let i = 0
  const fn = async () => {
    const body = bodies[Math.min(i, bodies.length - 1)]
    i++
    return { ok: true, status: 200, text: async () => body } as unknown as Response
  }
  return Object.assign(fn, { calls: () => i })
}

const LONG = `<article><p>${"Treść artykułu. ".repeat(40)}</p></article>`

test("fetchArticle: 200 z pustą treścią jest ponawiane do trzech prób", async () => {
  const f = fakeHtmlFetch(["<html><body></body></html>"])
  const out = await fetchArticle("https://example.test/a", { fetchImpl: f, sleep: noSleep })
  assert.equal(f.calls(), ARTICLE_MAX_ATTEMPTS)
  assert.equal(out.text, "")
})

test("fetchArticle: udana pierwsza próba nie jest ponawiana", async () => {
  const f = fakeHtmlFetch([LONG])
  const out = await fetchArticle("https://example.test/b", { fetchImpl: f, sleep: noSleep })
  assert.equal(f.calls(), 1)
  assert.match(out.text, /Treść artykułu\./)
})

test("fetchArticle: treść, która przyszła dopiero za drugim razem, jest zwracana", async () => {
  const f = fakeHtmlFetch(["<html><body></body></html>", LONG])
  const out = await fetchArticle("https://example.test/c", { fetchImpl: f, sleep: noSleep })
  assert.equal(f.calls(), 2)
  assert.match(out.text, /Treść artykułu\./)
})

test("fetchArticle: po wyczerpaniu prób zwraca NAJLEPSZĄ, nie ostatnią", async () => {
  // Druga próba dała kilkadziesiąt znaków (poniżej progu), trzecia znów nic.
  const krotka = `<body><p>${"a".repeat(80)}</p></body>`
  const f = fakeHtmlFetch(["<body></body>", krotka, "<body></body>"])
  const out = await fetchArticle("https://example.test/d", { fetchImpl: f, sleep: noSleep })
  assert.equal(f.calls(), ARTICLE_MAX_ATTEMPTS)
  assert.equal(out.text.length, 80, "krótka treść jest lepsza niż żadna")
})
