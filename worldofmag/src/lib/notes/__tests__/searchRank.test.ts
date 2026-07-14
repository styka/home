import { test } from "node:test";
import assert from "node:assert/strict";
import { noteSearchScore, rankNotesBySearch } from "@/lib/notes/searchRank";

// Z-240 (T-16) — ranking trafności wyszukiwania notatek.

test("puste zapytanie → wynik 0, kolejność bez zmian", () => {
  assert.equal(noteSearchScore({ title: "cokolwiek" }, ""), 0);
  const notes = [{ title: "a" }, { title: "b" }];
  assert.deepEqual(rankNotesBySearch(notes, "   "), notes);
});

test("tytuł waży więcej niż treść", () => {
  const inTitle = noteSearchScore({ title: "Przepis na zupę", content: "x" }, "zupę");
  const inContent = noteSearchScore({ title: "x", content: "Przepis na zupę" }, "zupę");
  assert.ok(inTitle > inContent, `tytuł (${inTitle}) > treść (${inContent})`);
});

test("dopasowanie na początku pola / całe pole bije dopasowanie w środku", () => {
  const whole = noteSearchScore({ title: "zakupy" }, "zakupy");
  const prefix = noteSearchScore({ title: "zakupy tygodniowe" }, "zakupy");
  const middle = noteSearchScore({ title: "lista zakupy do zrobienia" }, "zakupy");
  assert.ok(whole > prefix, "całe pole > prefiks");
  assert.ok(prefix > middle, "prefiks > środek");
});

test("więcej trafień → wyższy wynik (przy tym samym typie dopasowania, z limitem)", () => {
  // Oba to dopasowania „na początku, nie całe pole" — izolujemy wpływ liczby trafień.
  const one = noteSearchScore({ content: "kot biega" }, "kot");
  const many = noteSearchScore({ content: "kot goni kot i kot" }, "kot");
  assert.ok(many > one, `many (${many}) > one (${one})`);
});

test("całe pole == zapytanie bije wiele trafień w środku (dopasowanie dokładne najsilniejsze)", () => {
  const exact = noteSearchScore({ content: "kot" }, "kot");
  const repeated = noteSearchScore({ content: "kot kot kot kot kot" }, "kot");
  assert.ok(exact > repeated, `exact (${exact}) > repeated (${repeated})`);
});

test("brak dopasowania → 0", () => {
  assert.equal(noteSearchScore({ title: "pies", content: "biega" }, "kot"), 0);
});

test("rankNotesBySearch: najtrafniejsze na górze, remisy stabilne", () => {
  const notes = [
    { id: "c", title: "notatka o zakupach", content: "" },   // środek
    { id: "a", title: "zakupy", content: "" },                // całe pole
    { id: "b", title: "zakupy tygodniowe", content: "" },     // prefiks
    { id: "d", title: "coś innego", content: "" },            // brak
  ];
  const ranked = rankNotesBySearch(notes, "zakupy").map((n) => (n as { id: string }).id);
  assert.deepEqual(ranked, ["a", "b", "c", "d"]);
});

test("stabilność: przy równym wyniku zachowana kolejność wejściowa (tie-breaker)", () => {
  const notes = [
    { id: "1", title: "kot pierwszy" },
    { id: "2", title: "kot drugi" },
  ];
  const ranked = rankNotesBySearch(notes, "kot").map((n) => (n as { id: string }).id);
  assert.deepEqual(ranked, ["1", "2"]);
});
