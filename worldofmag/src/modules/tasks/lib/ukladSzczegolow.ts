/**
 * 105 (AC-10, AC-12a) — UKŁAD PANELU SZCZEGÓŁÓW ZADANIA, zapamiętany między wizytami.
 *
 * Dlaczego `localStorage`, a nie kolumna w bazie: to jest **geometria jednego ekranu**, a nie dane
 * użytkownika. Ta sama osoba chce innej szerokości panelu na 27-calowym monitorze i na 13-calowym
 * laptopie, więc przeniesienie ustawienia między urządzeniami byłoby wadą, nie zaletą. Kolumna
 * oznaczałaby migrację, akcję serwerową i odczyt przy każdym renderze — dokładnie ten sam argument,
 * którym kieruje się `platform/admin/trybAdmina`.
 *
 * Jeden klucz na obie wartości, bo to jedno ustawienie („jak oglądam zadanie"), a dwa klucze
 * znaczyłyby dwa nośniki tej samej rzeczy.
 *
 * Odczyt i zapis w `try/catch`: prywatne okno, wyczyszczone dane witryny i przeglądarka
 * z zablokowanym magazynem to **poprawne stany**, nie błędy — wtedy obowiązują wartości domyślne.
 */

const KLUCZ = "omnia.zadania.uklad";

export interface UkladSzczegolow {
  /** Szerokość panelu bocznego w pikselach. */
  szerokosc: number;
  /** Czy zadanie zajmuje całą przestrzeń roboczą modułu (lista ustępuje). */
  pelny: boolean;
}

/** Panel węższy niż to chowa treść, szerszy — zjada listę, po którą się tu przyszło. */
export const SZEROKOSC_MIN = 360;
export const SZEROKOSC_MAX = 900;

export const UKLAD_DOMYSLNY: UkladSzczegolow = { szerokosc: 480, pelny: false };

/**
 * Sufit zależy od okna: na wąskim ekranie 900 px zostawiłoby listę jako pasek kilku pikseli.
 * Liczony w momencie użycia, bo okno da się zmienić po odczycie preferencji.
 */
export function ograniczSzerokosc(px: number, szerokoscOkna: number): number {
  const sufit = Math.min(SZEROKOSC_MAX, Math.round(szerokoscOkna * 0.7));
  return Math.max(SZEROKOSC_MIN, Math.min(px, Math.max(SZEROKOSC_MIN, sufit)));
}

export function odczytajUklad(): UkladSzczegolow {
  try {
    const surowe = window.localStorage.getItem(KLUCZ);
    if (!surowe) return UKLAD_DOMYSLNY;
    const dane = JSON.parse(surowe) as Partial<UkladSzczegolow>;
    return {
      szerokosc: typeof dane.szerokosc === "number" && Number.isFinite(dane.szerokosc)
        ? dane.szerokosc
        : UKLAD_DOMYSLNY.szerokosc,
      pelny: dane.pelny === true,
    };
  } catch {
    return UKLAD_DOMYSLNY;
  }
}

export function zapiszUklad(uklad: UkladSzczegolow): void {
  try {
    window.localStorage.setItem(KLUCZ, JSON.stringify(uklad));
  } catch {
    /* magazyn niedostępny — ustawienie po prostu nie przeżyje odświeżenia */
  }
}
