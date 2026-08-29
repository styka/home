// 116 — SKÓRKA ZAAWANSOWANA: format definicji (kontrakt LLM ↔ aplikacja).
//
// Definicja to wersjonowany JSON, który LLM generuje z opisu w języku naturalnym.
// LLM jest KLIENTEM systemu, nie źródłem zaufania (spec 116, §9): każde pole przechodzi
// walidację z zamkniętych katalogów poniżej, a wszystko, co nieznane albo niebezpieczne,
// ląduje na liście `odrzucone` — pokazywanej użytkownikowi, nigdy przemilczanej (ta sama
// reguła co przy imporcie skórki prostej z pliku, 045).
//
// ARCHITEKTURA WARSTW (od ogółu do szczegółu):
//   tokens (istniejąca whitelista) → components (semantyczne komponenty ze stanami)
//   → states (kolory stanów error/success/warning) → layout (zamknięta lista wariantów
//   nawigacji) → animations (zamknięty katalog nazwanych animacji z parametrami)
//   → responsive (nadpisania tokenów na telefonie) → assets (referencje grafik po id).
//
// Definicja NIE zawiera CSS ani selektorów. Kompilator (`kompilacja.ts`) tłumaczy ją na
// mapę zmiennych CSS + atrybuty `data-*` na <html>; reguły konsumujące te zmienne są
// STATYCZNE w globals.css. Dzięki temu nie istnieje żadna ścieżka, którą tekst z LLM
// mógłby trafić do arkusza stylów inaczej niż przez sanityzację per rodzaj wartości.

import {
  sanitizeValueOfKind,
  tokenControl,
  validateTokens,
  type SkinControlKind,
  type SkinTokens,
} from "@/lib/skins";

export const SCHEMA_VERSION = 1;

export type SkinKind = "simple" | "advanced";

// ─── Layout — zamknięta lista wariantów nawigacji (decyzja właściciela) ─────────

export const WARIANTY_NAWIGACJI = ["sidebar-lewy", "sidebar-prawy", "pasek-gorny"] as const;
export type WariantNawigacji = (typeof WARIANTY_NAWIGACJI)[number];

// ─── Komponenty — semantyczne cele stylowania ────────────────────────────────────
//
// Właściwość komponentu wskazuje jeden z dwóch celów:
//  * `token`  — ALIAS na istniejący token skórki prostej (np. karta = powierzchnie).
//    Wartość sanityzowana regułą TEGO tokenu; kompilacja to zwykły wpis w mapie.
//  * `var`    — NOWA zmienna `--c-*`, konsumowana przez bramkowaną regułę w globals.css
//    (`html[data-<brama>] …`). Bramka sprawia, że bez skórki zaawansowanej reguła
//    nie działa wcale — skórki proste nie mogą się od tego zmienić (AC-1).

export type CelWlasciwosci =
  | { typ: "token"; klucz: string }
  | {
      typ: "var";
      klucz: string;
      rodzaj: SkinControlKind;
      brama: string;
      opcje?: { value: string; label: string }[];
    };

export type OpisWlasciwosci = { cel: CelWlasciwosci; opis: string };

type KatalogWlasciwosci = Record<string, OpisWlasciwosci>;

export type OpisKomponentu = {
  opis: string;
  wlasciwosci: KatalogWlasciwosci;
  stany?: Record<string, KatalogWlasciwosci>;
};

const t = (klucz: string, opis: string): OpisWlasciwosci => ({ cel: { typ: "token", klucz }, opis });
const v = (
  klucz: string,
  rodzaj: SkinControlKind,
  brama: string,
  opis: string,
  opcje?: { value: string; label: string }[],
): OpisWlasciwosci => ({ cel: { typ: "var", klucz, rodzaj, brama, opcje }, opis });

/** Zamknięty katalog komponentów v1. Rozszerzenie = nowy wpis tutaj + (dla `var`)
 *  bramkowana reguła w globals.css — patrz docs/skorki/zaawansowane.md. */
