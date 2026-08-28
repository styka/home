"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/platform/db/prisma";
import { requireAuth } from "@/platform/auth/serverUtils";
import { chatComplete, type ContentPart } from "@/platform/llm/chat";
import { parseJsonLoose } from "@/platform/llm/json";
import { usageFromChat, type AiUsageInfo } from "@/platform/ai/usage";
import { visibleUsage } from "@/platform/ai/costVisibility";
import { hashInputs, rememberedContent } from "@/platform/ai/contentMemory";
import { resolveSectionMode } from "@/platform/ai/sectionModeResolver";
import { buildUserContext, userContextStamp } from "@/lib/userContext";
import { SUFIT_LISTY } from "@/platform/pagination";
import { createTask } from "@/modules/tasks/contract";
import { assertPlantAccess } from "./rosliny";
import { assertSpaceAccess } from "./przestrzenie";
import { prognozaDlaPrzestrzeni } from "../lib/pogoda";
import { etykietaFazy } from "../lib/fenologia";
import type { PewnoscDiagnozy, RodzajZabiegu, TrybPrzestrzeni } from "../lib/typy";

/** Rodzaje zabiegu, które model może zaproponować w zaleceniu — sprawdzane przed zapisem. */
const RODZAJE_ZABIEGU = [
  "WATERING", "FERTILIZING", "PRUNING", "REPOTTING", "SPRAYING", "MULCHING", "SOWING", "HARVEST", "CUSTOM",
] as const;

/**
 * 113 — CZTERY ZASTOSOWANIA MODELU W MODULE ROŚLINY.
 *
 * To nie jest jedna funkcja z czterema promptami: każde zastosowanie jest innym **typem operacji**
 * w rozumieniu konfiguracji modeli (C-40), a dwa z nich mają zupełnie inny stosunek do pamięci
 * treści:
 *
 * | funkcja | operacja | pamięć |
 * |---|---|---|
 * | identyfikacja ze zdjęcia | `vision` | **na żądanie** — każde zdjęcie jest inne |
 * | diagnoza ze zdjęcia | `vision` | **na żądanie** — klik JEST prośbą |
 * | plan sezonu | `reasoning` | **pamiętana** — treść do czytania |
 * | wnioski o przestrzeni | `reasoning` | **pamiętana** — treść do czytania |
 *
 * **Diagnoza z kontekstem to jedyny powód, dla którego ta funkcja jest tu lepsza niż w obcej
 * aplikacji.** Żółty liść to może być przelanie, niedobór azotu, przesuszenie albo naturalne
 * starzenie — samo zdjęcie tego nie rozstrzyga. Rozstrzyga zdjęcie PLUS historia podlewania, pora
 * roku i miejsce. Omnia tę historię ma; samodzielna aplikacja od zdjęć jej nie ma
 * (`badania.md`, poziom 4).
 *
 * **Model musi móc powiedzieć „nie wiem".** Model, który zawsze nazywa chorobę, doprowadzi do
 * opryskania zdrowej rośliny — dlatego `pewnosc: "unknown"` jest w prompcie wymieniona jako
 * dopuszczalna odpowiedź, a nie traktowana jako porażka (AC-19).
 */

// ─── Identyfikacja ────────────────────────────────────────────────────────────

export interface PropozycjaGatunku {
  namePl: string;
  nameLatin: string;
  pewnosc: PewnoscDiagnozy;
  uzasadnienie: string | null;
  /** Klucz w katalogu systemowym, jeśli udało się dopasować — wtedy dodanie jest jednym kliknięciem. */
  catalogKey: string | null;
}

export interface WynikIdentyfikacji {
  propozycje: PropozycjaGatunku[];
  usage: AiUsageInfo | null;
}

