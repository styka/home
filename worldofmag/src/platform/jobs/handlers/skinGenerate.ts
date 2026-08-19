// 045 — handler: wygeneruj skórkę z opisu słownego. Z `/api/llm/skins/generate`.
//
// Wzorowany na `kitchenGenerateRecipe` (cienka trasa + handler), bo to ta sama klasa
// operacji: jedno wywołanie modelu odpalane KLIKNIĘCIEM, zwracające ustrukturyzowany
// JSON. To nie jest funkcja asystenta czatowego — katalog `AIAction` zostaje nietknięty.

import { chatComplete } from "@/platform/llm/chat";
import { JobError, type JobContext } from "@/platform/jobs/types";
import { usageFromChat } from "@/platform/ai/usage";
import {
  ALL_CONTROLS,
  DEFAULT_DARK_TOKENS,
  validateTokens,
  type SkinTokens,
} from "@/lib/skins";

/**
 * Katalog tokenów dla modelu — GENEROWANY z `ALL_CONTROLS`, nie przepisany ręcznie.
 *
 * To jest istotne: lista tokenów będzie rosła, a prompt przepisany z palca rozjechałby
 * się przy pierwszym nowym tokenie i model po cichu przestałby go ustawiać. Tu rozjazd
 * jest niemożliwy z definicji.
 */
function buildTokenCatalog(): string {
  const lines = ALL_CONTROLS.map((c) => {
    const dflt = DEFAULT_DARK_TOKENS[c.key];
    let allowed: string;
    switch (c.kind) {
      case "color":
        allowed = "kolor #rrggbb";
        break;
      case "scheme":
        allowed = "light | dark";
        break;
      case "font":
      case "keyword":
        allowed = (c.options ?? []).map((o) => o.value).join(" | ");
        break;
      case "radius":
      case "density":
        allowed = "wartość w px, max 3 cyfry (np. 6px), albo 0";
        break;
      case "length":
        allowed = "px, rem albo em (np. 16px, 1.5rem)";
        break;
      case "tracking":
        allowed = "em albo px, może być ujemne (np. 0.08em, -0.01em)";
        break;
      case "number":
        allowed = "liczba bez jednostki (np. 1.5)";
        break;
      case "weight":
        allowed = "100..900 (setki)";
        break;
      case "duration":
        allowed = "ms albo s (np. 120ms, 0.3s)";
        break;
      case "easing":
        allowed = "linear | ease | ease-in | ease-out | ease-in-out | cubic-bezier(a,b,c,d)";
        break;
      case "shadow":
        allowed = "cień CSS; kolory tylko przez rgba()/rgb()/color-mix(); albo none";
        break;
      case "background":
        allowed = "wyłącznie linear-gradient() / radial-gradient() / conic-gradient(); albo none";
        break;
      default:
        allowed = "wartość tekstowa";
    }
    return `- ${c.key} (${c.label}) — ${allowed}; domyślnie: ${dflt}`;
  });
  return lines.join("\n");
}

const RULES = `ZASADY, KTÓRE MUSISZ SPEŁNIĆ (skórka niespełniająca ich jest bezużyteczna):

1. CZYTELNOŚĆ PRZED EFEKTOWNOŚCIĄ. To jest warunek nadrzędny.
   - kontrast --text-primary do --bg-base: co najmniej 7:1
   - kontrast --text-secondary i --text-muted do tła: co najmniej 4.5:1
   - --on-accent dobierz do JASNOŚCI akcentów: na jasnym, nasyconym akcencie (bursztyn,
     limonka, cyjan) MUSI być ciemny, nie biały. Biały tekst na bursztynie daje ~1.9:1
     i jest nie do przeczytania. Wszystkie akcenty muszą działać z JEDNYM --on-accent,
     więc dobierz je tak, by miały zbliżoną jasność.

2. UMIAR. Skórka ma być charakterna, ale nie nachalna:
   - żadnej animacji dłuższej niż 300 ms
   - gradienty i poświaty tylko tam, gdzie budują hierarchię; nie na wszystkim naraz
   - --font-size-base w przedziale 13px–15px
   - --control-height nie mniej niż 32px (cel dotyku)

3. KOMPLETNOŚĆ. Ustaw WSZYSTKIE tokeny z katalogu. Motyw zbudowany z trzech kolorów
   i domyślnej reszty to przemalowane tło, a nie skórka.

4. CHARAKTER BUDUJ NIE TYLKO KOLOREM. Krój (--font-family-display), wersaliki
   i rozstrzelenie nagłówków, stosunek zaokrągleń powierzchni do kontrolek, obecność
   lub brak poświaty — to one odróżniają motywy od siebie.

5. ŻADNYCH ZNAKÓW TOWAROWYCH w "name" i "description". Jeśli użytkownik poda nazwę
   marki lub tytuł dzieła, oddaj ESTETYKĘ, ale nazwij skórkę własnymi słowami.`;

