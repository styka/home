// 080 (Z7/Z2): CZYSTA geometria warstwy przyklejonej do elementu.
//
// Wydzielona z komponentu, bo to jest ta część, która była zepsuta — i jedyna, którą da się
// sprawdzić testem bez przeglądarki. `AiCostBadge` liczył wyłącznie oś POZIOMĄ i miał zaszyte
// `bottom: calc(100% + 6px)`, czyli otwierał się zawsze w górę. Przy przycisku blisko górnej
// krawędzi panel wychodził ponad ekran i nie dało się w niego kliknąć (zgłoszenie właściciela
// z /wiadomosci). Ta sama klasa błędu siedziała w panelach paska akcji zbiorczych.
//
// Dwie reguły, każda z konkretnego powodu:
//   1. ODBICIE w pionie: jeśli po preferowanej stronie nie ma miejsca, a po drugiej jest więcej —
//      otwieramy się w drugą. Nie „zawsze w dół": przy pasku przyklejonym do dołu ekranu w dół
//      miejsca nie ma nigdy.
//   2. PRZESUNIĘCIE w poziomie: panel dosuwamy do wnętrza okna, zamiast go przycinać. Wyrównanie
//      jest życzeniem, mieszczenie się w oknie — wymogiem.

export type PreferowanaStrona = "gora" | "dol";
export type Wyrownanie = "start" | "srodek" | "koniec";

export interface Prostokat {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface WejsciePozycji {
  /** Prostokąt wyzwalacza we współrzędnych okna (`getBoundingClientRect`). */
  wyzwalacz: Prostokat;
  /** Zmierzony rozmiar panelu. */
  panel: { width: number; height: number };
  okno: { width: number; height: number };
  strona?: PreferowanaStrona;
  wyrownanie?: Wyrownanie;
  /** Odstęp między wyzwalaczem a panelem. */
  odstep?: number;
  /** Margines od krawędzi okna — panel nigdy nie dotyka jej wprost. */
  margines?: number;
}

export interface Pozycja {
  top: number;
  left: number;
  /** Strona, po której panel faktycznie się otworzył (do strzałki/animacji). */
  strona: PreferowanaStrona;
  /** Maksymalna wysokość, jaka mieści się po tej stronie — panel ma się przewijać, nie wychodzić. */
  maxHeight: number;
}

export function obliczPozycje({
  wyzwalacz,
  panel,
  okno,
  strona = "dol",
  wyrownanie = "start",
  odstep = 6,
  margines = 8,
}: WejsciePozycji): Pozycja {
  const miejsceNadem = wyzwalacz.top - odstep - margines;
  const miejscePod = okno.height - (wyzwalacz.top + wyzwalacz.height) - odstep - margines;

  // Zostajemy przy preferowanej stronie, dopóki panel się tam mieści. Odbijamy dopiero wtedy,
  // gdy się nie mieści, A po drugiej stronie jest więcej miejsca — bo „mniej ciasno" to nadal
  // lepiej niż „poza ekranem".
  const preferowaneMiejsce = strona === "gora" ? miejsceNadem : miejscePod;
  const drugieMiejsce = strona === "gora" ? miejscePod : miejsceNadem;
  const finalnaStrona: PreferowanaStrona =
    panel.height <= preferowaneMiejsce || preferowaneMiejsce >= drugieMiejsce
      ? strona
      : strona === "gora"
        ? "dol"
        : "gora";

  const miejsce = finalnaStrona === "gora" ? miejsceNadem : miejscePod;
  const maxHeight = Math.max(0, miejsce);
  const wysokosc = Math.min(panel.height, maxHeight);

  const top =
    finalnaStrona === "gora"
      ? wyzwalacz.top - odstep - wysokosc
      : wyzwalacz.top + wyzwalacz.height + odstep;

  // Wyrównanie w poziomie to ŻYCZENIE…
  const zyczenie =
    wyrownanie === "koniec"
      ? wyzwalacz.left + wyzwalacz.width - panel.width
      : wyrownanie === "srodek"
        ? wyzwalacz.left + wyzwalacz.width / 2 - panel.width / 2
        : wyzwalacz.left;

  // …a mieszczenie się w oknie to WYMÓG. Przy panelu szerszym od okna dosuwamy do lewej krawędzi
  // (max wygrywa z min), żeby początek treści był widoczny — obcięty koniec boli mniej.
  const maxLeft = okno.width - panel.width - margines;
  const left = Math.max(margines, Math.min(zyczenie, maxLeft));

  return { top: Math.max(margines, top), left, strona: finalnaStrona, maxHeight };
}