const PROMPT_IDENTYFIKACJA = `Jesteś botanikiem rozpoznającym rośliny ze zdjęcia.
Zwróć TYLKO JSON: {"propozycje":[{"namePl":"...","nameLatin":"...","pewnosc":"low|medium|high|unknown","uzasadnienie":"..."}]}
Zasady: maksymalnie 3 propozycje, uporządkowane od najbardziej prawdopodobnej.
Nazwy polskie i łacińskie podawaj w formie używanej w polskiej literaturze ogrodniczej.
Uzasadnienie to jedno zdanie o cechach widocznych na zdjęciu (kształt liścia, ulistnienie, pokrój).
Jeśli zdjęcie nie pozwala rozpoznać rośliny, zwróć jedną propozycję z "pewnosc":"unknown"
i uzasadnieniem, czego brakuje na zdjęciu. NIE zgaduj na siłę.`;

export async function identifyPlant(zdjecieUrl: string): Promise<WynikIdentyfikacji> {
  await requireAuth();
  if (!zdjecieUrl) throw new Error("Podaj zdjęcie rośliny");

  const r = await chatComplete({
    op: "vision",
    json: true,
    messages: [
      { role: "system", content: PROMPT_IDENTYFIKACJA },
      {
        role: "user",
        content: [
          { type: "text", text: "Rozpoznaj tę roślinę." },
          { type: "image_url", image_url: { url: zdjecieUrl } },
        ],
      },
    ],
  });

  // `ChatResult` jest unią: brak konfiguracji modelu albo błąd dostawcy nie ma pola `content`.
  // Milczące potraktowanie tego jak pustej odpowiedzi dałoby „nie rozpoznano" zamiast informacji,
  // że model w ogóle nie odpowiedział — dlatego mówimy o tym wprost.
  if (!r.ok) throw new Error(r.message);
  const parsed = parseJsonLoose<{ propozycje?: PropozycjaGatunku[] }>(r.content) ?? {};
  const propozycje = (parsed.propozycje ?? []).slice(0, 3);

  // Dopasowanie do katalogu robimy JEDNYM zapytaniem po nazwach łacińskich. Bez tego użytkownik
  // dostawałby nazwę, którą musiałby przepisać ręcznie do wyszukiwarki katalogu.
  const laciny = propozycje.map((p) => p.nameLatin).filter(Boolean);
  const wKatalogu = laciny.length
    ? await prisma.plantSpeciesCatalog.findMany({
        take: SUFIT_LISTY,
        where: { nameLatin: { in: laciny } },
        select: { key: true, nameLatin: true },
      })
    : [];
  const klucze = new Map(wKatalogu.map((w) => [w.nameLatin, w.key]));

  return {
    propozycje: propozycje.map((p) => ({
      namePl: p.namePl,
      nameLatin: p.nameLatin,
      pewnosc: (["low", "medium", "high", "unknown"] as const).includes(p.pewnosc) ? p.pewnosc : "unknown",
      uzasadnienie: p.uzasadnienie ?? null,
      catalogKey: klucze.get(p.nameLatin) ?? null,
    })),
    usage: (await visibleUsage(usageFromChat([{ res: r, label: "Rozpoznanie rośliny", op: "vision" }]))) ?? null,
  };
}

// ─── Diagnoza ─────────────────────────────────────────────────────────────────

export interface Zalecenie {
  /** `naturalne` → `biologiczne` → `chemiczne` — kolejność jest częścią odpowiedzi, nie sortowaniem. */
  rodzaj: "naturalne" | "biologiczne" | "chemiczne";
  tresc: string;
  /** Rodzaj zabiegu do zaplanowania jednym kliknięciem, jeśli zalecenie da się na to przełożyć. */
  zabieg: string | null;
}

export interface WynikDiagnozy {
  eventId: string;
  diagnoza: string;
  pewnosc: PewnoscDiagnozy;
  zalecenia: Zalecenie[];
  usage: AiUsageInfo | null;
}

