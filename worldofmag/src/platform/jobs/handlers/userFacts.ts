// 039: wnioskowanie faktów o użytkowniku z jego zachowań w aplikacji.
//
// Czytamy tylko to, co użytkownik SAM zrobił. Nie zaglądamy w treści (notatki, zdrowie, finanse) —
// nie dlatego, że technicznie się nie da, ale dlatego, że profil budowany z takich danych byłby
// czymś, czego użytkownik się nie spodziewa.
//
// 111: SYGNAŁÓW JEST WIĘCEJ, A PRZEBIEG ODPALA SIĘ SAM.
//
// Zgłoszenie właściciela: „myślałem, że wiedza o userze będzie rosła nie tylko gdy user wprost
// odpowie na pytania, ale także z samego wykonywania akcji w aplikacji, a wydaje mi się, że się tu
// nic takiego nie pojawiło".
//
// Miał rację podwójnie. (1) Zadanie było kolejkowane z DOKŁADNIE jednego miejsca w całej aplikacji
// — przycisku „Poszukaj hipotez" — więc nic nie mogło przyrosnąć samo (automat: `platform/wiedza`).
// (2) Sygnały były trzy i wszystkie z dwóch modułów (Pogoda, Wiadomości), a próg wejścia wynosił
// trzy pozycje — konto, które nie używa akurat tych dwóch modułów, nie miało szans go przekroczyć,
// choćby pracowało w aplikacji codziennie.
//
// Doszły więc METADANE działań z kolejnych modułów: nazwy nawyków, projektów zadań i ich grup,
// książek kucharskich i przepisów, talii językowych, warsztatów oraz to, których modułów
// użytkownik faktycznie używa. **Nadal wyłącznie NAZWY i liczby** — świadomie NIE czytamy:
// treści notatek, zdarzeń zdrowotnych, leków, portfela, kontaktów ani wiadomości. Ta lista jest
// tu wypisana wprost, żeby następna osoba dokładająca sygnał wiedziała, gdzie biegnie granica.
//
// Wynik to HIPOTEZY, nie prawdy: zapisujemy je z pewnością „guess"/„likely", a użytkownik potwierdza
// albo odrzuca. Odrzucone wracają do promptu jako „tego nie proponuj ponownie".

import { filtrMoichRekordow, wlasnoscOsobistaDoZapisu } from "@/platform/workspaces/zapis"
import { prisma } from "@/platform/db/prisma";
import { chatComplete } from "@/platform/llm/chat";
import { parseJsonLoose } from "@/platform/llm/json";
import { fingerprintOf } from "@/lib/textKey";
import { usageFromChat, type AiUsageInfo } from "@/platform/ai/usage";
import { JobError, type JobContext } from "@/platform/jobs/types";
import {
  USER_FACT_CATEGORIES,
  parseUserFactCategory,
  parseUserFactConfidence,
} from "@/lib/userFacts";

export interface UserFactsResult {
  /** Ile nowych hipotez zapisaliśmy. */
  added: number;
  usage?: AiUsageInfo;
}

interface InferredFact {
  category?: string;
  text?: string;
  confidence?: string;
  evidence?: string;
}

const SYSTEM =
  "Na podstawie zachowań użytkownika w aplikacji formułujesz krótkie HIPOTEZY o nim — po polsku, " +
  "jedno zdanie każda. Zasady: opieraj się WYŁĄCZNIE na przekazanych zachowaniach i nie zmyślaj; " +
  "nie powtarzaj faktów już znanych ani tych, którym użytkownik zaprzeczył; nie formułuj hipotez " +
  "o zdrowiu, poglądach politycznych, wyznaniu, orientacji ani sytuacji materialnej; jeśli materiał " +
  "jest zbyt ubogi, zwróć pustą listę — to poprawna odpowiedź. Zwróć WYŁĄCZNIE JSON.";

/** 111: `force` = ręczne „Poszukaj hipotez". Klik JEST wyraźną prośbą, więc omija odcisk materiału. */
interface UserFactsPayload {
  force?: boolean;
}

