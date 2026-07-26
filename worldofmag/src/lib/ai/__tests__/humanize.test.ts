import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { hasTechnicalLeftovers, humanizeAssistantText } from "@/lib/ai/humanize";

describe("humanizeAssistantText — wartości techniczne", () => {
  it("zamienia statusy i priorytety na etykiety z aplikacji (przypadek ze zgłoszenia)", () => {
    const out = humanizeAssistantText("Obie pozycje bez priorytetu (NONE) i w statusie TODO.");
    assert.equal(out, "Obie pozycje bez priorytetu (Brak) i w statusie Do zrobienia.");
  });

  it("zamienia wartości w tabeli markdown", () => {
    const out = humanizeAssistantText("| Priorytet | MEDIUM |\n| Status | IN_PROGRESS |");
    assert.equal(out, "| Priorytet | Średni |\n| Status | W trakcie |");
  });

  it("nie rusza słów pisanych małymi literami ani zwykłego tekstu", () => {
    const text = "Nie mam żadnych todo na dziś, done to done.";
    assert.equal(humanizeAssistantText(text), text);
  });

  it("nie rusza nieznanych akronimów", () => {
    const text = "Załącznik w formacie PDF pobrany z kanału RSS przez API.";
    assert.equal(humanizeAssistantText(text), text);
  });

  it("nie rusza wartości wewnątrz bloku kodu ani wstawki `code`", () => {
    const text = 'Przykład: `status: "TODO"` oraz\n```json\n{"status":"DONE"}\n```';
    assert.equal(humanizeAssistantText(text), text);
  });

  it("zamienia poza blokiem kodu, ale zostawia wnętrze bloku", () => {
    const out = humanizeAssistantText('Status TODO.\n```\nTODO\n```\nPriorytet HIGH.');
    assert.equal(out, "Status Do zrobienia.\n```\nTODO\n```\nPriorytet Wysoki.");
  });
});

describe("humanizeAssistantText — identyfikatory rekordów", () => {
  it("usuwa identyfikator w nawiasie razem z nawiasem", () => {
    const out = humanizeAssistantText("Zadanie A (cmrxo01jm00egksnw1ycs4dq8) ma termin 30.07.");
    assert.equal(out, "Zadanie A ma termin 30.07.");
  });

  it("usuwa identyfikator po myślniku i po „id:”", () => {
    assert.equal(humanizeAssistantText("Zadanie A — cmrxo01jm00egksnw1ycs4dq8"), "Zadanie A");
    assert.equal(humanizeAssistantText("Projekt (id: cmpr6i72800186ljaw4lgtryj) gotowy"), "Projekt gotowy");
  });

  it("usuwa samotny identyfikator i nie zostawia podwójnych spacji", () => {
    const out = humanizeAssistantText("Otwórz cmrwjqfgp00cz7gm325a2ptjw teraz.");
    assert.equal(out, "Otwórz teraz.");
  });

  it("zostawia identyfikator w bloku kodu (diagnostyka admina)", () => {
    const text = "```\nid: cmrxo01jm00egksnw1ycs4dq8\n```";
    assert.equal(humanizeAssistantText(text), text);
  });

  it("nie zjada zwykłych słów zaczynających się na „c”", () => {
    const text = "Cebula, czosnek i cukinia — wszystko kupione.";
    assert.equal(humanizeAssistantText(text), text);
  });
});

describe("humanizeAssistantText — wejścia brzegowe", () => {
  it("radzi sobie z pustym wejściem", () => {
    assert.equal(humanizeAssistantText(""), "");
    assert.equal(humanizeAssistantText(null), "");
    assert.equal(humanizeAssistantText(undefined), "");
  });

  it("hasTechnicalLeftovers wykrywa resztki i milczy po humanizacji", () => {
    const dirty = "Status TODO, id cmrxo01jm00egksnw1ycs4dq8";
    assert.equal(hasTechnicalLeftovers(dirty), true);
    assert.equal(hasTechnicalLeftovers(humanizeAssistantText(dirty)), false);
  });
});
