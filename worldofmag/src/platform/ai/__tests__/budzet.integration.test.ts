import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 082 (zadanie 27, Faza 5) — BUDŻETY AI.
 *
 * Cztery mechanizmy z rozdz. 11.3 i cztery różne sposoby, w jakie każdy z nich mógłby nie działać.
 * Najważniejszy przypadek jest ostatni: **wyłącznik awaryjny musi zatrzymać także wywołania BEZ
 * zalogowanego użytkownika**. Dawna kontrola budżetu chodziła tylko dla `opts.userId`, więc zadania
 * w tle — odświeżanie wiadomości, OCR dokumentów, generowanie skórek, czyli najdroższe operacje
 * w systemie — przechodziły obok niej. Test woła prawdziwy `chatComplete` z dostawcą wskazującym na
 * adres, którego nie ma: gdyby wyłącznik nie zadziałał, dostalibyśmy 502 po nieudanej próbie sieci,
 * a nie 503 z komunikatem.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const rnd = () => Math.random().toString(36).slice(2, 10);

test(
  "budżety AI: wyłącznik, budżet twardy i miękki, limit miesięczny użytkownika",
  { skip: !HAS_DB && "brak DATABASE_URL", concurrency: false },
  async (t) => {
    const { prisma } = await import("@/platform/db/prisma");
    const {
      AI_KILL_SWITCH_CONFIG_KEY,
      AI_MONTHLY_BUDGET_CONFIG_KEY,
      AI_MONTHLY_BUDGET_HARD_KEY,
      powodWstrzymaniaAI,
      stanBudzetuAI,
      currentMonthUtc,
      getMyAiUsage,
    } = await import("../budzet");
    const { checkAiBudget, recordAiUsage } = await import("../usage");
    const { PLANS } = await import("@/lib/plans");

    const ustaw = async (key: string, value: string) => {
      await prisma.config.upsert({ where: { key }, update: { value }, create: { key, value } });
    };
    const wyczysc = async () => {
      await prisma.config.deleteMany({
        where: { key: { in: [AI_KILL_SWITCH_CONFIG_KEY, AI_MONTHLY_BUDGET_CONFIG_KEY, AI_MONTHLY_BUDGET_HARD_KEY] } },
      });
    };

    const u = await prisma.user.create({ data: { email: `budzet-${rnd()}@test.local` } });

    try {
      await wyczysc();

      await t.test("bez ustawień nic nie wstrzymuje", async () => {
        assert.equal(await powodWstrzymaniaAI(), null, "domyślnie AI musi działać — brak wiersza to nie jest zakaz");
      });

      await t.test("wyłącznik awaryjny wstrzymuje natychmiast", async () => {
        await ustaw(AI_KILL_SWITCH_CONFIG_KEY, "1");
        const powod = await powodWstrzymaniaAI();
        assert.ok(powod && /wyłączony przez administratora/i.test(powod), "komunikat musi tłumaczyć, co się stało");
        await ustaw(AI_KILL_SWITCH_CONFIG_KEY, "0");
        assert.equal(await powodWstrzymaniaAI(), null, "opuszczenie wyłącznika musi przywracać AI");
      });

      await t.test("budżet MIĘKKI nie zatrzymuje — twardy zatrzymuje", async () => {
        // Sedno rozdziału 11.3: sam alarm nie jest budżetem. Rozdzielenie tych dwóch ustawień musi
        // być widoczne w ZACHOWANIU, inaczej „twardy" byłby polem bez znaczenia.
        //
        // Wydatek liczy się z `AiCall`, więc najpierw wstawiamy realny koszt, a budżet ustawiamy
        // NIŻEJ. Bez tego kroku (przy pustej tabeli wydatek = 0) warunek „wydano >= budżet" nigdy
        // nie byłby spełniony i test przechodziłby, nie sprawdzając niczego.
        const wpis = await prisma.aiCall.create({
          data: {
            operationType: "dispatch",
            providerKind: "openai_compat",
            model: "test-model",
            totalTokens: 10,
            costUsd: 0.01,
            latencyMs: 1,
            ok: true,
          },
        });
        try {
          await ustaw(AI_MONTHLY_BUDGET_CONFIG_KEY, "0.005");
          await ustaw(AI_MONTHLY_BUDGET_HARD_KEY, "0");
          const miekki = await stanBudzetuAI();
          assert.ok(miekki.wydanoUsd >= miekki.budzetUsd, "fixture: budżet musi być przekroczony, inaczej test nic nie mierzy");
          assert.equal(miekki.wstrzymane, false, "budżet miękki tylko alarmuje — nie wolno mu zatrzymać asystenta");

          await ustaw(AI_MONTHLY_BUDGET_HARD_KEY, "1");
          const twardy = await stanBudzetuAI();
          assert.equal(twardy.wstrzymane, true, "budżet twardy po przekroczeniu musi zatrzymywać");
          assert.match(twardy.powod ?? "", /budżet/i, "komunikat musi mówić o budżecie, nie wyglądać na awarię");
        } finally {
          await prisma.aiCall.delete({ where: { id: wpis.id } });
          await wyczysc();
        }
      });

      await t.test("limit MIESIĘCZNY użytkownika odmawia, gdy dzienny jeszcze nie", async () => {
        // Reguła, której limit dzienny nie wyraża: „możesz mieć ciężki dzień, ale nie trzydzieści".
        // Zapisujemy zużycie na dzień z tego samego miesiąca, ale NIE dzisiejszy — dzienny licznik
        // jest wtedy pusty, a miesięczny pełny. Bez tego test nie odróżniałby obu limitów.
        const miesiac = currentMonthUtc();
        const innyDzien = `${miesiac}-01` === new Date().toISOString().slice(0, 10) ? `${miesiac}-02` : `${miesiac}-01`;
        await prisma.aiUsage.create({
          data: { userId: u.id, day: innyDzien, requests: 1, tokens: PLANS.free.aiMonthlyTokens },
        });
        const wynik = await checkAiBudget(u.id);
        assert.equal(wynik.ok, false, "przekroczony pułap miesięczny musi odmawiać");
        if (!wynik.ok) {
          assert.match(wynik.message, /miesięczn/i, "komunikat musi wskazywać, KTÓRY limit się wyczerpał");
          assert.ok(wynik.retryAfterSec > 0, "użytkownik musi wiedzieć, kiedy limit się odnowi");
        }
      });

      await t.test("„wykorzystano X z Y” pokazuje dzień i miesiąc osobno", async () => {
        await recordAiUsage(u.id, 1234);
        const z = await getMyAiUsage(u.id);
        assert.equal(z.dzien.requests, 1, "licznik dnia liczy dzisiejsze zapytania");
        assert.equal(z.dzien.tokens, 1234);
        assert.ok(
          z.miesiac.tokens >= PLANS.free.aiMonthlyTokens + 1234,
          "licznik miesiąca musi obejmować także wcześniejsze dni, nie tylko dziś"
        );
        assert.equal(z.miesiac.limitTokens, PLANS.free.aiMonthlyTokens);
      });

      await t.test("wyłącznik działa w `chatComplete` TAKŻE bez zalogowanego użytkownika", async () => {
        const dostawca = await prisma.llmProvider.create({
          data: {
            label: `test-${rnd()}`,
            kind: "openai_compat",
            // Adres, którego nie ma: gdyby wyłącznik nie zadziałał, zobaczylibyśmy błąd sieci (502),
            // a nie komunikat 503. To właśnie odróżnia „sprawdzenie jest" od „sprawdzenie działa".
            baseUrl: "http://127.0.0.1:1/v1",
            apiKey: "test",
            enabled: true,
          },
        });
        // Przypisanie dla `dispatch/standard` zwykle już istnieje (seed), więc je PODMIENIAMY
        // i przywracamy w `finally` — `create` wywracałoby test o unikalny klucz, a `deleteMany`
        // zostawiłoby bazę bez konfiguracji modeli.
        const poprzednie = await prisma.llmAssignment.findUnique({
          where: { operationType_level: { operationType: "dispatch", level: "standard" } },
        });
        await prisma.llmAssignment.upsert({
          where: { operationType_level: { operationType: "dispatch", level: "standard" } },
          update: { providerId: dostawca.id, model: "test-model" },
          create: { operationType: "dispatch", level: "standard", providerId: dostawca.id, model: "test-model" },
        });
        try {
          await ustaw(AI_KILL_SWITCH_CONFIG_KEY, "1");
          const { chatComplete } = await import("@/platform/llm/chat");
          const wynik = await chatComplete({ op: "dispatch", messages: [{ role: "user", content: "test" }] });
          assert.equal(wynik.ok, false);
          if (!wynik.ok) {
            assert.equal(wynik.status, 503, "wyłącznik musi oddać 503, a nie 502 po nieudanej próbie sieci");
            assert.match(wynik.message, /wyłączony przez administratora/i);
          }
        } finally {
          if (poprzednie) {
            await prisma.llmAssignment.update({
              where: { operationType_level: { operationType: "dispatch", level: "standard" } },
              data: { providerId: poprzednie.providerId, model: poprzednie.model },
            });
          } else {
            await prisma.llmAssignment.deleteMany({ where: { providerId: dostawca.id } });
          }
          await prisma.llmProvider.delete({ where: { id: dostawca.id } });
          await wyczysc();
        }
      });
    } finally {
      await wyczysc();
      await prisma.aiUsage.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  }
);