const PROMPT_DIAGNOZA = `Jesteś fitopatologiem oceniającym stan rośliny na podstawie zdjęcia i kontekstu uprawy.
Zwróć TYLKO JSON: {"diagnoza":"...","pewnosc":"low|medium|high|unknown","zalecenia":[{"rodzaj":"naturalne|biologiczne|chemiczne","tresc":"...","zabieg":"WATERING|FERTILIZING|PRUNING|REPOTTING|SPRAYING|MULCHING|null"}]}
Zasady:
- KONTEKST jest ważniejszy niż samo zdjęcie: żółknący liść przy podlewaniu co 3 dni zimą to zwykle przelanie, a nie choroba.
- "pewnosc":"unknown" jest PEŁNOPRAWNĄ odpowiedzią. Jeśli zdjęcie i kontekst nie wystarczają, powiedz to wprost i napisz, czego brakuje. Nie zgaduj choroby.
- Zalecenia uporządkuj od naturalnych, przez biologiczne, po chemiczne. Maksymalnie 4.
- Środek chemiczny proponuj tylko wtedy, gdy łagodniejsze nie wystarczą, i dopisz, że jego użycie w uprawie zawodowej podlega ewidencji zabiegów.
- Pisz po polsku, zwięźle, bez markdown.`;

export async function diagnosePlant(data: { plantId: string; zdjecieUrl?: string | null; objaw?: string | null }): Promise<WynikDiagnozy> {
  const user = await requireAuth();
  await assertPlantAccess(data.plantId, user.id, true);

  const roslina = await prisma.plant.findUnique({
    where: { id: data.plantId },
    select: {
      id: true,
      name: true,
      stage: true,
      customSpecies: true,
      spaceId: true,
      space: { select: { kind: true, name: true, weatherLocationId: true } },
      place: { select: { name: true, sun: true, soil: true } },
      species: { select: { namePl: true, nameLatin: true, light: true, soil: true } },
    },
  });
  if (!roslina) throw new Error("Roślina nie istnieje");

  // Kontekst ograniczony do 10 ostatnich zdarzeń i jednej prognozy — pełna historia rośliny
  // rosłaby bez ograniczeń i to ona, a nie zdjęcie, zdominowałaby koszt zapytania.
  const [zdarzenia, prognoza] = await Promise.all([
    prisma.plantCareEvent.findMany({
      take: 10,
      where: { plantId: data.plantId },
      select: { kind: true, occurredAt: true, outcome: true, productName: true },
      orderBy: { occurredAt: "desc" },
    }),
    prognozaDlaPrzestrzeni(roslina.space.weatherLocationId),
  ]);

  const tryb = roslina.space.kind as TrybPrzestrzeni;
  const kontekst = [
    `Roślina: ${roslina.name}`,
    `Gatunek: ${roslina.species?.namePl ?? roslina.customSpecies ?? "nieznany"}${roslina.species?.nameLatin ? ` (${roslina.species.nameLatin})` : ""}`,
    `Przestrzeń: ${roslina.space.name} (tryb: ${tryb})`,
    roslina.place ? `Miejsce: ${roslina.place.name}, nasłonecznienie: ${roslina.place.sun}${roslina.place.soil ? `, podłoże: ${roslina.place.soil}` : ""}` : null,
    roslina.stage ? `Faza rozwojowa: ${etykietaFazy(roslina.stage, tryb)}` : null,
    zdarzenia.length
      ? `Ostatnie zabiegi: ${zdarzenia.map((z) => `${z.occurredAt.toISOString().slice(0, 10)} ${z.kind}${z.outcome !== "DONE" ? ` (${z.outcome})` : ""}${z.productName ? ` — ${z.productName}` : ""}`).join("; ")}`
      : "Brak odnotowanych zabiegów.",
    prognoza.length
      ? `Pogoda najbliższych dni: ${prognoza.map((p) => `${p.date}: ${Math.round(p.tMin)}–${Math.round(p.tMax)}°C, opad ${p.precipSum} mm`).join("; ")}`
      : null,
    data.objaw ? `Opis użytkownika: ${data.objaw}` : null,
    await buildUserContext(user.id),
  ]
    .filter(Boolean)
    .join("\n");

  const tresc: ContentPart[] = [{ type: "text", text: kontekst }];
  if (data.zdjecieUrl) tresc.push({ type: "image_url", image_url: { url: data.zdjecieUrl } });

  const r = await chatComplete({
    op: "vision",
    json: true,
    userId: user.id,
    messages: [
      { role: "system", content: PROMPT_DIAGNOZA },
      { role: "user", content: tresc },
    ],
  });

  if (!r.ok) throw new Error(r.message);
  const parsed = parseJsonLoose<{ diagnoza?: string; pewnosc?: PewnoscDiagnozy; zalecenia?: Zalecenie[] }>(r.content) ?? {};
  const pewnosc: PewnoscDiagnozy = (["low", "medium", "high", "unknown"] as const).includes(parsed.pewnosc as PewnoscDiagnozy)
    ? (parsed.pewnosc as PewnoscDiagnozy)
    : "unknown";
  const zalecenia = (parsed.zalecenia ?? []).slice(0, 4);

  // Diagnoza zapisuje się jako zdarzenie zdrowotne ZAWSZE, także gdy model odpowiedział „nie wiem".
  // Historia „pytałem i nie dało się rozstrzygnąć" jest informacją, a nie brakiem informacji.
  const zdarzenie = await prisma.plantHealthEvent.create({
    data: {
      plantId: data.plantId,
      source: "ai",
      symptom: data.objaw ?? null,
      diagnosis: parsed.diagnoza ?? null,
      confidence: pewnosc,
      recommendationJson: JSON.stringify(zalecenia),
      photoUrl: data.zdjecieUrl ?? null,
    },
    select: { id: true },
  });

  revalidatePath(`/rosliny/${roslina.spaceId}/roslina/${data.plantId}`);

  return {
    eventId: zdarzenie.id,
    diagnoza: parsed.diagnoza ?? "Nie udało się rozstrzygnąć na podstawie tego, co widać.",
    pewnosc,
    zalecenia,
    usage: (await visibleUsage(usageFromChat([{ res: r, label: "Diagnoza rośliny", op: "vision" }]))) ?? null,
  };
}

