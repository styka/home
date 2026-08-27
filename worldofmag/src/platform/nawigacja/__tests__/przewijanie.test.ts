import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  LIMIT_POZYCJI,
  odczytajPozycje,
  oznaczPowrot,
  zapamietajW,
  zapiszPozycje,
  zuzyjPowrot,
  type PozycjaPrzewijania,
} from "../przewijanie";

/** Atrapa pamięci sesji — ta sama sztuczka co w teście historii nawigacji. */
function pamiec(): Storage {
  const dane = new Map<string, string>();
  return {
    getItem: (k: string) => dane.get(k) ?? null,
    setItem: (k: string, v: string) => void dane.set(k, v),
    removeItem: (k: string) => void dane.delete(k),
    clear: () => dane.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

/**
 * `defineProperty`, a nie zwykłe przypisanie: jeden z testów niżej podmienia `window` na akcesor
 * BEZ settera (żeby odtworzyć przeglądarkę rzucającą przy samym dostępie do pamięci). Po nim
 * przypisanie po cichu nic by nie robiło i kolejne testy dziedziczyłyby rzucającą atrapę.
 */
function ustawOkno(okno: unknown): void {
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: okno });
}

beforeEach(() => {
  ustawOkno({ sessionStorage: pamiec() });
  zuzyjPowrot();
});

// ── lista ────────────────────────────────────────────────────────────────────

test("nowa pozycja ląduje na początku listy", () => {
  const lista = zapamietajW(zapamietajW([], "/a", 100), "/b", 200);
  assert.deepEqual(lista.map((w) => w.sciezka), ["/b", "/a"]);
});

test("ponowna wizyta tej samej ścieżki NADPISUJE pozycję, nie dokłada drugiego wpisu", () => {
  const lista = zapamietajW(zapamietajW([], "/a", 100), "/a", 900);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].y, 900);
});

/**
 * Zapisywanie zera dla każdej odwiedzonej strony zapełniłoby listę wpisami bez znaczenia
 * i wypchnęłoby z niej te, po które użytkownik naprawdę wraca.
 */
test("pozycja na samej górze nie jest pamiętana, a istniejący wpis kasuje", () => {
  assert.deepEqual(zapamietajW([], "/a", 0), []);
  const po = zapamietajW(zapamietajW([], "/a", 500), "/a", 0);
  assert.deepEqual(po, []);
});

test("lista nie rośnie ponad limit", () => {
  let lista: PozycjaPrzewijania[] = [];
  for (let i = 0; i < LIMIT_POZYCJI + 5; i++) lista = zapamietajW(lista, `/s${i}`, 100 + i);
  assert.equal(lista.length, LIMIT_POZYCJI);
  // Najstarsze wypadają, najświeższe zostaje pierwsze.
  assert.equal(lista[0].sciezka, `/s${LIMIT_POZYCJI + 4}`);
});

// ── flaga powrotu ────────────────────────────────────────────────────────────

/**
 * 111 (AC-2): flaga jest JEDNORAZOWA. Gdyby została zapalona, każde kolejne wejście na tę ścieżkę
 * — z menu, z odnośnika — przywracałoby pozycję, czyli dokładnie to, czego nie chcemy.
 */
test("flaga powrotu zużywa się przy pierwszym sprawdzeniu", () => {
  oznaczPowrot();
  assert.equal(zuzyjPowrot(), true);
  assert.equal(zuzyjPowrot(), false);
});

test("bez cofnięcia flaga jest opuszczona", () => {
  assert.equal(zuzyjPowrot(), false);
});

// ── pamięć niedostępna (AC-3) ────────────────────────────────────────────────

/**
 * 111 (AC-3): brak pamięci jest stanem POPRAWNYM. `sessionStorage` rzuca w prywatnym oknie części
 * przeglądarek i przy zablokowanych danych witryn — a ten kod stoi w ramie widoku, więc wyjątek
 * stąd wywróciłby każdą stronę naraz.
 */
test("pamięć rzucająca przy samym dostępie nie wywraca odczytu ani zapisu", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    get() {
      return {
        get sessionStorage(): Storage {
          throw new Error("dostęp zablokowany");
        },
      };
    },
  });
  assert.deepEqual(odczytajPozycje(), []);
  assert.doesNotThrow(() => zapiszPozycje([{ sciezka: "/a", y: 100 }]));
});

test("uszkodzony i obcy kształt w pamięci daje pustą listę, nie wyjątek", () => {
  ustawOkno({ sessionStorage: pamiec() });
  window.sessionStorage.setItem("omnia.pozycjePrzewijania", "{nie json");
  assert.deepEqual(odczytajPozycje(), []);

  window.sessionStorage.setItem("omnia.pozycjePrzewijania", JSON.stringify([{ sciezka: "/a" }, 7]));
  assert.deepEqual(odczytajPozycje(), []);
});

test("zapis i odczyt wracają tym samym kształtem", () => {
  ustawOkno({ sessionStorage: pamiec() });
  zapiszPozycje([{ sciezka: "/wiadomosci", y: 1200 }]);
  assert.deepEqual(odczytajPozycje(), [{ sciezka: "/wiadomosci", y: 1200 }]);
});
