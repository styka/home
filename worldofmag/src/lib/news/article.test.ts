import { test } from "node:test"
import assert from "node:assert/strict"
import { extractText, metaContent, extractPublishedAt } from "@/lib/news/article"

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