/**
 * Odnotowuje, czy zalecenie pomogło. Bez tego cała diagnostyka jest jednorazowa i niczego nie uczy.
 *
 * **Nazwa nie zaczyna się od `resolve` celowo.** Bramka `check:ai-coverage` traktuje przedrostki
 * `assert|ensure|find|preview|describe|has|is|count|resolve|read` jako pomocniki wewnętrzne i
 * pomija je przy klasyfikacji. Akcja użytkownika nazwana `resolveHealthEvent` wypadałaby więc
 * z manifestu pokrycia **po cichu** — czyli dokładnie tak, jak wygląda luka, której ta bramka ma
 * zapobiegać.
 */
export async function markHealthOutcome(eventId: string, outcome: "helped" | "no_change" | "worse"): Promise<void> {
  const user = await requireAuth();
  const zdarzenie = await prisma.plantHealthEvent.findUnique({
    where: { id: eventId },
    select: { plantId: true, plant: { select: { spaceId: true } } },
  });
  if (!zdarzenie) throw new Error("Zdarzenie nie istnieje");
  await assertPlantAccess(zdarzenie.plantId, user.id, true);

  await prisma.plantHealthEvent.update({
    where: { id: eventId },
    data: { outcome, resolvedAt: new Date() },
  });

  revalidatePath(`/rosliny/${zdarzenie.plant.spaceId}/roslina/${zdarzenie.plantId}`);
}

// ─── Plan sezonu i wnioski (treść PAMIĘTANA) ─────────────────────────────────

export interface PozycjaPlanu {
  miesiac: string;
  tytul: string;
  opis: string;
}

export interface TrescAI<T> {
  value: T;
  generatedAt: string | null;
  stale: boolean;
  fromMemory: boolean;
  pending: boolean;
  mode: string;
  usage: AiUsageInfo | null;
}

