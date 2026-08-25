import { test } from "node:test";
import assert from "node:assert/strict";
import { naDto, adresFilmu, type WierszFilmu } from "../film";

const WIERSZ: WierszFilmu = {
  id: "1", videoId: "dQw4w9WgXcQ", title: "Tytuł", description: "Opis",
  publishedAt: new Date("2026-08-01T10:00:00.000Z"), thumbnailUrl: null,
  stan: "nowy", transkrypcjaStan: "jest", transkrypcja: "treść",
  ocena: 80, ocenaPowod: "bo tak", channel: { id: "k1", title: "Kanał" },
};

test("maTranskrypcje liczy się z TREŚCI, nie ze stanu", () => {
  assert.equal(naDto(WIERSZ).maTranskrypcje, true);

  // Retencja czyści treść odrzuconych filmów. Gdyby flaga szła ze stanu, widok obiecywałby
  // transkrypcję, której już nie ma.
  const poRetencji = { ...WIERSZ, transkrypcja: null, transkrypcjaStan: "jest" };
  assert.equal(naDto(poRetencji).maTranskrypcje, false, "stan mówi „jest”, ale treści nie ma");

  assert.equal(naDto({ ...WIERSZ, transkrypcja: "" }).maTranskrypcje, false, "pusta treść to brak treści");
});

test("data wychodzi jako tekst ISO, bo DTO przekracza granicę serwer→klient", () => {
  assert.equal(naDto(WIERSZ).publishedAt, "2026-08-01T10:00:00.000Z");
});

test("kanał jest spłaszczony do id i nazwy", () => {
  assert.deepEqual(naDto(WIERSZ).kanal, { id: "k1", title: "Kanał" });
});

test("adres filmu składa się z identyfikatora", () => {
  assert.equal(adresFilmu("dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});
