import { notFound, redirect } from "next/navigation";
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
 * Jedna trasa parametryczna zamiast dziesięciu katalogów (C-53): rama, walidacja segmentu i `404`
 * mają po jednym miejscu. Rozdział danych — właściwy cel podziału — daje nie trasa, tylko osobny
 * komponent serwerowy per sekcja: każdy awaituje WYŁĄCZNIE swoje zapytania, więc wejście w „Wygląd"
 * nie czeka już na `getRecentActivity(30)`.
 *
 * **Kontrola dostępu stoi tutaj, mimo że `src/middleware.ts` bramkuje wszystko sesją.** Rozbicie
 * jednej chronionej strony na kilka adresów mnoży miejsca do obronienia, a pominięcie kontroli na
 * którymś z nich nie objawia się niczym widocznym w interfejsie.
 *
 * Segment `team` jest trasą STATYCZNĄ (`/settings/team/...`) i ma pierwszeństwo przed tym
 * parametrem; samo `/settings/team` nie jest sekcją, więc daje 404 — dokładnie jak przed 109.
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

  const sekcja = znajdzSekcje(params.sekcja);
  if (!sekcja) notFound();

  return <RamaSekcji sekcjaId={sekcja.id}>{tresc(sekcja.id, searchParams)}</RamaSekcji>;
}

/**
 * Dobór treści sekcji. Świadomie `switch`, a nie mapa id → komponent: mapa na poziomie modułu
 * wciągnęłaby do grafu wszystkie dziesięć komponentów przy wejściu w jeden — ta sama lekcja, którą
 * 050 wyciągnęło z pliku zbiorczego leniwych loaderów.
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
      // Nieosiągalne: `znajdzSekcje` odrzuciło już nieznany segment. Zostaje jako jawny brak,
      // żeby dodanie pozycji do rejestru bez treści padło tutaj, a nie pustym ekranem.
      notFound();
  }
}
