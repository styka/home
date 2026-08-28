import { test } from "node:test";
import assert from "node:assert/strict";
import { wlasnoscDoZapisu } from "@/platform/workspaces/zapis";

/**
 * 113 — ASYSTENT NIE OMIJA UPRAWNIEŃ W MODULE ROŚLINY (AC-23).
 *
 * Bramka `check:ai-access` sprawdza, czy **widać** mechanizm zawężenia. To jest pytanie o obecność,
 * nie o skutek. Ten test pyta o skutek, i to na drodze, którą naprawdę idzie asystent: przez
 * **egzekutor**, a nie przez wywołanie guardu wprost.
 *
 * **Dlaczego to jest tu istotniejsze niż w innych modułach.** Egzekutor tego modułu **wyszukuje
 * zasób po nazwie** („dodaj roślinę do kwiaciarni", „podlałem monsterę"). Wyszukiwanie to jest
 * dokładnie miejsce, w którym łatwo napisać zapytanie po całej tabeli zamiast po zakresie
 * użytkownika — i wtedy asystent widziałby cudze rośliny, choć każdy guard z osobna działa
 * poprawnie. Sprawdzamy więc trzy rzeczy naraz:
 *   1. obcy nie znajdzie cudzej przestrzeni ani rośliny **przez asystenta**,
 *   2. obcy nie zapisze zabiegu przy cudzej roślinie,
 *   3. narzędzia ODCZYTU asystenta nie pokazują cudzych danych.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "asystent w module Rośliny: obcy nie odczyta ani nie zmieni cudzej rośliny",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const { executeRoslinyAction } = await import("../ai/executor");
    const { readTools } = await import("../ai/readTools");
    const { assertPlantAccess } = await import("../actions/rosliny");
    const { ensurePersonalWorkspace } = await import("@/platform/workspaces/sync");

    const wlasciciel = await prisma.user.create({ data: { email: `ar-o-${rnd()}@test.local` } });
    const obcy = await prisma.user.create({ data: { email: `ar-x-${rnd()}@test.local` } });
    for (const u of [wlasciciel, obcy]) await ensurePersonalWorkspace(u.id);

    const nazwaPrzestrzeni = `Kwiaciarnia-${rnd()}`;
    const nazwaRosliny = `Monstera-${rnd()}`;

    const przestrzen = await prisma.plantSpace.create({
      data: { name: nazwaPrzestrzeni, kind: "production", ...(await wlasnoscDoZapisu(wlasciciel.id)) },
    });
    const roslina = await prisma.plant.create({
      data: { name: nazwaRosliny, spaceId: przestrzen.id, ...(await wlasnoscDoZapisu(wlasciciel.id)) },
    });

    try {
      await t.test("narzędzie odczytu pokazuje właścicielowi jego rośliny", async () => {
        const wynik = (await readTools.list_plants({}, wlasciciel.id)) as { nazwa: string }[];
        assert.ok(wynik.some((r) => r.nazwa === nazwaRosliny));
      });

      await t.test("narzędzie odczytu NIE pokazuje obcemu cudzych roślin", async () => {
        const wynik = (await readTools.list_plants({}, obcy.id)) as { nazwa: string }[];
        assert.ok(!wynik.some((r) => r.nazwa === nazwaRosliny), "obcy zobaczył cudzą roślinę przez asystenta");
      });

      await t.test("narzędzie odczytu NIE pokazuje obcemu cudzych przestrzeni", async () => {
        const wynik = (await readTools.list_plant_spaces({}, obcy.id)) as { nazwa: string }[];
        assert.ok(!wynik.some((p) => p.nazwa === nazwaPrzestrzeni), "obcy zobaczył cudzą przestrzeń przez asystenta");
      });

      await t.test("egzekutor nie znajduje cudzej rośliny po nazwie", async () => {
        // Nazwa jest dokładna, więc gdyby wyszukiwanie szło po całej tabeli zamiast po zakresie
        // użytkownika, ta akcja by się UDAŁA — i to jest cała treść tego przypadku.
        await assert.rejects(
          () =>
            executeRoslinyAction(
              { id: "t1", module: "rosliny", description: "", type: "log_plant_care", params: {}, searchQuery: nazwaRosliny },
              obcy.id,
            ),
          /Nie znaleziono rośliny/,
        );
      });

      await t.test("egzekutor nie dopisuje pomiaru do cudzej rośliny", async () => {
        await assert.rejects(
          () =>
            executeRoslinyAction(
              {
                id: "t2",
                module: "rosliny",
                description: "",
                type: "add_plant_measurement",
                params: { rodzaj: "HEIGHT_CM", wartosc: 40 },
                searchQuery: nazwaRosliny,
              },
              obcy.id,
            ),
          /Nie znaleziono rośliny/,
        );
        const pomiary = await prisma.plantMeasurement.count({ where: { plantId: roslina.id } });
        assert.equal(pomiary, 0, "pomiar mimo wszystko powstał — asystent obszedł zawężenie");
      });

      await t.test("egzekutor nie zakłada rośliny w cudzej przestrzeni", async () => {
        await assert.rejects(
          () =>
            executeRoslinyAction(
              {
                id: "t3",
                module: "rosliny",
                description: "",
                type: "create_plant",
                params: { nazwa: "Podrzutek", przestrzen: nazwaPrzestrzeni },
                searchQuery: nazwaPrzestrzeni,
              },
              obcy.id,
            ),
          // Obcy nie ma ŻADNEJ przestrzeni, więc dostaje odmowę już na etapie wyszukiwania —
          // i to jest właściwe zachowanie: cudza przestrzeń nie jest dla niego kandydatem.
          /przestrzeni roślinnej/,
        );
        const wCudzejPrzestrzeni = await prisma.plant.count({ where: { spaceId: przestrzen.id } });
        assert.equal(wCudzejPrzestrzeni, 1, "w cudzej przestrzeni przybyła roślina");
      });

      await t.test("wskazania podane wprost przez klienta nie przechodzą przez cudzą przestrzeń", async () => {
        // Ten przypadek nie idzie przez asystenta, tylko przez SUROWE argumenty Server Action:
        // każde zalogowane konto może je wywołać z dowolnym `parentId`/`placeId`. Klucz obcy
        // sprawdza istnienie wiersza, nie właściciela — bez zawężenia atakujący czytałby nazwę
        // cudzej rośliny jako „rodzica" swojej, a ofiara widziałaby cudzy okaz jako swoje potomstwo.
        const { sprawdzWskazania } = await import("../lib/sharingGuard");
        const mojaPrzestrzen = await prisma.plantSpace.create({
          data: { name: `Parapet-${rnd()}`, kind: "home", ...(await wlasnoscDoZapisu(obcy.id)) },
        });
        const cudzeMiejsce = await prisma.plantPlace.create({
          // Miejsce nie ma własnej własności — wisi na przestrzeni, i to właśnie dlatego zawężenie
          // musi iść przez `space`, a nie przez kolumnę właściciela, której tu nie ma.
          data: { name: `Grzadka-${rnd()}`, spaceId: przestrzen.id, kind: "bed" },
        });
        try {
          await assert.rejects(
            () => sprawdzWskazania(obcy.id, { spaceId: mojaPrzestrzen.id, plantId: roslina.id }),
            /Roślina nie istnieje/,
          );
          await assert.rejects(
            () => sprawdzWskazania(obcy.id, { spaceId: mojaPrzestrzen.id, placeId: cudzeMiejsce.id }),
            /Miejsce nie istnieje/,
          );
          // Bez podanego `spaceId` też nie wolno: zakres to moje przestrzenie i te mi udostępnione.
          await assert.rejects(() => sprawdzWskazania(obcy.id, { plantId: roslina.id }), /Roślina nie istnieje/);
          // Właściciel przechodzi tą samą ścieżką — inaczej test dowodziłby tylko, że funkcja
          // odrzuca wszystko.
          await sprawdzWskazania(wlasciciel.id, { spaceId: przestrzen.id, plantId: roslina.id, placeId: cudzeMiejsce.id });
        } finally {
          await prisma.plantPlace.delete({ where: { id: cudzeMiejsce.id } }).catch(() => {});
          await prisma.plantSpace.delete({ where: { id: mojaPrzestrzen.id } }).catch(() => {});
        }
      });

      await t.test("guard modułu też odmawia — asystent nie jest jedyną linią obrony", async () => {
        await assert.rejects(() => assertPlantAccess(roslina.id, obcy.id), /Brak dostępu/);
      });
    } finally {
      await prisma.plantMeasurement.deleteMany({ where: { plantId: roslina.id } });
      await prisma.plantCareEvent.deleteMany({ where: { spaceId: przestrzen.id } });
      await prisma.plantCareTask.deleteMany({ where: { spaceId: przestrzen.id } });
      await prisma.plant.deleteMany({ where: { spaceId: przestrzen.id } });
      await prisma.plantSpace.delete({ where: { id: przestrzen.id } }).catch(() => {});
      for (const u of [wlasciciel, obcy]) await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
  },
);
