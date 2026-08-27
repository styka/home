import { redirect } from "next/navigation";
import { SekcjaNieznaleziona } from "@/components/settings/SekcjaNieznaleziona";
import { auth } from "@/platform/auth/session";
import { znajdzSekcje } from "@/lib/ustawienia/sekcje";
import { RamaSekcji } from "@/components/settings/RamaSekcji";
import { Konto } from "@/components/settings/sekcje/Konto";
import { Wyglad } from "@/components/settings/sekcje/Wyglad";
import { Nawigacja } from "@/components/settings/sekcje/Nawigacja";
import { Jezyk } from "@/components/settings/sekcje/Jezyk";
import { Polaczenia } from "@/components/settings/sekcje/Polaczenia";
import { Asystent } from "@/components/settings/sekcje/Asystent";
import { Zespoly } from "@/components/settings/sekcje/Zespoly";
import { Pomoc } from "@/components/settings/sekcje/Pomoc";
import { Prywatnosc } from "@/components/settings/sekcje/Prywatnosc";
import { Aktywnosc } from "@/components/settings/sekcje/Aktywnosc";

/**
 * 109: TRASA POJEDYNCZEJ SEKCJI USTAWIEŃ.
 *
 * Jedna trasa parametryczna zamiast dziesięciu katalogów (C-53): rama, walidacja segmentu i obsługa
 * złego adresu mają po jednym miejscu. Rozdział danych — właściwy cel podziału — daje nie trasa,
 * tylko osobny komponent serwerowy per sekcja: każdy awaituje WYŁĄCZNIE swoje zapytania, więc
 * wejście w „Wygląd" nie czeka już na `getRecentActivity(30)`.
 *
 * **Kontrola dostępu stoi tutaj, mimo że `src/middleware.ts` bramkuje wszystko sesją.** Rozbicie
 * jednej chronionej strony na kilka adresów mnoży miejsca do obronienia, a pominięcie kontroli na
 * którymś z nich nie objawia się niczym widocznym w interfejsie.
 *
 * Segment `team` jest trasą STATYCZNĄ (`/settings/team/...`) i ma pierwszeństwo przed tym
 * parametrem; samo `/settings/team` nie jest sekcją, więc trafia w widok „nie ma takiej sekcji"
 * ze spisem — przed 109 ta ścieżka dawała 404, czyli użytkownik dostaje więcej, nie mniej.
 */
export default async function SekcjaUstawienPage({
  params,
  searchParams,
}: {
  params: { sekcja: string };
  searchParams?: { drive?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  /**
   * Nieznany segment dostaje SPIS Z WYJAŚNIENIEM, a nie `notFound()`.
   *
   * Zmierzone (trzy próby, każda osobno): `notFound()` na tej trasie nie dowoził treści strony 404
   * ani w odpowiedzi serwera, ani w przeglądarce w ciągu 10 s — użytkownik zostawał na stanie
   * ładowania. Nie pomogła własna granica `not-found.tsx` w segmencie, przestawienie `notFound()`
   * przed pierwszy `await` ani usunięcie `settings/loading.tsx`. Status i tak był 200, więc
   * `notFound()` nie dawał nawet tego, po co się go zwykle woła. Uzasadnienie w
   * `SekcjaNieznaleziona`.
   */
  const sekcja = znajdzSekcje(params.sekcja);
  if (!sekcja) return <SekcjaNieznaleziona />;

  return <RamaSekcji sekcjaId={sekcja.id}>{tresc(sekcja.id, searchParams)}</RamaSekcji>;
}

/**
 * Dobór treści sekcji.
 *
 * Wszystkie dziesięć komponentów jest importowanych statycznie i to jest świadome: są to komponenty
 * SERWEROWE, więc do przeglądarki i tak trafia wyłącznie to, co renderuje wybrana sekcja. Gdyby
 * kiedyś zaczęły ciążyć, właściwym narzędziem jest `dynamic()` na konkretnym komponencie, a nie
 * podmiana `switch`-a na mapę — mapa nie zmienia grafu ani o jeden moduł.
 */
function tresc(id: string, searchParams?: { drive?: string }) {
  switch (id) {
    case "konto":
      return <Konto />;
    case "wyglad":
      return <Wyglad />;
    case "nawigacja":
      return <Nawigacja />;
    case "jezyk":
      return <Jezyk />;
    case "polaczenia":
      return <Polaczenia notice={searchParams?.drive} />;
    case "asystent":
      return <Asystent />;
    case "zespoly":
      return <Zespoly />;
    case "pomoc":
      return <Pomoc />;
    case "prywatnosc":
      return <Prywatnosc />;
    case "aktywnosc":
      return <Aktywnosc />;
    default:
      // Nieosiągalne: `znajdzSekcje` odrzuciło już nieznany segment. Zostaje jako jawny brak, żeby
      // dopisanie pozycji do rejestru BEZ treści skończyło się czytelnym ekranem ze spisem,
      // a nie pustym miejscem, w którym nie widać, czego brakuje.
      return <SekcjaNieznaleziona />;
  }
}