const PROMPT_PLAN = `Jesteś doradcą ogrodniczym planującym sezon dla KONKRETNEGO miejsca i konkretnej osoby.
Zwróć TYLKO JSON: {"pozycje":[{"miesiac":"marzec","tytul":"...","opis":"..."}]}
Zasady:
- Plan ma dotyczyć TEGO, co użytkownik już ma, i TEGO miejsca — nie jest przepisanym poradnikiem.
- Uwzględnij historię: jeśli coś w tym miejscu padło albo rosło tam w poprzednich sezonach, powiedz o tym.
- Maksymalnie 10 pozycji, uporządkowanych chronologicznie, każda z konkretnym działaniem.
- Opis to 1–2 zdania. Pisz po polsku, bez markdown.`;

/**
 * Plan sezonu dla przestrzeni.
 *
 * `hashInputs` niesie lokalizację, tryb, miesiąc, listę gatunków i odcisk wiedzy o użytkowniku —
 * czyli wszystko, czego zmiana powinna zapalić znacznik „nieaktualne". Bez `userContextStamp`
 * zmiana faktu o użytkowniku nie odświeżałaby planu, choć prompt ją zawiera.
 */
export async function getSeasonPlan(spaceId: string, force = false): Promise<TrescAI<PozycjaPlanu[]>> {
  const user = await requireAuth();
  await assertSpaceAccess(spaceId, user.id);

  const przestrzen = await prisma.plantSpace.findUnique({
    where: { id: spaceId },
    select: { name: true, kind: true, weatherLocationId: true },
  });
  if (!przestrzen) throw new Error("Przestrzeń nie istnieje");

  const rosliny = await prisma.plant.findMany({
    take: SUFIT_LISTY,
    where: { spaceId },
    select: {
      name: true,
      status: true,
      statusReason: true,
      customSpecies: true,
      place: { select: { name: true, sun: true } },
      species: { select: { namePl: true, family: true } },
    },
    orderBy: { name: "asc" },
  });

  const mode = await resolveSectionMode(user.id, "rosliny.planSezonu");
  const miesiac = new Date().toISOString().slice(0, 7);

  const wynik = await rememberedContent<PozycjaPlanu[]>({
    ownerId: user.id,
    kind: "rosliny.planSezonu",
    scopeKey: spaceId,
    inputHash: hashInputs(
      przestrzen.kind,
      przestrzen.weatherLocationId ?? "",
      miesiac,
      rosliny.map((r) => `${r.species?.namePl ?? r.customSpecies ?? r.name}|${r.status}`).sort().join(","),
      await userContextStamp(user.id),
    ),
    force,
    mode,
    generate: async () => {
      const prognoza = await prognozaDlaPrzestrzeni(przestrzen.weatherLocationId);
      const kontekst = [
        `Przestrzeń: ${przestrzen.name} (tryb: ${przestrzen.kind})`,
        `Bieżący miesiąc: ${miesiac}`,
        rosliny.length
          ? `Rośliny: ${rosliny.map((r) => `${r.name} (${r.species?.namePl ?? r.customSpecies ?? "gatunek nieznany"}, ${r.status}${r.statusReason ? `: ${r.statusReason}` : ""}${r.place ? `, ${r.place.name}/${r.place.sun}` : ""})`).join("; ")}`
          : "Przestrzeń jest jeszcze pusta.",
        prognoza.length
          ? `Pogoda najbliższych dni: ${prognoza.map((p) => `${p.date}: ${Math.round(p.tMin)}–${Math.round(p.tMax)}°C`).join("; ")}`
          : null,
        await buildUserContext(user.id),
      ]
        .filter(Boolean)
        .join("\n");

      const r = await chatComplete({
        op: "reasoning",
        json: true,
        userId: user.id,
        messages: [
          { role: "system", content: PROMPT_PLAN },
          { role: "user", content: kontekst },
        ],
      });
      // Brak konfiguracji modelu nie może zostać zapamiętany jako „plan jest pusty" — pamięć
      // treści oddawałaby ten pusty wynik przy każdym wejściu, także po naprawieniu konfiguracji.
      if (!r.ok) throw new Error(r.message);
      const parsed = parseJsonLoose<{ pozycje?: PozycjaPlanu[] }>(r.content) ?? {};
      return { value: (parsed.pozycje ?? []).slice(0, 10), usage: usageFromChat([{ res: r, label: "Plan sezonu", op: "reasoning" }]) };
    },
  });

  if (wynik.pending) {
    return { value: [], generatedAt: null, stale: false, fromMemory: false, pending: true, mode, usage: null };
  }

  return {
    value: wynik.value,
    generatedAt: wynik.generatedAt,
    stale: wynik.stale,
    fromMemory: wynik.fromMemory,
    pending: false,
    mode,
    usage: (await visibleUsage(wynik.usage)) ?? null,
  };
}

