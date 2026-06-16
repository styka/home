import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "../markdown";

// Z-057 / Z-174: testy bezpieczeństwa krytycznego renderera markdown (XSS).
// CLAUDE.md ostrzega, że escapowanie &/< jest jedyną barierą — pilnujemy regresji.

test("escapuje < i &: brak surowego <script>", () => {
  const html = markdownToHtml("<script>alert(1)</script> & cośtam");
  assert.ok(!html.includes("<script"), "nie może być surowego <script");
  assert.ok(html.includes("&lt;script"), "< musi być zescapowane");
  assert.ok(html.includes("&amp;"), "& musi być zescapowane");
});

test("surowy <img onerror> jest neutralizowany (zescapowany, nie tag)", () => {
  const html = markdownToHtml('<img src=x onerror=alert(1)>');
  assert.ok(!/<img\s+src=x/i.test(html), "surowy <img> nie może powstać");
  assert.ok(html.includes("&lt;img"), "< zescapowane");
});

test("obraz markdown http(s) → <img>, ale javascript: NIE", () => {
  assert.ok(markdownToHtml("![a](https://x/y.png)").includes('<img class="md-img"'), "http(s) obraz OK");
  const js = markdownToHtml("![a](javascript:alert(1))");
  assert.ok(!js.includes("<img"), "javascript: obraz NIE renderowany jako <img>");
});

test("link markdown: http(s) i relatywny OK; javascript: i data: zablokowane", () => {
  assert.ok(markdownToHtml("[t](https://x.io)").includes('<a class="md-link" href="https://x.io"'), "http(s) link OK");
  assert.ok(markdownToHtml("[t](/tasks/all)").includes('href="/tasks/all"'), "relatywny link OK");
  const js = markdownToHtml("[t](javascript:alert(1))");
  assert.ok(!/href="javascript:/i.test(js), "javascript: link zablokowany");
  assert.ok(!js.includes("<a "), "javascript: nie tworzy anchora");
  const data = markdownToHtml("[t](data:text/html;base64,xxx)");
  assert.ok(!/href="data:/i.test(data), "data: link zablokowany");
});

test('href nie da się wyłamać cudzysłowem (atrybut injection)', () => {
  const html = markdownToHtml('[t](https://a"onmouseover=alert(1))');
  assert.ok(!/a"onmouseover/i.test(html), "surowy \" w href musi być zakodowany (%22)");
});

test("blok kodu escapuje także > (wierny zapis)", () => {
  const html = markdownToHtml("```\n<b>x</b>\n```");
  assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;"), "kod escapuje <, >");
  assert.ok(html.includes("md-code-block"), "blok kodu renderowany");
});

test("tabela, nagłówki, pogrubienie renderują się", () => {
  assert.ok(markdownToHtml("| a | b |\n|---|---|\n| 1 | 2 |").includes('<table class="md-table">'), "tabela");
  assert.ok(markdownToHtml("# Tytuł").includes('<h1 class="md-h1">'), "h1");
  assert.ok(markdownToHtml("**x**").includes("<strong>x</strong>"), "bold");
});