/**
 * 111: ile pozycji materiału musi się uzbierać, żeby w ogóle warto było pytać model.
 *
 * Do 111 próg wynosił trzy i liczył wyłącznie pomysły pogodowe oraz tematy wiadomości. Teraz liczy
 * WSZYSTKIE sygnały, więc może być wyższy, a mimo to łatwiejszy do osiągnięcia dla kogoś, kto
 * używa innych modułów.
 */
const PROG_MATERIALU = 5;

export async function userFactsHandler(
  payload: unknown,
  ctx: JobContext
): Promise<UserFactsResult> {
  if (!ctx.ownerId) throw new JobError("Zadanie bez właściciela", 400);
  const ownerId = ctx.ownerId;
  const force = Boolean((payload as UserFactsPayload | null)?.force);

  /**
   * 111 (recenzja): CZAS PRZEBIEGU ZAPISUJEMY TAKŻE WTEDY, GDY PRZEBIEG PADNIE.
   *
   * Odstęp doby stoi na `factsLastRunAt`, a kandydatem jest też konto **bez wiersza ustawień**
   * (bo brak wiersza znaczy „automat włączony"). Gdyby znacznik powstawał wyłącznie po udanym
   * przebiegu, konto z niedziałającym modelem wracałoby do kolejki **co godzinę** — a gdy awaria
   * jest ZA wywołaniem modelu (nieparsowalna odpowiedź), każda próba byłaby płatna.
   *
   * Zapisujemy sam czas, **bez odcisku**: odcisk znaczy „ten materiał został przerobiony", a nie
   * został. Następny przebieg ma więc spróbować ponownie, tylko nie wcześniej niż za dobę.
   */
  try {
    // Ścieżki powodzenia zapisują znacznik same (`zapiszZnacznik`: czas **i** odcisk).
    return await wnioskuj(ownerId, force, ctx);
  } catch (e) {
    // Awaria: sam czas, żeby nie zapętlić kolejki — bez odciskania materiału, bo nie został
    // przerobiony i następny przebieg ma go zobaczyć jako nowy. Błąd zapisu znacznika nie może
    // przesłonić błędu właściwego.
    await zapiszCzasPrzebiegu(ownerId).catch(() => {});
    throw e;
  }
}

