import { test } from "node:test"
import assert from "node:assert/strict"
import { parseRss } from "@/lib/news/rss"

test("RSS 2.0: tytuł, link, data, opis", () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item>
      <title>Wiadomość pierwsza</title>
      <link>https://example.pl/1</link>
      <pubDate>Wed, 01 Jan 2026 10:00:00 GMT</pubDate>
      <description>Krótki opis.</description>
    </item>
  </channel></rss>`
  const items = parseRss(xml)
  assert.equal(items.length, 1)
  assert.equal(items[0].title, "Wiadomość pierwsza")
  assert.equal(items[0].link, "https://example.pl/1")
  assert.ok(items[0].publishedAt instanceof Date)
  assert.equal(items[0].publishedAt?.getUTCFullYear(), 2026)
  assert.equal(items[0].description, "Krótki opis.")
})

test("Atom: <entry> + link href + summary", () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
    <entry>
      <title>Atom news</title>
      <link href="https://example.pl/a" rel="alternate"/>
      <published>2026-02-03T08:00:00Z</published>
      <summary>Streszczenie.</summary>
    </entry>
  </feed>`
  const items = parseRss(xml)
  assert.equal(items.length, 1)
  assert.equal(items[0].title, "Atom news")
  assert.equal(items[0].link, "https://example.pl/a")
  assert.equal(items[0].publishedAt?.getUTCFullYear(), 2026)
})

test("pomija pozycję bez linku", () => {
  const xml = `<rss><channel>
    <item><title>Bez linku</title></item>
    <item><title>Z linkiem</title><link>https://example.pl/ok</link></item>
  </channel></rss>`
  const items = parseRss(xml)
  assert.equal(items.length, 1)
  assert.equal(items[0].title, "Z linkiem")
})

test("strip tagów HTML w tytule", () => {
  const xml = `<rss><channel><item>
    <title>Hello <b>World</b></title>
    <link>https://example.pl/h</link>
  </item></channel></rss>`
  const items = parseRss(xml)
  assert.equal(items[0].title, "Hello World")
})

test("opis obcięty do 600 znaków", () => {
  const long = "a".repeat(1000)
  const xml = `<rss><channel><item>
    <title>T</title><link>https://example.pl/x</link>
    <description>${long}</description>
  </item></channel></rss>`
  const items = parseRss(xml)
  assert.equal(items[0].description.length, 600)
})

test("brak daty → publishedAt = null", () => {
  const xml = `<rss><channel><item>
    <title>Bez daty</title><link>https://example.pl/d</link>
  </item></channel></rss>`
  const items = parseRss(xml)
  assert.equal(items[0].publishedAt, null)
})

test("wiele pozycji — kolejność zachowana", () => {
  const xml = `<rss><channel>
    <item><title>A</title><link>https://example.pl/1</link></item>
    <item><title>B</title><link>https://example.pl/2</link></item>
    <item><title>C</title><link>https://example.pl/3</link></item>
  </channel></rss>`
  const items = parseRss(xml)
  assert.deepEqual(items.map((i) => i.title), ["A", "B", "C"])
})

test("śmieci/pusty XML → []", () => {
  assert.deepEqual(parseRss(""), [])
  assert.deepEqual(parseRss("<html><body>not a feed</body></html>"), [])
})
