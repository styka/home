// 045 — handler: wygeneruj skórkę z opisu słownego. Z `/api/llm/skins/generate`.
//
// Wzorowany na `kitchenGenerateRecipe` (cienka trasa + handler), bo to ta sama klasa
// operacji: jedno wywołanie modelu odpalane KLIKNIĘCIEM, zwracające ustrukturyzowany
// JSON. To nie jest funkcja asystenta czatowego — katalog `AIAction` zostaje nietknięty.

import { chatComplete } from "@/platform/llm/chat";
import { parseJsonLoose } from "@/platform/llm/json";
import { wyodrebnijTokeny } from "@/lib/skins/mapowanie";
import { JobError, type JobContext } from "@/platform/jobs/types";
import { usageFromChat } from "@/platform/ai/usage";
import {
  ALL_CONTROLS,
  DEFAULT_DARK_TOKENS,
  validateTokens,
  type SkinControlKind,
  type SkinTokens,
} from "@/lib/skins";
import {
  CELE_ANIMACJI,
  KOMPONENTY,
  MOBILE_TOKENY,
  SLOTY_ASSETOW,
  STANY_GLOBALNE,
  WARIANTY_NAWIGACJI,
  walidujDefinicje,
  type DefinicjaZaawansowana,
  type OpisWlasciwosci,
} from "@/lib/skins/zaawansowane";
import { resolveGeneratorObrazow } from "@/platform/ai/generatorObrazow";

/**
 * Katalog tokenów dla modelu — GENEROWANY z `ALL_CONTROLS`, nie przepisany ręcznie.
 *
 * To jest istotne: lista tokenów będzie rosła, a prompt przepisany z palca rozjechałby
 * się przy pierwszym nowym tokenie i model po cichu przestałby go ustawiać. Tu rozjazd
 * jest niemożliwy z definicji.
 */
function opisRodzaju(kind: SkinControlKind, options?: { value: string }[]): string {
  switch (kind) {
    case "color": return "kolor #rrggbb";
    case "scheme": return "light | dark";
    case "font":
    case "keyword": return (options ?? []).map((o) => o.value).join(" | ");
    case "radius":
    case "density": return "wartość w px, max 3 cyfry (np. 6px), albo 0";
    case "length": return "px, rem albo em (np. 16px, 1.5rem)";
    case "tracking": return "em albo px, może być ujemne (np. 0.08em)";
    case "number": return "liczba bez jednostki (np. 1.5)";
    case "weight": return "100..900 (setki)";
    case "duration": return "ms albo s (np. 120ms, 0.3s)";
    case "easing": return "linear | ease | ease-in | ease-out | ease-in-out | cubic-bezier(a,b,c,d)";
    case "shadow": return "cień CSS; kolory tylko przez rgba()/rgb()/color-mix(); albo none";
    case "background": return "kolor #rrggbb albo linear-gradient()/radial-gradient()/conic-gradient(); albo none";
  }
}

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

5. ZNAK TOWAROWY DOTYCZY NAZWY, NIE ZADANIA. Tytuł dzieła, marka albo uniwersum to
   POPRAWNY i wystarczający opis estetyki — masz go rozpoznać i przełożyć na kolory,
   krój i kształty (np. „kosmiczna saga" → chłodny granat, bursztynowe akcenty,
   wersaliki, cienkie ramki, brak ciepłych beży). Nie odmawiaj i NIE zwracaj wtedy
   "error". Ograniczenie dotyczy wyłącznie NAZWANIA skórki: w "name" i "description"
   użyj własnych słów, bez znaku towarowego.`;

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

KSZTAŁT ODPOWIEDZI — trzymaj się go co do znaku:
- "tokens" jest OBIEKTEM (mapa klucz→wartość), nie tablicą i nie listą par.
- Klucze są dokładnie takie jak w katalogu, z dwoma myślnikami na początku.
- KAŻDA wartość jest NAPISEM — także liczby: "700", nie 700; "1.5", nie 1.5.

Przykład poprawnej odpowiedzi (skrócony — Ty wypisz wszystkie tokeny z katalogu):
{
  "name": "Mostek",
  "description": "Chłodny granat z bursztynowym akcentem.",
  "colorScheme": "dark",
  "rationale": "Granat i bursztyn budują wrażenie konsoli; wersaliki w nagłówkach dokładają rygor.",
  "tokens": {
    "--bg-base": "#050a18",
    "--text-primary": "#dbe9ff",
    "--accent-amber": "#f0a830",
    "--on-accent": "#1a1206",
    "--font-weight-heading": "700"
  }
}

Zwróć {"error":"not-a-theme"} WYŁĄCZNIE wtedy, gdy opis nie niesie ŻADNEJ informacji o wyglądzie
(np. „zrób mi kanapkę", „nie wiem"). Nastrój, pora dnia, materiał, miejsce, epoka, gatunek, dzieło
kultury albo marka — to wszystko SĄ opisy wyglądu i masz je przełożyć na tokeny.`;
}