export interface WnioskiPrzestrzeni {
  wnioski: string[];
  liczbaAktywnych: number;
  liczbaZakonczonych: number;
  przezywalnosc: number | null;
}

const PROMPT_WNIOSKI = `Jesteś doradcą ogrodniczym podsumowującym, co dzieje się w przestrzeni roślinnej użytkownika.
Zwróć TYLKO JSON: {"wnioski":["...", "..."]}
Zasady: maksymalnie 4 wnioski, każdy jedno zdanie do 160 znaków.
Najcenniejszy wniosek to ten, który POPRAWIA użytkownika — jeśli w powodach zakończenia widać powtarzający się błąd, powiedz o nim wprost i łagodnie.
Nie powtarzaj liczb, które użytkownik i tak widzi; powiedz, co z nich wynika. Po polsku, bez markdown.`;

export async function getSpaceInsights(spaceId: string, force = false): Promise<TrescAI<WnioskiPrzestrzeni>> {
  const user = await requireAuth();
  await assertSpaceAccess(spaceId, user.id);

  const rosliny = await prisma.plant.findMany({
    take: SUFIT_LISTY,
    where: { spaceId },
    select: { name: true, status: true, statusReason: true, species: { select: { namePl: true } } },
  });

  const aktywne = rosliny.filter((r) => r.status === "ACTIVE").length;
  const zakonczone = rosliny.length - aktywne;
  const martwe = rosliny.filter((r) => r.status === "DEAD").length;
  // Przeżywalność liczymy wobec bytów, których los jest ROZSTRZYGNIĘTY. Wliczanie roślin wciąż
  // rosnących zaniżałoby ją tym mocniej, im więcej ktoś ma świeżych nasadzeń.
  const rozstrzygniete = rosliny.filter((r) => r.status === "DEAD" || r.status === "HARVESTED" || r.status === "SOLD").length;
  const przezywalnosc = rozstrzygniete > 0 ? Math.round(((rozstrzygniete - martwe) / rozstrzygniete) * 100) : null;

  const mode = await resolveSectionMode(user.id, "rosliny.wnioski");

  const wynik = await rememberedContent<string[]>({
    ownerId: user.id,
    kind: "rosliny.wnioski",
    scopeKey: spaceId,
    inputHash: hashInputs(
      String(rosliny.length),
      String(aktywne),
      rosliny.map((r) => `${r.status}|${r.statusReason ?? ""}`).sort().join(","),
      await userContextStamp(user.id),
    ),
    force,
    mode,
    generate: async () => {
      const powody = rosliny.filter((r) => r.statusReason).map((r) => `${r.species?.namePl ?? r.name}: ${r.statusReason}`);
      const kontekst = [
        `Roślin aktywnych: ${aktywne}, zakończonych: ${zakonczone}, w tym martwych: ${martwe}.`,
        przezywalnosc !== null ? `Przeżywalność: ${przezywalnosc}%.` : null,
        powody.length ? `Powody zakończenia: ${powody.join("; ")}` : "Brak odnotowanych powodów zakończenia.",
      ]
        .filter(Boolean)
        .join("\n");

      const r = await chatComplete({
        op: "reasoning",
        json: true,
        userId: user.id,
        messages: [
          { role: "system", content: PROMPT_WNIOSKI },
          { role: "user", content: kontekst },
        ],
      });
      if (!r.ok) throw new Error(r.message);
      const parsed = parseJsonLoose<{ wnioski?: string[] }>(r.content) ?? {};
      return { value: (parsed.wnioski ?? []).slice(0, 4), usage: usageFromChat([{ res: r, label: "Wnioski o przestrzeni", op: "reasoning" }]) };
    },
  });

  const liczby = { liczbaAktywnych: aktywne, liczbaZakonczonych: zakonczone, przezywalnosc };

  if (wynik.pending) {
    return {
      value: { wnioski: [], ...liczby },
      generatedAt: null,
      stale: false,
      fromMemory: false,
      pending: true,
      mode,
      usage: null,
    };
  }

  return {
    value: { wnioski: wynik.value, ...liczby },
    generatedAt: wynik.generatedAt,
    stale: wynik.stale,
    fromMemory: wynik.fromMemory,
    pending: false,
    mode,
    usage: (await visibleUsage(wynik.usage)) ?? null,
  };
}


