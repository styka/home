/**
 * 084 (AC-21): pętla podejść do streszczania — WYDZIELONA z zadania odświeżania, żeby dało się ją
 * sprawdzić testem.
 *
 * Sedno poprawki jest w zachowaniu przy AWARII, a nie w treści promptu: partia, której nie udało się
 * przetworzyć (odmowa dostawcy, ucięta odpowiedź, nieczytelny JSON), ma wrócić do kolejnego
 * podejścia — a nie przerwać cały etap i zostawić bez streszczenia także wszystkie pozycje, których
 * model nawet nie zobaczył. Tego nie da się zobaczyć na oko w pętli splecionej z Prismą i modelem,
 * więc reguła mieszka tutaj, a `newsRefresh` dostarcza jej wykonawcę parametrem.
 *
 * Ten plik świadomie NIE zna Prismy ani dostawcy modelu — to jest cała jego wartość.
 */

/**
 * Wykonawca jednej partii. Sukces zgłasza **od razu, pozycja po pozycji**, przez `zglosSukces`.
 *
 * 084 (recenzja): wcześniej zwracał listę na końcu — a jeśli rzucił PO zapisaniu części pozycji
 * (drugie `update` odmówiło, dostawca urwał połączenie w środku pętli), lista przepadała razem
 * z wyjątkiem. Te pozycje miały już streszczenie w bazie i mimo to dostawały znacznik „bez
 * streszczenia". Zgłoszenie natychmiastowe znosi tę klasę błędu z definicji: co zapisane, to
 * policzone, niezależnie od tego, co stanie się w tej partii dalej.
 */
export type WykonawcaPartii<T> = (
  partia: T[],
  podejscie: number,
  zglosSukces: (id: string) => void
) => Promise<void>;

export interface WynikPodejsc {
  /** Identyfikatory pozycji, którym udało się nadać streszczenie. */
  udane: string[];
  /** Identyfikatory, które po wyczerpaniu podejść nadal go nie mają. */
  nieudane: string[];
  /** Ile podejść faktycznie wykonano — do postępu i do testów. */
  podejsc: number;
}

/**
 * Przetwarza pozycje partiami, ponawiając te, które nie wyszły.
 *
 * Rzucający wykonawca **nie przerywa** przebiegu: jego partia po prostu nie zgłasza żadnych
 * sukcesów, więc jej pozycje zostają na liście oczekujących i wchodzą do kolejnego podejścia — tą
 * samą drogą, co pozycje pominięte przez model w udanym wywołaniu.
 *
 * Podejście, które nie ruszyło **ani jednej** pozycji, kończy pętlę: kolejne wyglądałoby identycznie
 * i kosztowało tyle samo (reguła z 080, zachowana).
 */
export async function przetworzPartiami<T extends { id: string }>({
  pozycje,
  rozmiarPartii,
  maksPodejsc,
  wykonaj,
  onBlad,
}: {
  pozycje: T[];
  rozmiarPartii: number;
  maksPodejsc: number;
  wykonaj: WykonawcaPartii<T>;
  /** Zgłoszenie awarii partii — do logu i do postępu. Nie wpływa na przebieg. */
  onBlad?: (blad: unknown, podejscie: number, numerPartii: number) => void;
}): Promise<WynikPodejsc> {
  const udane = new Set<string>();
  let oczekujace = pozycje;
  let podejsc = 0;

  for (let podejscie = 1; podejscie <= maksPodejsc && oczekujace.length > 0; podejscie++) {
    podejsc = podejscie;
    const wTymPodejsciu = new Set<string>();
    const partii = Math.ceil(oczekujace.length / rozmiarPartii);

    for (let i = 0; i < partii; i++) {
      const partia = oczekujace.slice(i * rozmiarPartii, (i + 1) * rozmiarPartii);
      try {
        await wykonaj(partia, podejscie, (id) => {
          udane.add(id);
          wTymPodejsciu.add(id);
        });
      } catch (e) {
        onBlad?.(e, podejscie, i + 1);
        // Świadomie `continue`, nie `throw`: kolejne partie mają swoją szansę.
      }
    }

    if (wTymPodejsciu.size === 0) break;
    oczekujace = oczekujace.filter((p) => !wTymPodejsciu.has(p.id));
  }

  return {
    udane: Array.from(udane),
    nieudane: oczekujace.filter((p) => !udane.has(p.id)).map((p) => p.id),
    podejsc,
  };
}