export const KOMPONENTY: Record<string, OpisKomponentu> = {
  button: {
    opis: "Przyciski akcji (kolorowe przyciski w całej aplikacji)",
    wlasciwosci: {
      bg: v("--c-btn-bg", "background", "c-btn", "kolor #rrggbb albo gradient CSS tła przycisku"),
      text: v("--c-btn-text", "color", "c-btn", "kolor tekstu na przycisku (kontrast ≥ 4.5:1 z tłem)"),
      radius: v("--c-btn-radius", "radius", "c-btn-radius", "zaokrąglenie przycisków, px"),
      shadow: v("--c-btn-shadow", "shadow", "c-btn-shadow", "cień/poświata przycisku"),
      textTransform: v("--c-btn-transform", "keyword", "c-btn-transform", "wersaliki na przyciskach", [
        { value: "none", label: "Normalnie" },
        { value: "uppercase", label: "WERSALIKI" },
      ]),
    },
    stany: {
      hover: {
        bg: v("--c-btn-hover-bg", "background", "c-btn", "tło przycisku pod kursorem"),
        shadow: v("--c-btn-hover-shadow", "shadow", "c-btn-shadow", "cień przycisku pod kursorem"),
      },
      disabled: {
        opacity: v("--c-btn-disabled-opacity", "number", "c-btn-disabled", "przezroczystość wyłączonego przycisku (0–1)"),
      },
    },
  },
  card: {
    opis: "Karty i panele treści (wszystkie powierzchnie)",
    wlasciwosci: {
      bg: t("--bg-surface", "kolor tła kart i paneli"),
      radius: t("--radius-lg", "zaokrąglenie kart, px"),
      borderColor: t("--border", "kolor obramowania kart"),
      shadow: t("--shadow-surface", "cień kart"),
    },
  },
  input: {
    opis: "Pola tekstowe i kontrolki formularzy",
    wlasciwosci: {
      radius: t("--radius-control", "zaokrąglenie pól i kontrolek, px"),
      height: t("--control-height", "wysokość kontrolek (cel dotyku — nie mniej niż 32px)"),
    },
    stany: {
      focus: {
        borderColor: t("--border-focus", "kolor obramowania aktywnego pola"),
        ringWidth: t("--focus-ring-width", "grubość obwódki fokusu"),
      },
    },
  },
  modal: {
    opis: "Okna dialogowe i arkusze",
    wlasciwosci: {
      bg: v("--c-modal-bg", "color", "c-modal", "kolor tła okna dialogowego"),
      radius: v("--c-modal-radius", "radius", "c-modal-radius", "zaokrąglenie okna dialogowego, px"),
      shadow: v("--c-modal-shadow", "shadow", "c-modal-shadow", "cień okna dialogowego"),
    },
  },
  navigation: {
    opis: "Nawigacja (pasek boczny / chrom powłoki)",
    wlasciwosci: {
      bg: t("--chrome-bg", "kolor tła nawigacji"),
      borderColor: t("--chrome-border", "kolor obramowania nawigacji"),
      width: t("--sidebar-width", "szerokość paska bocznego"),
      frame: t("--chrome-frame", "ramki narożne chromu (none | corners)"),
    },
  },
  badge: {
    opis: "Odznaki i etykietki",
    wlasciwosci: { radius: t("--radius-pill", "zaokrąglenie odznak") },
  },
  list: {
    opis: "Listy elementów",
    wlasciwosci: { spacing: t("--space-unit", "jednostka odstępu list") },
  },
  table: {
    opis: "Tabele",
    wlasciwosci: { borderColor: t("--border", "kolor linii tabel") },
  },
  tabs: {
    opis: "Zakładki",
    wlasciwosci: { radius: t("--radius-control", "zaokrąglenie zakładek") },
  },
};

// ─── Kolory stanów (semantyka error/success/warning dla LLM) ────────────────────

