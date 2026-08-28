"use client";

import { useCallback, useEffect, useRef, type MutableRefObject, type ReactNode, type RefObject } from "react";
import { usePrzywroceniePrzewijania } from "@/hooks/usePrzywroceniePrzewijania";
import { PageHeader } from "@/components/ui/home/PageHeader";
import { ViewBar } from "./ViewBar";
import { ChromeFrame } from "./ChromeFrame";
import { ViewEmpty, ViewError, ViewLoading, ViewNoAccess, type ViewStateKind } from "./ViewState";
import type { ViewResource } from "./ViewChrome";

/**
 * 045 — KONTRAKT WIDOKU. Moduł **deklaruje** widok; powłoka **rysuje ramę**.
 *
 * Problem, który to rozwiązuje, jest kosztowy, nie estetyczny: nagłówek, pasek narzędzi
 * i stany brzegowe były pisane od nowa w każdym z 21 modułów, każdy trochę inaczej, więc
 * jedna poprawka UX wymagała obejścia dwudziestu jeden miejsc (rozdz. 10.4 architektury
 * docelowej).
 *
 * Nagłówek renderuje wewnętrznie istniejący `PageHeader` — używany już w ~30 komponentach.
 * To celowe: migracja modułu jest wtedy PODMIANĄ OPAKOWANIA, a nie przepisaniem nagłówka,
 * więc „zero zmian zachowania" jest sprawdzalne wzrokiem, a nie obietnicą.
 *
 * `state` jest jedyną drogą do stanów brzegowych. Dzięki temu bramka `check:ui-contract`
 * ma co sprawdzać: moduł, który zapomniał o stanie pustym, nie przechodzi builda.
 */

export interface ModuleViewProps {
  // ── nagłówek ──
  icon: ReactNode;
  iconColor?: string;
  title: string;
  subtitle?: string;
  /** Gdy podane — tytuł staje się linkiem do strony głównej działu. */
  href?: string;
  /** Prawy górny róg nagłówka (np. przycisk główny modułu). */
  headerAction?: ReactNode;

  /**
   * Link powrotny nad nagłówkiem („‹ Portfel", „‹ Wszystkie usługi").
   *
   * Trafił do kontraktu, bo powtarzał się w ośmiu widokach podrzędnych, za każdym razem
   * z lekko innym odstępem i rozmiarem ikony. Skoro rama i tak zna miejsce nad tytułem,
   * niech pilnuje go w jednym miejscu.
   */
  breadcrumb?: ReactNode;

  // ── pasek widoku ──
  filters?: ReactNode;
  actions?: ReactNode;

  /**
   * 087 (AC-7, AC-8): USTAWIENIA MODUŁU — jedno miejsce dla całej aplikacji.
   *
   * Do 087 Wiadomości trzymały wejście do ustawień jako czwartą ZAKŁADKĘ, czyli w miejscu na
   * *widoki*, nie na konfigurację. Właściciel zauważył, że „każdy lub prawie każdy moduł będzie miał
   * jakieś ustawienia", więc miejsce trzeba wybrać raz — inaczej każdy kolejny moduł wymyśli własne.
   *
   * Rama rysuje koło zębate jako OSTATNIĄ pozycję strefy akcji. Pole jest opcjonalne, więc moduł bez
   * ustawień wygląda dokładnie jak dziś; `active` zaznacza stan „jestem w ustawieniach" i pozwala
   * temu samemu przyciskowi być wyjściem (bez zakładki nie byłoby dokąd wracać).
   */
  settings?: { onClick?: () => void; href?: string; active?: boolean; label?: string };

  /**
   * 108: wejście do PRZEWODNIKA tego modułu — ikona pomocy przed kołem zębatym ustawień.
   *
   * Rozszerzenie kontraktu, nie wyjątek w module (C-33). Moduł podaje wynik
   * `hrefPrzewodnikaModulu(<id>)`; dla modułu bez przewodnika jest to `undefined`, więc ikona
   * po prostu nie powstaje. Kolejny moduł włącza pomoc dopisaniem treści i jednej linii u siebie —
   * bez wracania tutaj.
   */
  help?: { href: string; label?: string };

