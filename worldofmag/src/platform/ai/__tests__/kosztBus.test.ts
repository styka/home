import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 083 — magistrala kosztu AI. Testujemy REGUŁĘ, nie przeglądarkę: zgłoszenie dociera do
 * subskrybenta, a wypisanie się faktycznie odcina. Bez tego drugiego warunku komponent
 * odmontowany w trakcie generowania trzymałby nasłuch i meldował po swojej śmierci.
 */

// Minimalna atrapa okna — magistrala używa wyłącznie zdarzeń DOM na `window`.
class FakeWindow {
  private sluchacze = new Map<string, ((e: unknown) => void)[]>();
  addEventListener(typ: string, fn: (e: unknown) => void) {
    this.sluchacze.set(typ, [...(this.sluchacze.get(typ) ?? []), fn]);
  }
  removeEventListener(typ: string, fn: (e: unknown) => void) {
    this.sluchacze.set(typ, (this.sluchacze.get(typ) ?? []).filter((f) => f !== fn));
  }
  dispatchEvent(e: { type: string }) {
    for (const fn of this.sluchacze.get(e.type) ?? []) fn(e);
    return true;
  }
}

function zPodstawionymOknem<T>(fn: () => T): T {
  const g = globalThis as unknown as { window?: unknown; CustomEvent?: unknown };
  const poprzednie = g.window;
  const poprzedniCE = g.CustomEvent;
  g.window = new FakeWindow();
  g.CustomEvent = class {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
  try {
    return fn();
  } finally {
    g.window = poprzednie;
    g.CustomEvent = poprzedniCE;
  }
}

test("zgłoszenie dociera do subskrybenta razem z nazwą akcji", async () => {
  const { zglosKoszt, onKoszt } = await import("@/platform/ai/kosztBus");
  zPodstawionymOknem(() => {
    const odebrane: string[] = [];
    const odepnij = onKoszt((z) => odebrane.push(`${z.akcja}:${z.usage.costUsd}`));
    zglosKoszt({ akcja: "Streszczenie wiadomości", usage: { costUsd: 0.0012 } });
    odepnij();
    assert.deepEqual(odebrane, ["Streszczenie wiadomości:0.0012"]);
  });
});

test("po wypisaniu się nasłuch NIE dostaje kolejnych zgłoszeń", async () => {
  const { zglosKoszt, onKoszt } = await import("@/platform/ai/kosztBus");
  zPodstawionymOknem(() => {
    let ile = 0;
    const odepnij = onKoszt(() => { ile += 1; });
    zglosKoszt({ akcja: "A", usage: { costUsd: 1 } });
    odepnij();
    zglosKoszt({ akcja: "A", usage: { costUsd: 1 } });
    assert.equal(ile, 1, "komponent odmontowany w trakcie generowania nie może meldować po śmierci");
  });
});

test("poza przeglądarką zgłoszenie jest ciche, a nasłuch zwraca działającą funkcję odpinającą", async () => {
  const { zglosKoszt, onKoszt } = await import("@/platform/ai/kosztBus");
  // Render serwerowy: `window` nie istnieje. Ani zgłoszenie, ani nasłuch nie mogą rzucić.
  assert.doesNotThrow(() => zglosKoszt({ akcja: "A", usage: { costUsd: 1 } }));
  assert.doesNotThrow(() => onKoszt(() => {})());
});