// ─── 116: katalog i prompt trybu ZAAWANSOWANEGO ────────────────────────────────
//
// Katalog jest GENEROWANY z tych samych obiektów, którymi waliduje `walidujDefinicje`
// (KOMPONENTY, CELE_ANIMACJI, WARIANTY_NAWIGACJI, SLOTY_ASSETOW, MOBILE_TOKENY) —
// ten sam powód co przy `buildTokenCatalog`: rozjazd promptu z walidacją jest
// niemożliwy z definicji, bo źródło jest jedno.

function katalogWlasciwosci(wpisy: Record<string, OpisWlasciwosci>, wciecie: string): string {
  return Object.entries(wpisy)
    .map(([prop, o]) => {
      const rodzaj =
        o.cel.typ === "var"
          ? opisRodzaju(o.cel.rodzaj, o.cel.opcje)
          : opisRodzaju(
              ALL_CONTROLS.find((c) => c.key === (o.cel as { klucz: string }).klucz)?.kind ?? "color",
              ALL_CONTROLS.find((c) => c.key === (o.cel as { klucz: string }).klucz)?.options,
            );
      return `${wciecie}${prop} — ${o.opis}; format: ${rodzaj}`;
    })
    .join("\n");
}

function katalogZaawansowany(): string {
  const komponenty = Object.entries(KOMPONENTY)
    .map(([nazwa, k]) => {
      let s = `- ${nazwa} (${k.opis}):\n${katalogWlasciwosci(k.wlasciwosci, "    ")}`;
      for (const [stan, props] of Object.entries(k.stany ?? {})) {
        s += `\n    states.${stan}:\n${katalogWlasciwosci(props, "      ")}`;
      }
      return s;
    })
    .join("\n");
  const stany = Object.entries(STANY_GLOBALNE)
    .map(([nazwa, props]) => `- ${nazwa}:\n${katalogWlasciwosci(props, "    ")}`)
    .join("\n");
  const animacje = Object.entries(CELE_ANIMACJI)
    .map(([cel, k]) => `- ${cel} (${k.opis}) — dozwolone name: ${k.nazwy.join(" | ")}`)
    .join("\n");
  return `KATALOG TOKENÓW (sekcja "tokens" — ustaw WSZYSTKIE):
${buildTokenCatalog()}

KOMPONENTY (sekcja "components" — tylko te nazwy i te właściwości):
${komponenty}

KOLORY STANÓW (sekcja "states"):
${stany}

UKŁAD (sekcja "layout"): { "nav": ${WARIANTY_NAWIGACJI.map((w) => `"${w}"`).join(" | ")} }

ANIMACJE (sekcja "animations" — obiekt cel → {name, duration?, easing?, intensity?}):
${animacje}
  Parametry: duration 60ms–3000ms; easing jak w tokenach; intensity: subtle | normal | strong.

TELEFON (sekcja "responsive"): { "mobile": { "tokens": {...} } } — wolno nadpisać tylko:
${MOBILE_TOKENY.join(", ")}

GRAFIKI (sekcja "assets" — tablica, max jeden wpis na slot):
  Sloty: ${SLOTY_ASSETOW.join(" | ")}. Wpis: { "slot": "...", "status": "missing",
  "prompt": "opis grafiki po polsku", "fit": "cover"|"tile" }.
  NIE znasz żadnych id grafik — zawsze status "missing" z opisem; system dołączy grafikę,
  gdy będzie dostępny generator obrazów. Używaj oszczędnie: gradienty z "tokens" często
  wystarczą zamiast grafiki.`;
}

