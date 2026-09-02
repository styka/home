import { prisma } from "@/platform/db/prisma";
import type { PolitykaRetencji } from "@/platform/retention";
import { RETENCJA_WIADOMOSCI } from "@/modules/news/retention";
import { RETENCJA_YOUTUBE } from "@/modules/youtube/retention";
import { RETENCJA_ZAKUPOW } from "@/modules/shopping/retention";
import { RETENCJA_ROSLIN } from "@/modules/rosliny/retention";

/**
 * 083 (zadanie 30, Faza 5) — KORZEŃ KOMPOZYCJI POLITYK RETENCJI.
 *
 * Stoi poza platformą, bo platforma nie może importować modułów (rozdz. 7.1), a dwie polityki
 * opisują dane modułowe. Ten sam układ, co `src/lib/calendarContributors.ts` i
 * `src/lib/dashboardContributors.ts`.
 *
 * Tabela z rozdz. 11.6 przełożona jeden do jednego. Dwa miejsca, w których świadomie doprecyzowano
 * treść rozdziału:
 *   * **`DomainEvent` — „30 dni PO DOSTARCZENIU"**, więc warunek ma dwie części. Kasowanie po samym
 *     wieku zjadałoby zdarzenia, których worker jeszcze nie przetworzył (np. po dłuższej awarii),
 *     a to jest utrata pracy, nie sprzątanie.
 *   * **`AiCall` — „12 mies., agregaty dłużej"**: agregatem jest `AiUsage` (zapytania i tokeny per
 *     użytkownik i dzień) i NIE podlega retencji. Gdyby podlegał, dzienny i miesięczny budżet
 *     straciłby podstawę liczenia.
 */
const RETENCJA_PLATFORMY: PolitykaRetencji[] = [
  {
    klucz: "user_activity",
    etykieta: "Dziennik aktywności użytkownika",
    domyslneDni: 90,
    minimumDni: 7,
    uzasadnienie: "Czytane jest wyłącznie „ostatnie 10 zdarzeń” — starsze wiersze nikomu do niczego nie służą.",
    usun: async (starszeNiz) =>
      (await prisma.userActivity.deleteMany({ where: { createdAt: { lt: starszeNiz } } })).count,
  },
  {
    klucz: "ai_conversations",
    etykieta: "Rozmowy z asystentem AI",
    domyslneDni: 365,
    minimumDni: 30,
    uzasadnienie:
      "Dane osobowe (RODO) — rozmowy sprzed roku trzyma się bez powodu. Kasowanie rozmowy zabiera jej wiadomości kaskadą.",
    // Liczy się `updatedAt`, nie `createdAt`: wątek założony rok temu i używany wczoraj ma zostać.
    usun: async (starszeNiz) =>
      (await prisma.aiConversation.deleteMany({ where: { updatedAt: { lt: starszeNiz } } })).count,
  },
  {
    klucz: "domain_events",
    etykieta: "Zdarzenia domenowe (dostarczone)",
    domyslneDni: 30,
    minimumDni: 7,
    uzasadnienie:
      "To tylko komunikaty. Kasujemy wyłącznie DOSTARCZONE — niedostarczone są pracą do wykonania, nie śmieciem.",
    usun: async (starszeNiz) =>
      (
        await prisma.domainEvent.deleteMany({
          where: { deliveredAt: { not: null }, createdAt: { lt: starszeNiz } },
        })
      ).count,
  },
  {
    klucz: "ai_calls",
    etykieta: "Log wywołań modeli (koszty)",
    domyslneDni: 365,
    minimumDni: 30,
    uzasadnienie:
      "Rozliczenia. Agregaty (`AiUsage`) zostają na zawsze — to na nich stoją budżety dzienny i miesięczny.",
    usun: async (starszeNiz) =>
      (await prisma.aiCall.deleteMany({ where: { createdAt: { lt: starszeNiz } } })).count,
  },
  {
    klucz: "operation_metrics",
    etykieta: "Metryki operacji (percentyle, błędy, konflikty)",
    domyslneDni: 30,
    minimumDni: 7,
    uzasadnienie:
      "Agregat godzinowy służy do wykrywania regresu, a nie do historii — porównuje się go z zeszłym tygodniem, nie z zeszłym rokiem.",
    usun: async (starszeNiz) =>
      (
        await prisma.operationMetric.deleteMany({
          // Kubełek to tekst `YYYY-MM-DDTHH`, więc porównanie leksykograficzne jest tu porównaniem
          // czasu — pod warunkiem tego samego formatu po obu stronach.
          where: { bucket: { lt: starszeNiz.toISOString().slice(0, 13) } },
        })
      ).count,
  },
  {
    klucz: "audit_log",
    etykieta: "Ślad audytowy (RBAC, konfiguracja, dostęp)",
    domyslneDni: 1826, // 5 lat (z jednym dniem przestępnym)
    // Dolna granica jest tu najważniejsza w całym pliku: ślad audytowy ma wymóg pięcioletni,
    // a pole tekstowe bez ograniczenia pozwoliłoby skasować go jedną literówką.
    minimumDni: 1826,
    uzasadnienie: "Wymóg pięcioletni. Wartości niższej nie da się ustawić — granica działa przy ODCZYCIE.",
    usun: async (starszeNiz) =>
      (await prisma.auditLog.deleteMany({ where: { createdAt: { lt: starszeNiz } } })).count,
  },
];

export const POLITYKI_RETENCJI: PolitykaRetencji[] = [
  ...RETENCJA_PLATFORMY,
  ...RETENCJA_WIADOMOSCI,
  ...RETENCJA_YOUTUBE,
  ...RETENCJA_ZAKUPOW,
  ...RETENCJA_ROSLIN,
];