export const STANY_GLOBALNE: Record<string, KatalogWlasciwosci> = {
  error: {
    accent: t("--accent-red", "kolor stanu błędu / akcji destrukcyjnej"),
    accentDim: t("--accent-red-dim", "przyciemniony kolor stanu błędu"),
  },
  success: {
    accent: t("--accent-green", "kolor stanu sukcesu"),
    accentDim: t("--accent-green-dim", "przyciemniony kolor sukcesu"),
  },
  warning: {
    accent: t("--accent-amber", "kolor ostrzeżenia"),
    accentDim: t("--accent-amber-dim", "przyciemniony kolor ostrzeżenia"),
  },
};

// ─── Animacje — zamknięty katalog nazwanych animacji ────────────────────────────
//
// Cel → dozwolone nazwy. Nazwa mapuje się na statyczny @keyframes `omnia-anim-*`
// w globals.css; parametry (czas / krzywa / intensywność) idą zmiennymi. Dowolnych
// keyframes z LLM nie ma — z tych samych powodów, dla których nie ma dowolnego CSS.

export const CELE_ANIMACJI = {
  contentEntrance: {
    opis: "wejście treści widoku po nawigacji",
    nazwy: ["fade", "slide-up", "scale"],
    brama: "anim-content",
  },
  buttonHover: {
    opis: "reakcja przycisku pod kursorem",
    nazwy: ["scale", "glow-pulse"],
    brama: "anim-btn-hover",
  },
  navGlow: {
    opis: "poświata nawigacji (pasek boczny)",
    nazwy: ["glow-pulse"],
    brama: "anim-nav-glow",
  },
  modalEntrance: {
    opis: "wejście okna dialogowego",
    nazwy: ["fade", "slide-up", "scale"],
    brama: "anim-modal",
  },
  loader: {
    opis: "tempo animacji ładowania",
    nazwy: ["spin"],
    brama: "anim-loader",
  },
} as const;

export type CelAnimacji = keyof typeof CELE_ANIMACJI;

export const INTENSYWNOSCI = ["subtle", "normal", "strong"] as const;
export type Intensywnosc = (typeof INTENSYWNOSCI)[number];

export type DefinicjaAnimacji = {
  name: string;
  /** 60–3000 ms — dłuższa animacja to już usterka UX, nie charakter motywu. */
  duration?: string;
  easing?: string;
  intensity?: Intensywnosc;
};

// ─── Assety — referencje po id, nigdy dane binarne w definicji ──────────────────

export const SLOTY_ASSETOW = ["app-background", "surface-texture", "nav-background"] as const;
export type SlotAssetu = (typeof SLOTY_ASSETOW)[number];

export type ReferencjaAssetu = {
  /** Id rekordu `SkinAsset` (cuid). `url()` buduje wyłącznie kompilator — po weryfikacji. */
  id: string;
  slot: SlotAssetu;
  fit?: "cover" | "tile";
  /** `missing` = LLM wskazał potrzebną grafikę, ale generatora obrazów nie ma / jeszcze nie powstała. */
  status?: "ready" | "missing";
  /** Opis grafiki dla przyszłego generatora obrazów (czysty tekst, nigdy nie trafia do CSS). */
  prompt?: string;
};

/** Tokeny, które wolno nadpisać na telefonie (< md). Wąski start — patrz plan §3. */
export const MOBILE_TOKENY = [
  "--font-size-base",
  "--space-unit",
  "--view-padding",
  "--radius",
  "--control-height",
] as const;

// ─── Definicja ──────────────────────────────────────────────────────────────────

export type StylKomponentu = Record<string, string> & {
  states?: Record<string, Record<string, string>>;
};

export type DefinicjaZaawansowana = {
  schemaVersion: number;
  tokens?: SkinTokens;
  layout?: { nav?: WariantNawigacji };
  components?: Record<string, StylKomponentu>;
  states?: Record<string, Record<string, string>>;
  animations?: Partial<Record<CelAnimacji, DefinicjaAnimacji>>;
  responsive?: { mobile?: { tokens?: SkinTokens } };
  assets?: ReferencjaAssetu[];
};

/** Twardy limit rozmiaru definicji — definicja większa jest odrzucana w całości. */
export const LIMIT_DEFINICJI = 64 * 1024;

const CUID_RE = /^[a-z0-9]{16,40}$/;
const DURATION_MS_RE = /^(\d{2,4})ms$/;