async function wnioskuj(
  ownerId: string,
  force: boolean,
  ctx: JobContext
): Promise<UserFactsResult> {
  ctx.progress?.("Zbieram zachowania…");
  // 079: zadanie w tle nie ma sesji, więc przestrzeń wyliczamy z właściciela zadania.
  const moje = await filtrMoichRekordow(ownerId);
  const [
    ideas,
    topics,
    hiddenTopics,
    habits,
    projects,
    projectGroups,
    cookbooks,
    recipes,
    decks,
    workshops,
    activity,
    known,
  ] = await Promise.all([
    prisma.weatherIdea.findMany({
      where: { ...moje, state: { in: ["saved", "blocked"] } },
      orderBy: { lastSeenAt: "desc" },
      take: 40,
      select: { title: true, state: true, category: true },
    }),
    prisma.newsTopic.findMany({
      where: moje,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { title: true, semanticFilter: true },
    }),
    prisma.newsHiddenTopic.findMany({
      where: moje,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { title: true },
    }),
    // 111: nazwy nawyków mówią, co użytkownik świadomie w sobie ćwiczy — to jeden z najmocniejszych
    // sygnałów o zainteresowaniach, a jednocześnie czysta metadana (nazwa, którą sam wpisał).
    prisma.habit.findMany({
      where: moje,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { name: true, weeklyGoal: true },
    }),
    prisma.taskProject.findMany({
      where: moje,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { name: true },
    }),
    prisma.projectGroup.findMany({
      where: moje,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { name: true },
    }),
    prisma.cookbook.findMany({
      where: moje,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { name: true },
    }),
    prisma.recipe.findMany({
      where: moje,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { title: true },
    }),
    prisma.languageDeck.findMany({
      where: moje,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { name: true },
    }),
    prisma.workshop.findMany({
      where: moje,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { name: true, type: true },
    }),
    // 111: KTÓRYCH MODUŁÓW UŻYWA. Nie treść działań — sam moduł i liczba wejść. To odpowiada wprost
    // na „wiedza ma rosnąć z samego wykonywania akcji w aplikacji", a nie ujawnia, co użytkownik
    // w tych modułach ma.
    prisma.userActivity.groupBy({
      by: ["module"],
      where: { userId: ownerId },
      _count: { module: true },
      orderBy: { _count: { module: "desc" } },
      take: 12,
    }),
    // paginacja: kompletny — dotychczasowe fakty muszą być znane w całości, inaczej wnioskowanie zaproponuje ponownie fakt już odrzucony (039).
    prisma.userFact.findMany({
      where: moje,
      select: { text: true, status: true },
    }),
  ]);

  const saved = ideas.filter((i) => i.state === "saved");
  const blocked = ideas.filter((i) => i.state === "blocked");

  /**
   * 111: ODCISK MATERIAŁU — po nim poznajemy, że od ostatniego przebiegu NIC nie przybyło.
   *
   * Bez tego automat płaciłby za wywołanie modelu w każdej dobie, także takiej, w której użytkownik
   * niczego nie zrobił — a model dostawałby wtedy dokładnie ten sam materiał i produkował albo
   * duplikaty, albo hipotezy z powietrza. Liczby wystarczą: każdy nowy nawyk, projekt czy temat
   * zmienia którąś z nich.
   */
  const odcisk = [
    saved.length,
    blocked.length,
    topics.length,
    hiddenTopics.length,
    habits.length,
    projects.length,
    projectGroups.length,
    cookbooks.length,
    recipes.length,
    decks.length,
    workshops.length,
    activity.reduce((n, a) => n + a._count.module, 0),
    known.length,
  ].join(":");

  const materialu =
    saved.length +
    blocked.length +
    topics.length +
    habits.length +
    projects.length +
    cookbooks.length +
    recipes.length +
    decks.length +
    workshops.length;

  // Za mało materiału = nie ma o czym wnioskować. Wołanie modelu „na wszelki wypadek" kosztowałoby
  // za każdym przebiegiem i produkowało hipotezy z powietrza.
  if (materialu < PROG_MATERIALU) {
    await zapiszZnacznik(ownerId, odcisk);
    return { added: 0 };
  }

  // 111 (AC-6): przebieg automatyczny na niezmienionym materiale kończy się PRZED wywołaniem modelu.
  // Ręczne „Poszukaj hipotez" (`force`) idzie dalej — klik jest wyraźną prośbą użytkownika.
  if (!force && (await czyMaterialBezZmian(ownerId, odcisk))) {
    await zapiszZnacznik(ownerId, odcisk);
    return { added: 0 };
  }

  const behaviour = [
    saved.length ? `Zapisał sobie pomysły: ${saved.map((i) => i.title).join("; ")}` : null,
    blocked.length ? `Odrzucił pomysły: ${blocked.map((i) => i.title).join("; ")}` : null,
    topics.length
      ? `Monitoruje tematy wiadomości: ${topics.map((t) => `${t.title} (${t.semanticFilter})`).join("; ")}`
      : null,
    hiddenTopics.length
      ? `Nie chce propozycji tematów: ${hiddenTopics.map((t) => t.title).join("; ")}`
      : null,
    habits.length
      ? `Prowadzi nawyki: ${habits.map((h) => (h.weeklyGoal ? `${h.name} (${h.weeklyGoal}×/tydz.)` : h.name)).join("; ")}`
      : null,
    projects.length ? `Prowadzi projekty zadań: ${projects.map((p) => p.name).join("; ")}` : null,
    projectGroups.length ? `Grupuje projekty jako: ${projectGroups.map((g) => g.name).join("; ")}` : null,
    cookbooks.length ? `Zbiera książki kucharskie: ${cookbooks.map((c) => c.name).join("; ")}` : null,
    recipes.length ? `Zapisał przepisy: ${recipes.map((r) => r.title).join("; ")}` : null,
    decks.length ? `Uczy się z talii językowych: ${decks.map((d) => d.name).join("; ")}` : null,
    workshops.length
      ? `Prowadzi warsztaty: ${workshops.map((w) => `${w.name} (${w.type})`).join("; ")}`
      : null,
    activity.length
      ? `Najczęściej używa modułów: ${activity.map((a) => `${a.module} (${a._count.module})`).join("; ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const activeKnown = known.filter((k) => k.status === "active").map((k) => k.text);
  const rejectedKnown = known.filter((k) => k.status === "rejected").map((k) => k.text);

  ctx.progress?.("Formułuję hipotezy…");
  const res = await chatComplete({
    op: "reasoning",
    json: true,
    temperature: 0.3,
    maxTokens: 1200,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content:
          `ZACHOWANIA:\n${behaviour}\n\n` +
          (activeKnown.length ? `JUŻ WIEMY (nie powtarzaj):\n- ${activeKnown.join("\n- ")}\n\n` : "") +
          (rejectedKnown.length
            ? `UŻYTKOWNIK TEMU ZAPRZECZYŁ (nie proponuj ponownie):\n- ${rejectedKnown.join("\n- ")}\n\n`
            : "") +
          `Kategorie: ${USER_FACT_CATEGORIES.join(" | ")}.\n` +
          `Zwróć JSON: {"facts":[{"category":"interests","text":"jedno zdanie",` +
          `"confidence":"guess|likely","evidence":"na czym oparta hipoteza"}]}. Maks. 5 pozycji.`,
      },
    ],
  });

  const sink = [{ res, label: "wiedza o użytkowniku" }];
  if (!res.ok) throw new JobError(res.message, res.status);
  if (res.truncated) throw new JobError("Odpowiedź modelu została ucięta.", 502);
  const parsed = parseJsonLoose<{ facts?: InferredFact[] }>(res.content);
  if (parsed == null) throw new JobError("Nie udało się odczytać odpowiedzi modelu.", 502);

  const usage = usageFromChat(sink);
  const rejectedPrints = new Set(rejectedKnown.map((t) => fingerprintOf(t)));

  let added = 0;
  for (const f of (parsed.facts ?? []).slice(0, 5)) {
    const text = f.text?.trim();
    if (!text) continue;
    const fingerprint = fingerprintOf(text);
    // Druga zapora na wypadek, gdyby model zignorował listę zaprzeczeń: odrzuconego faktu nie
    // wskrzeszamy nigdy.
    if (rejectedPrints.has(fingerprint)) continue;
    try {
      await prisma.userFact.create({
        data: {
          ...(await wlasnoscOsobistaDoZapisu(ownerId)),
          category: parseUserFactCategory(f.category),
          text,
          // Model nie ma prawa ogłosić faktu potwierdzonym — potwierdza wyłącznie użytkownik.
          confidence: parseUserFactConfidence(f.confidence === "likely" ? "likely" : "guess"),
          origin: "inferred",
          status: "active",
          evidence: f.evidence?.trim() || null,
          fingerprint,
        },
      });
      added++;
    } catch {
      // Kolizja [ownerId, fingerprint] = ten fakt już znamy (także jako odrzucony). Pomijamy.
    }
  }

  await zapiszZnacznik(ownerId, odcisk);
  return { added, usage };
}

/**
 * 111: czy materiał jest identyczny jak przy ostatnim przebiegu.
 *
 * Brak zapisanych ustawień asystenta znaczy „jeszcze nigdy nie liczyliśmy", czyli materiał JEST
 * zmieniony — pierwszy przebieg musi się odbyć.
 */
async function czyMaterialBezZmian(userId: string, odcisk: string): Promise<boolean> {
  const pref = await prisma.assistantPref.findUnique({
    where: { userId },
    select: { factsStamp: true },
  });
  return pref?.factsStamp === odcisk;
}

/**
 * Znacznik zapisujemy PRZY KAŻDYM zakończonym przebiegu — także takim, który nie wołał modelu.
 *
 * Gdyby zapis szedł wyłącznie po udanym wnioskowaniu, konto z materiałem poniżej progu byłoby
 * wybierane do przemiatania w każdej dobie i za każdym razem liczyło te same zapytania na darmo.
 */
async function zapiszCzasPrzebiegu(userId: string): Promise<void> {
  await prisma.assistantPref.upsert({
    where: { userId },
    create: { userId, factsLastRunAt: new Date() },
    update: { factsLastRunAt: new Date() },
  });
}

async function zapiszZnacznik(userId: string, odcisk: string): Promise<void> {
  await prisma.assistantPref.upsert({
    where: { userId },
    create: { userId, factsStamp: odcisk, factsLastRunAt: new Date() },
    update: { factsStamp: odcisk, factsLastRunAt: new Date() },
  });
}