  /**
   * 087 (AC-1): RAMA BEZ CHROMU — widok bierze na siebie całą nawigację.
   *
   * Dołożone dla trybu czytania w Wiadomościach. Samo `filters={undefined}` nie wystarcza: w
   * wariancie gęstym pasek renderuje się ZAWSZE, bo to on niesie tytuł. Przełączanie gęstości też
   * nie jest wyjściem — w trybie czytania wróciłby duży nagłówek i chromu byłoby WIĘCEJ, nie mniej
   * (68 px bloku nagłówka zamiast 48 px paska).
   *
   * Domyślnie wyłączone, więc żaden istniejący widok nie jest dotknięty. Widok, który o to prosi,
   * musi mieć własne, zawsze widoczne wyjście z tego stanu — inaczej użytkownik zostaje w ramie
   * bez klamki.
   */
  chromeless?: boolean;
  // ── stany brzegowe ──
  /**
   * `ready` renderuje `children`. Pozostałe wartości renderują wspólny stan brzegowy
   * ZAMIAST treści — moduł nie rysuje ich samodzielnie.
   */
  state?: ViewStateKind;
  empty?: { title?: string; description?: string; icon?: ReactNode; action?: { label: string; onClick?: () => void; href?: string } };
  error?: { title?: string; description?: string; onRetry?: () => void };
  noAccess?: { title?: string; description?: string };
  loadingRows?: number;

  /**
   * Zasób, którego dotyczy widok. **Zarezerwowany, dziś nieaktywny** (plan §5.2) —
   * istnieje po to, żeby udostępnianie, okno konfliktu i awatary obecności (Fazy 2 i 4
   * przebudowy) dało się dołożyć bez wracania do 21 modułów.
   */
  resource?: ViewResource;

  /** Szerokość treści; `narrow` = kolumna czytelnicza (jak `pageInnerStyle`). */
  width?: "full" | "narrow";

  /**
   * Układ treści.
   *
   * `column` (domyślny) — treść płynie w pionie, rama przewija całość. Tak działa
   * większość widoków listowych.
   *
   * `fill` — treść dostaje CAŁĄ pozostałą wysokość i przewija się sama. Potrzebne
   * modułom wielopanelowym (Zadania, Notatki, Zakupy, Wiadomości, Pogoda,
   * Magazynowanie), gdzie panel boczny i lista mają osobne przewijanie. Bez tego
   * wariantu rama musiałaby narzucić im jeden scroll na całość — czyli przebudowę
   * układu, a nie migrację nagłówka.
   *
   * To jest odpowiedź na punkt kontrolny z planu: kontrakt ma unieść najbardziej
   * nietypowe widoki, a jeśli nie unosi — poszerzamy kontrakt, nie obchodzimy go
   * w module.
   */
  layout?: "column" | "fill";

  /**
   * Gęstość nagłówka.
   *
   * `comfortable` (domyślna) — tytuł 22 px w osobnym wierszu, jak dotąd.
   *
   * `compact` — tytuł wchodzi INLINE do paska widoku, w jednym wierszu z filtrami
   * i akcjami. Dla widoków, które mają własny gęsty pasek narzędzi (Zadania, Zakupy,
   * Notatki): tam duży nagłówek dołożyłby drugi wiersz chromu na ekranie, na którym
   * liczy się każdy piksel listy. Kontrakt ma bronić UX, a nie narzucać jeden rozmiar
   * wszystkim — stąd wariant zamiast wyjątku.
   */
  density?: "comfortable" | "compact";

  /**
   * Odstęp między blokami treści. Domyślnie 24 px — dokładnie tyle, ile miał
   * `pageInnerStyle`, z którego migrują moduły. Dzięki temu podmiana opakowania nie
   * przesuwa ani jednego piksela, a „zero zmian zachowania" jest sprawdzalne wzrokiem.
   */
  contentGap?: number;

  /**
   * Referencja do kontenera PRZEWIJANIA widoku.
   *
   * Potrzebna modułom, które wirtualizują długie listy (Kontakty, Magazynowanie):
   * `@tanstack/react-virtual` musi znać element, który faktycznie się przewija, a od
   * kontraktu widoku należy on do ramy, nie do modułu. Bez tego moduł musiałby
   * zbudować własny kontener przewijania wewnątrz ramy — czyli dwa zagnieżdżone
   * scrolle i sklejony pasek na telefonie.
   */
  scrollRef?: RefObject<HTMLDivElement>;