function systemPrompt(): string {
  return `Jesteś projektantem interfejsów. Tworzysz skórkę (motyw) aplikacji Omnia na podstawie opisu po polsku.

Skórka to mapa zmiennych CSS. Oto PEŁNY katalog tokenów, które wolno ustawić — innych nie ma i każdy spoza listy zostanie odrzucony:

${buildTokenCatalog()}

${RULES}

Zwróć WYŁĄCZNIE JSON (bez markdown, bez komentarza) w schemacie:
{
  "name": string,               // krótka, własna nazwa skórki po polsku
  "description": string,        // jedno zdanie o charakterze motywu
  "colorScheme": "light"|"dark",
  "rationale": string,          // 1-2 zdania: jak opis przełożyłeś na decyzje
  "tokens": { "--nazwa-tokenu": "wartość", ... }
}

Jeśli opis nie da się przełożyć na wygląd interfejsu — zwróć {"error":"not-a-theme"}.`;
}

/** 080 (Z10): łącznie tyle podejść do wygenerowania skórki (pierwsze + jedno ponowienie). */
export const SKIN_MAX_ATTEMPTS = 2;

/** Ile nazw kluczy wymieniamy w komunikatach — pełna lista bywa długa i nic nie wnosi. */
const MAX_WYMIENIONYCH = 8;

function wymien(klucze: string[]): string {
  const widoczne = klucze.slice(0, MAX_WYMIENIONYCH).join(", ");
  const reszta = klucze.length - MAX_WYMIENIONYCH;
  return reszta > 0 ? `${widoczne} i ${reszta} więcej` : widoczne;
}

/**
 * 080 (Z10): komunikat korygujący do drugiego podejścia.
 *
 * Pokazujemy modelowi JEGO WŁASNE odrzucone klucze. Powtórzenie tego samego pytania byłoby
 * losowaniem jeszcze raz; pokazanie błędu jest informacją, na której model potrafi się poprawić.
 * Katalog dokładamy ponownie, bo to jedyna lista dopuszczalnych nazw — i jest generowana
 * z `ALL_CONTROLS`, więc nie może się rozjechać z walidacją.
 */
export function korekta(odrzucone: string[]): string {
  const co = odrzucone.length > 0
    ? `Żaden z kluczy, które zwróciłeś, nie przeszedł walidacji: ${wymien(odrzucone)}.`
    : "Nie zwróciłeś ani jednego tokenu.";
  return (
    `${co}\n\n` +
    "Popraw odpowiedź. Klucze MUSZĄ pochodzić dokładnie z poniższego katalogu (co do znaku), " +
    "a wartości muszą mieć podany tam format. Nie wymyślaj własnych nazw i nie tłumacz ich.\n\n" +
    `${buildTokenCatalog()}\n\n` +
    "Zwróć wyłącznie JSON w ustalonym kształcie."
  );
}

/**
 * 080 (Z10): komunikat porażki, który MÓWI, CZEGO ZABRAKŁO.
 *
 * Poprzedni („Model nie zwrócił ani jednego poprawnego tokenu — spróbuj ponownie") nie niósł
 * żadnej informacji diagnostycznej, więc właściciel wymienił klucz API i ponawiał ręcznie,
 * dostając za każdym razem to samo zdanie. Rozróżniamy dwa różne stany: model nie odesłał
 * NICZEGO, a model odesłał klucze, których walidacja nie przyjęła.
 */
export function opisPorazki(przyslanych: number, odrzucone: string[]): string {
  if (przyslanych === 0) {
    return "Model nie odesłał żadnych tokenów — spróbuj opisać skórkę konkretniej (kolory, nastrój, kontrast).";
  }
  return (
    `Model odesłał ${przyslanych} kluczy i żaden nie przeszedł walidacji ` +
    `(${wymien(odrzucone)}). To zwykle nazwy spoza katalogu tokenów albo wartości w złym formacie.`
  );
}

export interface GenerateSkinPayload {
  prompt?: string;
}

export interface GeneratedSkin {
  name: string;
  description: string;
  colorScheme: "light" | "dark";
  rationale: string;
  tokens: SkinTokens;
  /** Klucze, których nie przyjęliśmy — pokazywane użytkownikowi, nie chowane. */
  rejected: string[];
}