export type WynikWalidacji = {
  definicja: DefinicjaZaawansowana;
  /** Ścieżki odrzuconych pól (np. `components.button.bg`) — pokazywane użytkownikowi. */
  odrzucone: string[];
};

function pusta(): DefinicjaZaawansowana {
  return { schemaVersion: SCHEMA_VERSION };
}

function jestObiektem(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Waliduje mapę właściwości wg katalogu; wynik = tylko bezpieczne wpisy. */
function walidujWlasciwosci(
  raw: Record<string, unknown>,
  katalog: KatalogWlasciwosci,
  sciezka: string,
  odrzucone: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [prop, val] of Object.entries(raw)) {
    const opis = katalog[prop];
    if (!opis) {
      odrzucone.push(`${sciezka}.${prop}`);
      continue;
    }
    let safe: string | null = null;
    if (opis.cel.typ === "token") {
      const ctl = tokenControl(opis.cel.klucz);
      safe = ctl ? sanitizeValueOfKind(ctl.kind, val, ctl.options) : null;
    } else {
      safe = sanitizeValueOfKind(opis.cel.rodzaj, val, opis.cel.opcje);
    }
    if (safe === null) odrzucone.push(`${sciezka}.${prop}`);
    else out[prop] = safe;
  }
  return out;
}

/** Migrator wersji schematu. v1 = tożsamość; przyszła zmiana formatu dostaje tu
 *  swoją funkcję przejścia, więc stara definicja w bazie pozostaje odczytywalna. */
export function migrujDefinicje(raw: Record<string, unknown>): Record<string, unknown> {
  const wersja = typeof raw.schemaVersion === "number" ? raw.schemaVersion : SCHEMA_VERSION;
  if (wersja === SCHEMA_VERSION) return raw;
  // Wersji > bieżącej nie umiemy czytać — walidacja odrzuci ją w całości.
  return raw;
}

/** Walidacja definicji zaawansowanej. NIGDY nie rzuca: błędne pole idzie na listę
 *  `odrzucone`, a reszta definicji działa (AC-4). Definicja nieczytelna w całości
 *  (zły typ, za duża, nieznana wersja) → pusta definicja + wpis na liście. */