function systemPromptZaawansowany(): string {
  return `Jesteś projektantem interfejsów. Tworzysz ZAAWANSOWANĄ skórkę aplikacji Omnia z opisu po polsku — motyw tak głęboki, że aplikacja może przypominać inną aplikację (panel sci-fi, bajkowy pastel, retro terminal, elegancki premium).

Skórka to JEDEN obiekt JSON o ściśle zamkniętym schemacie. Wszystko spoza katalogów zostanie odrzucone.

${katalogZaawansowany()}

${RULES}

6. WARSTWY MAJĄ WSPÓŁGRAĆ. Wariant układu, komponenty, animacje i grafiki dobieraj tak,
   żeby budowały JEDEN charakter (terminal → pasek-gorny + zero animacji + ostre rogi;
   bajkowy → duże zaokrąglenia + slide-up + pastelowe gradienty).

Zwróć WYŁĄCZNIE JSON (bez markdown) w schemacie:
{
  "schemaVersion": 1,
  "name": string,               // krótka, własna nazwa skórki po polsku
  "description": string,        // jedno zdanie o charakterze motywu
  "colorScheme": "light"|"dark",
  "rationale": string,          // 1-2 zdania: jak opis przełożyłeś na decyzje
  "tokens": { ... },            // komplet tokenów z katalogu
  "components": { ... },        // co najmniej button i card
  "states": { ... },
  "layout": { "nav": "..." },
  "animations": { ... },        // 0-3 celów; umiar przed efektownością
  "responsive": { "mobile": { "tokens": { ... } } },   // opcjonalnie
  "assets": [ ... ]             // opcjonalnie, status "missing" + prompt
}

KAŻDA wartość liczbowa jest NAPISEM ("700", nie 700). Zwróć {"error":"not-a-theme"} WYŁĄCZNIE,
gdy opis nie niesie żadnej informacji o wyglądzie.`;
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
    "Przypomnienie kształtu: `tokens` to OBIEKT (mapa klucz→wartość), klucze z dwoma myślnikami " +
    "na początku, każda wartość jako NAPIS (\"700\", nie 700).\n\n" +
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
    // 081: po dołożeniu warstwy mapowania ten stan znaczy coś WĘŻSZEGO niż przedtem — przeszukaliśmy
    // wszystkie znane pojemniki, przetłumaczyliśmy konwencje kluczy i liczby na napisy, i dalej nic.
    // Komunikat ma to mówić, żeby nie sugerować użytkownikowi, że to on źle opisał skórkę.
    return (
      "Model odpowiedział, ale w odpowiedzi nie było mapy tokenów — nawet po przeszukaniu " +
      "wszystkich znanych kształtów. To wygląda na problem z modelem, nie z opisem: spróbuj " +
      "ponownie, a jeśli powtarza się przy każdym opisie, sprawdź model przypisany do operacji " +
      "„generation” w panelu LLM."
    );
  }
  return (
    `Model odesłał ${przyslanych} kluczy i żaden nie przeszedł walidacji ` +
    `(${wymien(odrzucone)}). To zwykle nazwy spoza katalogu tokenów albo wartości w złym formacie.`
  );
}