  children?: ReactNode;
}

export function ModuleView({
  icon,
  iconColor,
  title,
  subtitle,
  href,
  headerAction,
  breadcrumb,
  filters,
  actions,
  settings,
  help,
  chromeless = false,
  state = "ready",
  empty,
  error,
  noAccess,
  loadingRows,
  width = "full",
  layout = "column",
  density = "comfortable",
  contentGap = 24,
  scrollRef,
  children,
}: ModuleViewProps) {
  const fill = layout === "fill";
  const compact = density === "compact";
  /**
   * Czy pasek widoku ma cokolwiek do pokazania — DOKŁADNIE ten sam warunek, co w `ViewBar`.
   *
   * Recenzja 085: po rozdzieleniu bloków opakowanie paska renderowało się zawsze, także wtedy, gdy
   * `ViewBar` zwracał `null` (widok bez filtrów i bez akcji — dziś co najmniej dziesięć widoków,
   * m.in. Usługi i Warsztaty). Zostawał po nim pusty pasek wysokości `12px + var(--view-padding)`
   * pod nagłówkiem: nie błąd wyglądający na błąd, tylko dziura, którą łatwo wziąć za odstęp.
   */
  const pasekMaTresc = !chromeless && (compact || !!filters || !!actions || !!settings || !!help);

  /**
   * Wysokość przyklejonego paska jako zmienna CSS na ramie.
   *
   * Czytają ją moduły, które mają WŁASNY przyklejony pasek wewnątrz treści (dziś: Wiadomości) —
   * bez tego ich pasek przykleiłby się na wysokości 0 i wjechał pod ten. Publikujemy ją tylko
   * w układzie `column`: w `fill` pasek nie należy do obszaru przewijania, więc dla elementów
   * w środku jego wysokość wynosi zero.
   */
  const ramaRef = useRef<HTMLDivElement>(null);
  const pasekRef = useRef<HTMLDivElement>(null);

  /**
   * 111: PRZYWRACANIE POZYCJI PRZEWIJANIA PRZY POWROCIE „WSTECZ".
   *
   * Zgłoszenie właściciela: powrót na przewiniętą stronę pokazywał ją od góry. Przyczyna leży
   * dokładnie tutaj: przewija się TEN kontener, a nie okno — `<main>` powyżej ma `overflow: hidden`
   * — więc przywracanie pozycji przez przeglądarkę i przez Next, które dotyczy okna, dla niego nie
   * istniało. Wpięcie w ramę obsługuje wszystkie widoki modułów i panel administratora naraz.
   *
   * **Znane ograniczenie:** w `layout="fill"` przewija się treść modułu, a nie ten kontener
   * (`overflowY: hidden` niżej), więc tam pozycja nie jest jeszcze pamiętana. Świadomie poza
   * zakresem — te widoki mają własne, osobne kontenery przewijania w panelach.
   *
   * Własny `ref` jest potrzebny, bo `scrollRef` jest OPCJONALNY (podają go tylko listy
   * wirtualizowane). Gdy moduł go poda, oba wskazują ten sam element — jeden kontener, jeden zapis.
   */
  const przewijanieRef = useRef<HTMLDivElement | null>(null);
  usePrzywroceniePrzewijania(przewijanieRef);
  const ustawKontenerPrzewijania = useCallback(
    (el: HTMLDivElement | null) => {
      przewijanieRef.current = el;
      // `RefObject.current` jest w typach tylko do odczytu, ale to jest zwykły obiekt
      // `useRef` konsumenta — dokładnie tak działa łączenie referencji w Reakcie.
      if (scrollRef) (scrollRef as unknown as MutableRefObject<HTMLDivElement | null>).current = el;
    },
    [scrollRef],
  );
  useEffect(() => {
    const rama = ramaRef.current;
    if (!rama) return;
    const pasek = pasekRef.current;
    if (!pasek) {
      // Widok bez paska (brak filtrów i akcji): zasłona ma wysokość zero, a nie „poprzednią".
      rama.style.setProperty("--view-bar-h", "0px");
      return;
    }
    const ustaw = () => rama.style.setProperty("--view-bar-h", fill ? "0px" : `${pasek.offsetHeight}px`);
    ustaw();
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(ustaw);
    obs.observe(pasek);
    return () => obs.disconnect();
  }, [fill, pasekMaTresc]);

  return (
    /**
     * 083: DWIE warstwy zamiast jednej — nieruchoma rama i przewijana treść w środku.
     *
     * Wcześniej `ChromeFrame` siedział WEWNĄTRZ elementu z `overflow-y`, a `position: absolute;
     * inset: 0` odnosi się tam do całej przewijanej zawartości, nie do widocznego okna. Narożniki
     * skórki „Mostek" odjeżdżały więc razem z treścią. W modułach o krótkiej treści nie było tego
     * widać, bo nie ma czego przewijać — usterka ujawniała się wyłącznie tam, gdzie treść jest
     * długa (Wiadomości). To samo dotyczy tła: gradient `--bg-image-base` rozciągał się na pełną
     * wysokość przewijania zamiast na ekran, więc przy długiej liście „gubił" swój przebieg.
     *
     * Zewnętrzny element NIE przewija się i nosi tło oraz dekorację; przewijanie i `scrollRef`
     * (potrzebny listom wirtualizowanym) zostają na wewnętrznym.
     */
    <div
      ref={ramaRef}
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: "var(--bg-base)",
        backgroundImage: "var(--bg-image-base)",
      }}
    >
      {/* Dekoracja skórki. Widoczność rozstrzyga `data-chrome-frame` na <html>, więc dla
          większości skórek to jest pusty div bez kosztu. */}
      <ChromeFrame />

      <div
      ref={ustawKontenerPrzewijania}
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        // W układzie `fill` przewijanie należy do TREŚCI, nie do ramy — inaczej
        // panel boczny modułu przewijałby się razem z listą.
        overflowY: fill ? "hidden" : "auto",
      }}
    >
      {/**
       * 085 (AC-4): NAGŁÓWEK PRZEWIJA SIĘ, PASEK WIDOKU ZOSTAJE.
       *
       * Zgłoszenie właściciela: „czy to dobrze, że scrolując stronę w dół te akcje nie przyklejają
       * się do górnego paska?". Zmierzone przed zmianą: na /wiadomosci treść ma 11563 px przy oknie
       * 800 px, więc po jednym przewinięciu zakładki i „Nowy temat" były poza zasięgiem.
       *
       * DLACZEGO PRZEBUDOWA, A NIE SAMO `position: sticky`: element przyklejony trzyma się tylko
       * w granicach SWOJEGO RODZICA. Pasek stał dotąd w jednym opakowaniu z okruszkiem i nagłówkiem
       * strony, więc `sticky` odkleiłby go po przewinięciu o wysokość tego opakowania — czyli
       * dokładnie wtedy, kiedy zaczyna być potrzebny. Musi być BEZPOŚREDNIM dzieckiem kontenera
       * przewijania i dlatego rozdzielamy blok nagłówka od paska.
       *
       * Tytuł i podtytuł świadomie ZOSTAJĄ przewijalne: przyklejenie ich zabrałoby na telefonie
       * kilkadziesiąt pikseli listy na stałe, a to nie one były przedmiotem zgłoszenia.
       */}
      {!chromeless && (breadcrumb || !compact) && (
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: width === "narrow" ? 640 : undefined,
            margin: width === "narrow" ? "0 auto" : undefined,
            /**
             * Bez dolnego odstępu — jego rolę przejmuje górny odstęp paska niżej, żeby suma
             * pozostała dokładnie taka, jak przed rozdzieleniem (085).
             *
             * 087 (AC-16): …ale TYLKO gdy pasek w ogóle powstanie. Widok bez filtrów, akcji
             * i ustawień nie renderuje paska, więc razem z nim znikał też ten odstęp i treść
             * przyklejała się do tytułu — zmierzone 0 px w Pogodzie. Dotyczy to co najmniej
             * dziesięciu widoków (Pogoda, Usługi, Warsztaty…). Dokładamy dolne wypełnienie
             * dokładnie równe górnemu wypełnieniu paska, więc widoki Z paskiem nie drgają.
             */
            padding: compact
              ? "0 12px"
              : fill
                ? `8px var(--view-padding) ${pasekMaTresc ? "0" : "8px"}`
                : `var(--view-padding) var(--view-padding) ${pasekMaTresc ? "0" : "12px"}`,
            display: "flex",
            flexDirection: "column",
            gap: fill ? 8 : 12,
            flexShrink: 0,
          }}
        >
          {breadcrumb && <div style={{ marginBottom: -4 }}>{breadcrumb}</div>}

          {!compact && (
            <PageHeader
              icon={icon}
              iconColor={iconColor}
              title={title}
              subtitle={subtitle}
              href={href}
              action={headerAction}
            />
          )}
        </div>
      )}

      {pasekMaTresc && (
      <div
        ref={pasekRef}
        style={{
          // W układzie `fill` pasek i tak nie przewija się (przewija się wyłącznie treść), więc
          // przyklejanie byłoby tam bez skutku — i bez potrzeby.
          position: fill ? "relative" : "sticky",
          top: 0,
          // Nad treścią modułu, w tym nad jego własnymi przyklejonymi paskami (Wiadomości: 30).
          zIndex: 40,
          flexShrink: 0,
          width: "100%",
          // Nieprzezroczyste tło jest częścią mechanizmu, nie ozdobą: bez niego treść przewijałaby
          // się widocznie POD paskiem.
          background: "var(--bg-base)",
          /**
           * Odstępy przepisane 1:1 z opakowania sprzed rozdzielenia, żeby zmiana nie przesunęła
           * ani jednego piksela: górny odstęp zastępuje dawny `gap` między nagłówkiem a paskiem,
           * dolny — dawne dolne wypełnienie opakowania. Dolne wypełnienie należy teraz do PASKA,
           * więc treść przewija się pod całą jego wysokością razem z odstępem, a nie wjeżdża
           * w szczelinę pod obramowaniem.
           */
          padding: compact
            ? "0 12px"
            : fill
              ? "8px var(--view-padding) 0"
              : "12px var(--view-padding) var(--view-padding)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: width === "narrow" ? 640 : undefined,
            margin: width === "narrow" ? "0 auto" : undefined,
          }}
        >
          <ViewBar
            compact={compact}
            title={compact ? title : undefined}
            titleHref={compact ? href : undefined}
            icon={compact ? icon : undefined}
            iconColor={iconColor}
            filters={filters}
            help={help}
            settings={settings}
            actions={compact && headerAction ? (
              <>
                {actions}
                {headerAction}
              </>
            ) : actions}
          />
        </div>
      </div>
      )}

      {/* Treść. W `fill` dostaje resztę wysokości i własne przewijanie; w `column`
          płynie w ramie razem z nagłówkiem. */}
      <div
        style={
          fill
            ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }
            : {
                position: "relative",
                width: "100%",
                maxWidth: width === "narrow" ? 640 : undefined,
                margin: width === "narrow" ? "0 auto" : undefined,
                padding: "0 var(--view-padding) var(--view-padding)",
              }
        }
      >
        <ViewContent
          state={state}
          empty={empty}
          error={error}
          noAccess={noAccess}
          loadingRows={loadingRows}
          contentGap={fill ? 0 : contentGap}
          fill={fill}
        >
          {children}
        </ViewContent>
      </div>
      </div>
    </div>
  );
}

function ViewContent({
  state,
  empty,
  error,
  noAccess,
  loadingRows,
  contentGap,
  fill,
  children,
}: Pick<ModuleViewProps, "state" | "empty" | "error" | "noAccess" | "loadingRows" | "contentGap" | "children"> & {
  fill?: boolean;
}) {
  switch (state) {
    case "loading":
      return <ViewLoading rows={loadingRows} />;
    case "error":
      return <ViewError {...error} />;
    case "no-access":
      return <ViewNoAccess {...noAccess} />;
    case "empty":
      return <ViewEmpty {...empty} />;
    default:
      return (
        <div
          style={
            fill
              ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }
              : { display: "flex", flexDirection: "column", gap: contentGap }
          }
        >
          {children}
        </div>
      );
  }
}
