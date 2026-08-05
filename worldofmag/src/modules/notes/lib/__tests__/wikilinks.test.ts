import { test } from "node:test";
import assert from "node:assert/strict";
import { extractWikilinks, resolveByTitle, outgoingLinks, backlinks, type NoteLike } from "../wikilinks";

const notes: NoteLike[] = [
  { id: "a", title: "Projekt Alfa", content: "Patrz [[Notatki spotkań]] i [[Budżet]]." },
  { id: "b", title: "Notatki spotkań", content: "Linki do [[Projekt Alfa]]." },
  { id: "c", title: "Budżet", content: "Bez linków." },
];

test("extractWikilinks: wyłuskuje i deduplikuje", () => {
  assert.deepEqual(extractWikilinks("[[X]] [[Y]] [[x]]"), ["X", "Y"]); // case-insensitive dedupe
  assert.deepEqual(extractWikilinks("brak linków"), []);
  assert.deepEqual(extractWikilinks(""), []);
});

test("resolveByTitle: dopasowanie case-insensitive", () => {
  assert.equal(resolveByTitle("budżet", notes)?.id, "c");
  assert.equal(resolveByTitle("NIE MA", notes), null);
});

test("outgoingLinks: rozwiązane + nierozwiązane", () => {
  const { resolved, unresolved } = outgoingLinks({ id: "a", title: "Projekt Alfa", content: "[[Budżet]] [[Nieistnieje]]" }, notes);
  assert.deepEqual(resolved.map((n) => n.id), ["c"]);
  assert.deepEqual(unresolved, ["Nieistnieje"]);
});

test("outgoingLinks: nie linkuje do samego siebie", () => {
  const { resolved } = outgoingLinks({ id: "a", title: "Projekt Alfa", content: "[[Projekt Alfa]]" }, notes);
  assert.equal(resolved.length, 0);
});

test("backlinks: notatki linkujące do bieżącej", () => {
  const back = backlinks(notes[0], notes); // do "Projekt Alfa" linkuje "Notatki spotkań"
  assert.deepEqual(back.map((n) => n.id), ["b"]);
});