export interface GenerateSkinPayload {
  prompt?: string;
  /** 116: rodzaj generowanej skórki. Domyślnie `simple` — dotychczasowe zachowanie. */
  tryb?: "simple" | "advanced";
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

/** 116: wynik trybu zaawansowanego — pełna, zwalidowana definicja. */
export interface GeneratedAdvancedSkin {
  name: string;
  description: string;
  colorScheme: "light" | "dark";
  rationale: string;
  definition: DefinicjaZaawansowana;
  /** Ścieżki pól, których nie przyjęła walidacja — pokazywane, nie chowane. */
  rejected: string[];
  /** Zamówione grafiki, których nie ma czym wygenerować (brak dostawcy obrazów). */
  brakujaceGrafiki: string[];
}

async function skinGenerateAdvanced(trimmed: string, ctx: JobContext) {
  const historia: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPromptZaawansowany() },
    { role: "user", content: trimmed },
  ];
  const wywolania: Array<Parameters<typeof usageFromChat>[0][number]> = [];
  let definicja: DefinicjaZaawansowana = { schemaVersion: 1 };
  let odrzucone: string[] = [];
  let parsed: Record<string, unknown> = {};
  // Recenzja 116 (ust. 6): do diagnozy porażki idzie liczba pól PRZYSŁANYCH przez model
  // (kontrakt `opisPorazki` z 080), nie liczność listy odrzuconych ścieżek — te dwa
  // rozjeżdżają się, gdy walidacja odrzuca całe sekcje.
  let przyslanychPol = 0;

  for (let podejscie = 1; podejscie <= SKIN_MAX_ATTEMPTS; podejscie++) {
    const result = await chatComplete({
      op: "generation",
      userId: ctx.ownerId ?? undefined,
      messages: historia,
      temperature: 0.7,
      // Definicja zaawansowana jest 2-3× większa niż mapa tokenów (komponenty, animacje,
      // layout) — budżet odpowiednio wyżej, z tego samego powodu co 4500 w trybie prostym.
      maxTokens: 8000,
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
    if (parsed.error) throw new JobError("Z tego opisu nie wynika wygląd interfejsu — doprecyzuj", 422);

    przyslanychPol = Object.keys(parsed).length;
    // Model jest źródłem równie obcym jak cudzy plik — pełna walidacja definicji.
    const w = walidujDefinicje(parsed);
    definicja = w.definicja;
    odrzucone = w.odrzucone;

    // Sukces = jest czym motywować: warstwa tokenów albo komponentów.
    if (definicja.tokens || definicja.components) break;

    if (podejscie < SKIN_MAX_ATTEMPTS) {
      historia.push({ role: "assistant", content: result.content ?? "" });
      historia.push({
        role: "user",
        content:
          `Żadne z pól, które zwróciłeś, nie przeszło walidacji: ${wymien(odrzucone)}.\n\n` +
          "Popraw odpowiedź. Nazwy sekcji, komponentów, właściwości i animacji MUSZĄ pochodzić " +
          "z katalogu (co do znaku), a wartości mieć podany format — każda liczba jako NAPIS.\n\n" +
          `${katalogZaawansowany()}\n\nZwróć wyłącznie JSON w ustalonym kształcie.`,
      });
    }
  }

  if (!definicja.tokens && !definicja.components) {
    throw new JobError(opisPorazki(przyslanychPol, odrzucone), 502);
  }

  // 116: zamówione grafiki — bez dostawcy obrazów zostają `missing` (jawnie, nie cicho).
  // Gdy dostawca będzie podłączony (`resolveGeneratorObrazow`), tu jest miejsce, w którym
  // zamówienie zamienia się w rekord `SkinAsset` i status `ready`.
  const generator = resolveGeneratorObrazow();
  const brakujaceGrafiki: string[] = [];
  if (!generator && definicja.assets) {
    for (const ref of definicja.assets) {
      if (ref.status === "missing") brakujaceGrafiki.push(ref.prompt || ref.slot);
    }
  }

  const skin: GeneratedAdvancedSkin = {
    name: typeof parsed.name === "string" ? parsed.name.trim().slice(0, 60) : "Nowa skórka",
    description: typeof parsed.description === "string" ? parsed.description.trim().slice(0, 200) : "",
    colorScheme: parsed.colorScheme === "light" ? "light" : "dark",
    rationale: typeof parsed.rationale === "string" ? parsed.rationale.trim().slice(0, 400) : "",
    definition: definicja,
    rejected: odrzucone,
    brakujaceGrafiki,
  };
  return { skin, usage: usageFromChat(wywolania) };
}

export async function skinGenerateHandler(payload: GenerateSkinPayload, ctx: JobContext) {
  const trimmed = payload?.prompt?.trim();
  if (!trimmed) throw new JobError("Opisz, jak ma wyglądać skórka", 400);
  if (trimmed.length > 600) throw new JobError("Opis za długi (max 600 znaków)", 400);

  if (payload.tryb === "advanced") return skinGenerateAdvanced(trimmed, ctx);

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
      // 081 (Z10): katalog ma 53 tokeny, a zasada 3 żąda kompletu — sama mapa to ~1200 tokenów
      // wyjścia, plus uzasadnienie. Przy modelu rozumującym tokeny myślenia wliczają się do TEGO
      // SAMEGO budżetu (lekcja z 038), więc 3000 bywało na styk i odpowiedź wracała ucięta.
      maxTokens: 4500,
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
