import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GRUPY_NARZEDZI, idNarzedziPodAdmin, wszystkieNarzedzia } from "../narzedzia";

/**
 * 110 — ZASTĘPSTWO ZA BRAMKĘ i18n DLA KLUCZY PODAWANYCH ZMIENNĄ.
 *
 * `check:i18n` sprawdza wyłącznie wywołania `t("literał")` — musi, bo tylko wtedy zna klucz bez
 * uruchamiania kodu. Spis narzędzi woła `t(narzedzie.kluczNazwy)`, więc dla bramki jest
 * niewidzialny: literówka w kluczu przeszłaby build i wyszła dopiero na ekranie, jako nazwa
 * narzędzia zastąpiona surowym kluczem. Ten test domyka lukę na tym samym poziomie (wzorzec z 109).
 */

const komunikaty = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "messages/pl.json"), "utf8"),
) as Record<string, unknown>;

/** Przestrzeń, w której spis czyta swoje teksty — musi zgadzać się z `useTranslations`. */
const PRZESTRZEN = "components.admin.SpisNarzedziAdmina";

function wartosc(sciezka: string): unknown {
  let biezacy: unknown = komunikaty;
  for (const czesc of sciezka.split(".")) {
    if (typeof biezacy !== "object" || biezacy === null) return undefined;
    biezacy = (biezacy as Record<string, unknown>)[czesc];
  }
  return biezacy;
}

test("każdy klucz tekstu narzędzia istnieje w messages/pl.json", () => {
  for (const narzedzie of wszystkieNarzedzia()) {
    for (const klucz of [narzedzie.kluczNazwy, narzedzie.kluczOpisu, narzedzie.kluczHasel]) {
      const pelny = `${PRZESTRZEN}.${klucz}`;
      assert.equal(
        typeof wartosc(pelny),
        "string",
        `brak klucza ${pelny} — narzędzie „${narzedzie.id}" pokazałoby surowy klucz zamiast nazwy`,
      );
    }
  }
});

test("każda grupa ma nazwę w słowniku", () => {
  for (const grupa of GRUPY_NARZEDZI) {
    const pelny = `${PRZESTRZEN}.${grupa.kluczNazwy}`;
    assert.equal(typeof wartosc(pelny), "string", `brak klucza ${pelny} dla grupy „${grupa.id}"`);
  }
});

test("identyfikatory narzędzi i grup są unikalne", () => {
  const widziane = new Set<string>();
  for (const narzedzie of wszystkieNarzedzia()) {
    assert.ok(!widziane.has(narzedzie.id), `zduplikowany identyfikator narzędzia: ${narzedzie.id}`);
    widziane.add(narzedzie.id);
  }
  const grupy = new Set<string>();
  for (const grupa of GRUPY_NARZEDZI) {
    assert.ok(!grupy.has(grupa.id), `zduplikowany identyfikator grupy: ${grupa.id}`);
    grupy.add(grupa.id);
  }
});

test("pozycja jest ALBO odnośnikiem z adresem, ALBO akcją bez adresu", () => {
  // Unia w typie pilnuje tego przy kompilacji; ten test pilnuje, że dane faktycznie się w nią
  // układają — wcześniej akcja nosiła atrapę `href: "#"`, którą asercja `href.length > 0`
  // zaliczała bez mrugnięcia.
  for (const narzedzie of wszystkieNarzedzia()) {
    assert.match(narzedzie.id, /^[a-z][a-z0-9-]*$/, `identyfikator „${narzedzie.id}" nie nadaje się na segment trasy`);
    if (narzedzie.akcja) {
      assert.equal(narzedzie.href, undefined, `akcja „${narzedzie.id}" nie powinna mieć adresu`);
    } else {
      assert.ok(narzedzie.href.length > 0, `narzędzie „${narzedzie.id}" bez adresu`);
      assert.ok(narzedzie.href.startsWith("/"), `adres „${narzedzie.href}" nie jest ścieżką w aplikacji`);
    }
  }
});

test("dwie trasy, które przed 110 nie miały odnośnika, są w rejestrze", () => {
  // To nie jest ozdoba: `/admin/llm` — konfiguracja dostawców i modeli — nie była podlinkowana
  // z ŻADNEGO miejsca w aplikacji, a `/admin/qa` wyłącznie z modułu QA. Ten test zapisuje, że
  // wejście do nich z panelu jest wymaganiem, a nie przypadkiem.
  const idki = idNarzedziPodAdmin();
  assert.ok(idki.includes("llm"), "brak wejścia do konfiguracji modeli LLM");
  assert.ok(idki.includes("qa"), "brak wejścia do scenariuszy QA");
});

test("pozycje spoza /admin i akcje nie trafiają do zbioru porównywanego z dyskiem", () => {
  // Bramka kompletności porównuje `idNarzedziPodAdmin()` z katalogami na dysku. Moderacja usług
  // mieszka pod `/services/moderation`, a „zgłoś błąd" nie jest odnośnikiem — gdyby weszły do tego
  // zbioru, bramka szukałaby katalogów, których z założenia nie ma.
  const idki = idNarzedziPodAdmin();
  assert.ok(!idki.includes("moderacja"), "moderacja usług nie leży pod /admin");
  assert.ok(!idki.includes("zglos-blad"), "zgłoszenie błędu jest akcją, nie trasą");
  assert.ok(idki.length >= 20, `spodziewamy się co najmniej dwudziestu tras panelu, jest ${idki.length}`);
});

test("każda trasa panelu jest chroniona tym samym uprawnieniem co /admin", async () => {
  // 110: rozbicie panelu na wyrzutnię i przegląd mnoży miejsca do obronienia. Dopasowanie po
  // prefiksie w `legacyPermissionForPath` obejmuje podścieżki — ten test zapisuje to jako REGUŁĘ,
  // a nie przypadek: zamiana `startsWith` na porównanie równością odsłoniłaby wszystkie narzędzia
  // naraz i nie zmieniłaby niczego, co widać na ekranie.
  const { legacyPermissionForPath, PERMISSIONS } = await import("@/platform/auth/permissions");
  assert.equal(legacyPermissionForPath("/admin"), PERMISSIONS.ADMIN);
  assert.equal(legacyPermissionForPath("/admin/przeglad"), PERMISSIONS.ADMIN);
  for (const id of idNarzedziPodAdmin()) {
    assert.equal(legacyPermissionForPath(`/admin/${id}`), PERMISSIONS.ADMIN, `trasa /admin/${id}`);
  }
});