export function walidujDefinicje(raw: unknown): WynikWalidacji {
  const odrzucone: string[] = [];

  if (!jestObiektem(raw)) return { definicja: pusta(), odrzucone: ["definicja"] };
  try {
    if (JSON.stringify(raw).length > LIMIT_DEFINICJI) {
      return { definicja: pusta(), odrzucone: ["definicja.rozmiar"] };
    }
  } catch {
    return { definicja: pusta(), odrzucone: ["definicja"] };
  }

  const zrodlo = migrujDefinicje(raw);
  const wersja = typeof zrodlo.schemaVersion === "number" ? zrodlo.schemaVersion : SCHEMA_VERSION;
  if (wersja !== SCHEMA_VERSION) {
    return { definicja: pusta(), odrzucone: ["schemaVersion"] };
  }

  const def: DefinicjaZaawansowana = { schemaVersion: SCHEMA_VERSION };

  // tokens — istniejąca whitelista; klucze odrzucone raportujemy po nazwie.
  if (zrodlo.tokens !== undefined) {
    if (jestObiektem(zrodlo.tokens)) {
      const czyste = validateTokens(zrodlo.tokens);
      for (const k of Object.keys(zrodlo.tokens)) {
        if (!(k in czyste)) odrzucone.push(`tokens.${k}`);
      }
      if (Object.keys(czyste).length > 0) def.tokens = czyste;
    } else odrzucone.push("tokens");
  }

  // layout
  if (zrodlo.layout !== undefined) {
    if (jestObiektem(zrodlo.layout)) {
      const nav = zrodlo.layout.nav;
      if (nav === undefined) {
        // pusty layout — nic do zapisania
      } else if (typeof nav === "string" && (WARIANTY_NAWIGACJI as readonly string[]).includes(nav)) {
        def.layout = { nav: nav as WariantNawigacji };
      } else odrzucone.push("layout.nav");
      for (const k of Object.keys(zrodlo.layout)) if (k !== "nav") odrzucone.push(`layout.${k}`);
    } else odrzucone.push("layout");
  }

  // components
  if (zrodlo.components !== undefined) {
    if (jestObiektem(zrodlo.components)) {
      const comps: Record<string, StylKomponentu> = {};
      for (const [nazwa, cialo] of Object.entries(zrodlo.components)) {
        const katalog = KOMPONENTY[nazwa];
        if (!katalog || !jestObiektem(cialo)) {
          odrzucone.push(`components.${nazwa}`);
          continue;
        }
        const { states: rawStates, ...rawProps } = cialo as Record<string, unknown>;
        const props = walidujWlasciwosci(rawProps, katalog.wlasciwosci, `components.${nazwa}`, odrzucone);
        const styl: StylKomponentu = { ...props };
        if (rawStates !== undefined) {
          if (jestObiektem(rawStates) && katalog.stany) {
            const states: Record<string, Record<string, string>> = {};
            for (const [stan, stanCialo] of Object.entries(rawStates)) {
              const katStanu = katalog.stany[stan];
              if (!katStanu || !jestObiektem(stanCialo)) {
                odrzucone.push(`components.${nazwa}.states.${stan}`);
                continue;
              }
              const czysty = walidujWlasciwosci(
                stanCialo,
                katStanu,
                `components.${nazwa}.states.${stan}`,
                odrzucone,
              );
              if (Object.keys(czysty).length > 0) states[stan] = czysty;
            }
            if (Object.keys(states).length > 0) styl.states = states;
          } else odrzucone.push(`components.${nazwa}.states`);
        }
        if (Object.keys(props).length > 0 || styl.states) comps[nazwa] = styl;
      }
      if (Object.keys(comps).length > 0) def.components = comps;
    } else odrzucone.push("components");
  }

  // states (globalne kolory stanów)
  if (zrodlo.states !== undefined) {
    if (jestObiektem(zrodlo.states)) {
      const states: Record<string, Record<string, string>> = {};
      for (const [stan, cialo] of Object.entries(zrodlo.states)) {
        const katalog = STANY_GLOBALNE[stan];
        if (!katalog || !jestObiektem(cialo)) {
          odrzucone.push(`states.${stan}`);
          continue;
        }
        const czysty = walidujWlasciwosci(cialo, katalog, `states.${stan}`, odrzucone);
        if (Object.keys(czysty).length > 0) states[stan] = czysty;
      }
      if (Object.keys(states).length > 0) def.states = states;
    } else odrzucone.push("states");
  }

  // animations
  if (zrodlo.animations !== undefined) {
    if (jestObiektem(zrodlo.animations)) {
      const anims: Partial<Record<CelAnimacji, DefinicjaAnimacji>> = {};
      for (const [cel, cialo] of Object.entries(zrodlo.animations)) {
        const katalog = CELE_ANIMACJI[cel as CelAnimacji];
        if (!katalog || !jestObiektem(cialo)) {
          odrzucone.push(`animations.${cel}`);
          continue;
        }
        const name = cialo.name;
        if (typeof name !== "string" || !(katalog.nazwy as readonly string[]).includes(name)) {
          odrzucone.push(`animations.${cel}.name`);
          continue;
        }
        const anim: DefinicjaAnimacji = { name };
        if (cialo.duration !== undefined) {
          const dur = sanitizeValueOfKind("duration", cialo.duration);
          const m = dur ? DURATION_MS_RE.exec(dur) : null;
          const ms = m ? Number(m[1]) : NaN;
          if (m && ms >= 60 && ms <= 3000) anim.duration = dur!;
          else odrzucone.push(`animations.${cel}.duration`);
        }
        if (cialo.easing !== undefined) {
          const ease = sanitizeValueOfKind("easing", cialo.easing);
          if (ease) anim.easing = ease;
          else odrzucone.push(`animations.${cel}.easing`);
        }
        if (cialo.intensity !== undefined) {
          if (typeof cialo.intensity === "string" && (INTENSYWNOSCI as readonly string[]).includes(cialo.intensity)) {
            anim.intensity = cialo.intensity as Intensywnosc;
          } else odrzucone.push(`animations.${cel}.intensity`);
        }
        anims[cel as CelAnimacji] = anim;
      }
      if (Object.keys(anims).length > 0) def.animations = anims;
    } else odrzucone.push("animations");
  }

  // responsive
  if (zrodlo.responsive !== undefined) {
    if (jestObiektem(zrodlo.responsive) && jestObiektem(zrodlo.responsive.mobile)) {
      const rawTok = (zrodlo.responsive.mobile as Record<string, unknown>).tokens;
      if (jestObiektem(rawTok)) {
        const czyste: SkinTokens = {};
        for (const [k, val] of Object.entries(rawTok)) {
          if (!(MOBILE_TOKENY as readonly string[]).includes(k)) {
            odrzucone.push(`responsive.mobile.tokens.${k}`);
            continue;
          }
          const ctl = tokenControl(k);
          const safe = ctl ? sanitizeValueOfKind(ctl.kind, val, ctl.options) : null;
          if (safe === null) odrzucone.push(`responsive.mobile.tokens.${k}`);
          else czyste[k] = safe;
        }
        if (Object.keys(czyste).length > 0) def.responsive = { mobile: { tokens: czyste } };
      } else if (rawTok !== undefined) odrzucone.push("responsive.mobile.tokens");
    } else odrzucone.push("responsive");
  }

  // assets
  if (zrodlo.assets !== undefined) {
    if (Array.isArray(zrodlo.assets)) {
      const assets: ReferencjaAssetu[] = [];
      const zajeteSloty = new Set<string>();
      zrodlo.assets.slice(0, 12).forEach((raw, i) => {
        if (!jestObiektem(raw)) {
          odrzucone.push(`assets[${i}]`);
          return;
        }
        const slot = raw.slot;
        if (typeof slot !== "string" || !(SLOTY_ASSETOW as readonly string[]).includes(slot) || zajeteSloty.has(slot)) {
          odrzucone.push(`assets[${i}].slot`);
          return;
        }
        const id = raw.id;
        const status = raw.status === "missing" ? "missing" : "ready";
        // Referencja `missing` może mieć puste id — to zamówienie na grafikę, nie wskazanie.
        if (status === "ready" && (typeof id !== "string" || !CUID_RE.test(id))) {
          odrzucone.push(`assets[${i}].id`);
          return;
        }
        const ref: ReferencjaAssetu = {
          id: typeof id === "string" && CUID_RE.test(id) ? id : "",
          slot: slot as SlotAssetu,
          status,
        };
        if (raw.fit === "cover" || raw.fit === "tile") ref.fit = raw.fit;
        else if (raw.fit !== undefined) odrzucone.push(`assets[${i}].fit`);
        if (typeof raw.prompt === "string" && raw.prompt.trim()) {
          ref.prompt = raw.prompt.trim().slice(0, 300);
        }
        zajeteSloty.add(slot);
        assets.push(ref);
      });
      if (assets.length > 0) def.assets = assets;
    } else odrzucone.push("assets");
  }

  // nieznane pola najwyższego poziomu
  const znane = new Set([
    "schemaVersion",
    "tokens",
    "layout",
    "components",
    "states",
    "animations",
    "responsive",
    "assets",
    // pola metadanych generatora — dopuszczone, ignorowane przy kompilacji
    "name",
    "description",
    "colorScheme",
    "rationale",
  ]);
  for (const k of Object.keys(zrodlo)) if (!znane.has(k)) odrzucone.push(k);

  return { definicja: def, odrzucone };
}

/** Parsuje JSON definicji z DB → bezpieczna definicja (albo pusta przy błędzie). */
export function parseDefinicja(json: string | null | undefined): DefinicjaZaawansowana {
  if (!json) return pusta();
  try {
    return walidujDefinicje(JSON.parse(json)).definicja;
  } catch {
    return pusta();
  }
}