export async function skinGenerateHandler(payload: GenerateSkinPayload, ctx: JobContext) {
  const trimmed = payload?.prompt?.trim();
  if (!trimmed) throw new JobError("Opisz, jak ma wyglądać skórka", 400);
  if (trimmed.length > 600) throw new JobError("Opis za długi (max 600 znaków)", 400);

  // 080 (Z10): DWA PODEJŚCIA. Zgłoszenie właściciela („Star Trek" → „Model nie zwrócił ani jednego
  // poprawnego tokenu") pokazało, że jedna nieudana odpowiedź kończyła całą operację, a komunikat
  // nie niósł ani jednej informacji, z którą użytkownik mógłby cokolwiek zrobić — więc ponawiał
  // ręcznie, dostawał to samo i wyglądało to na trwałą awarię.
  //
  // Drugie podejście NIE jest powtórzeniem tego samego pytania: dostaje komunikat korygujący
  // z nazwami kluczy, które właśnie odrzuciliśmy. Najczęstsza przyczyna to nazwy spoza katalogu,
  // a model, któremu pokaże się jego własny błąd, zwykle poprawia go za pierwszym razem.
  const historia: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: trimmed },
  ];

  // Wszystkie wywołania, bo koszt ponowienia też jest kosztem — wskaźnik ma pokazywać prawdę.
  const wywolania: Array<Parameters<typeof usageFromChat>[0][number]> = [];
  let tokens: SkinTokens = {};
  let rejected: string[] = [];
  let parsed: Record<string, unknown> = {};
  let ostatnieOdrzucone = 0;

  for (let podejscie = 1; podejscie <= SKIN_MAX_ATTEMPTS; podejscie++) {
    const result = await chatComplete({
      op: "generation",
      userId: ctx.ownerId ?? undefined,
      messages: historia,
      // Dobór palety to zadanie twórcze — przy niskiej temperaturze model zwraca
      // wariacje tej samej szarości niezależnie od opisu.
      temperature: 0.7,
      maxTokens: 3000,
      json: true,
    });
    if (!result.ok) throw new JobError(result.message, result.status);
    wywolania.push({ res: result, label: podejscie === 1 ? "wygenerowana skórka" : `wygenerowana skórka (podejście ${podejscie})` });

    try {
      const cleaned = (result.content || "{}").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
      parsed = JSON.parse(cleaned);
    } catch {
      throw new JobError("Model zwrócił nieprawidłowy format", 502);
    }

    // Odmowa opisu jest odpowiedzią, nie awarią — ponowienie nie ma czego poprawić.
    if (parsed.error) throw new JobError("Z tego opisu nie wynika wygląd interfejsu — doprecyzuj", 422);

    // MODEL JEST ŹRÓDŁEM RÓWNIE OBCYM JAK CUDZY PLIK. Potrafi „pomocnie" zwrócić
    // url() z obrazkiem tła albo font-family z nazwą czcionki z sieci — jedno i drugie
    // przechodzi tu przez tę samą sanityzację co import. Sanityzacji NIE luzujemy pod
    // żaden opis: to jest bramka bezpieczeństwa (wstrzyknięcie CSS), a nie próg jakości.
    const rawTokens = (parsed.tokens ?? {}) as Record<string, unknown>;
    tokens = validateTokens(rawTokens);
    rejected = Object.keys(rawTokens).filter((k) => !(k in tokens));
    ostatnieOdrzucone = Object.keys(rawTokens).length;

    if (Object.keys(tokens).length > 0) break;

    if (podejscie < SKIN_MAX_ATTEMPTS) {
      historia.push({ role: "assistant", content: result.content ?? "" });
      historia.push({ role: "user", content: korekta(rejected) });
    }
  }

  if (Object.keys(tokens).length === 0) {
    throw new JobError(opisPorazki(ostatnieOdrzucone, rejected), 502);
  }

  const skin: GeneratedSkin = {
    name: typeof parsed.name === "string" ? parsed.name.trim().slice(0, 60) : "Nowa skórka",
    description: typeof parsed.description === "string" ? parsed.description.trim().slice(0, 200) : "",
    colorScheme: parsed.colorScheme === "light" ? "light" : "dark",
    rationale: typeof parsed.rationale === "string" ? parsed.rationale.trim().slice(0, 400) : "",
    tokens,
    rejected,
  };

  return { skin, usage: usageFromChat(wywolania) };
}