// ─── Wyjścia z treści AI do reszty aplikacji ─────────────────────────────────

/**
 * Wysyła pozycję planu sezonu do Zadań (AC-20).
 *
 * Idzie przez **kontrakt Zadań**, tą samą drogą, którą Pogoda dopisuje swoje pomysły — moduł nie
 * zna ani projektów, ani reguły ich wyboru. Bez tego plan byłby tekstem do przeczytania i zapomnienia:
 * pozycja, której nie da się nigdzie zapisać, nie zmienia niczyjego tygodnia.
 */
export async function planToTask(spaceId: string, pozycja: PozycjaPlanu): Promise<void> {
  const user = await requireAuth();
  await assertSpaceAccess(spaceId, user.id);

  const tytul = pozycja.tytul?.trim();
  if (!tytul) throw new Error("Pozycja planu nie ma tytułu");

  await createTask({
    title: tytul,
    // Miesiąc zostaje w opisie, a nie staje się terminem: plan mówi „w marcu", a nie „1 marca",
    // i zamiana tego na konkretną datę byłaby zmyśleniem precyzji, której model nie podał.
    description: [pozycja.miesiac ? `Plan sezonu — ${pozycja.miesiac}` : null, pozycja.opis]
      .filter(Boolean)
      .join("\n\n"),
  });

  revalidatePath("/tasks");
}

/**
 * Zakłada zabieg opieki wynikający z zalecenia diagnozy (AC-19).
 *
 * Diagnoza kończąca się samym tekstem jest poradą; diagnoza kończąca się zaplanowanym zabiegiem
 * jest działaniem. `rodzajZabiegu` bierzemy z odpowiedzi modelu, ale **sprawdzamy go wobec unii** —
 * model potrafi zwrócić nazwę spoza listy, a wtedy lądujemy na „inny zabieg" zamiast rzucać.
 */
export async function scheduleRecommendedCare(data: {
  plantId: string;
  rodzajZabiegu?: string | null;
  tytul: string;
}): Promise<{ id: string }> {
  const user = await requireAuth();
  await assertPlantAccess(data.plantId, user.id, true);

  const roslina = await prisma.plant.findUnique({
    where: { id: data.plantId },
    select: { spaceId: true },
  });
  if (!roslina) throw new Error("Roślina nie istnieje");

  const { createCareTask } = await import("./opieka");
  const rodzaj = (RODZAJE_ZABIEGU as readonly string[]).includes(data.rodzajZabiegu ?? "")
    ? (data.rodzajZabiegu as RodzajZabiegu)
    : "CUSTOM";

  return createCareTask({
    spaceId: roslina.spaceId,
    plantId: data.plantId,
    kind: rodzaj,
    title: data.tytul.trim() || "Zabieg z zalecenia",
  });
}
