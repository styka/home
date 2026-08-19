import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";

/**
 * 098 — BRAMKA UPRAWNIENIA NA TRASIE MODUŁU.
 *
 * Nawigacja wygasza i blokuje pozycje, do których użytkownik nie ma uprawnienia (`isPathLocked`),
 * ale **to jest wyłącznie wygląd**. Wpisanie adresu z ręki omija nawigację, więc kontrola musi
 * stać na trasie. Do 098 stała na piętnastu z dziewiętnastu: `/kitchen`, `/notes`, `/shopping`
 * i `/tasks` — czyli cztery najczęściej używane moduły — sprawdzały tylko ZALOGOWANIE.
 *
 * Znalazł to klikacz (`[scenario-direct-url-blocked]`), który padał od dawna wśród sześćdziesięciu
 * innych czerwonych i przez to nie niósł żadnej informacji. To jest cena zepsutej siatki
 * bezpieczeństwa: prawdziwa dziura leżała w widocznym miejscu przez wiele przebiegów.
 *
 * **Co to naprawia, a czego nie.** Dane i tak są zawężone własnością (`ownedWhereAsync`), więc
 * użytkownik bez uprawnienia nie widział CUDZYCH danych — widział moduł, którego nie ma prawa
 * używać, ze swoimi. To jest błąd kontroli dostępu, nie wycieku.
 *
 * **Dlaczego w layoucie, a nie w stronie.** Layout obejmuje też podtrasy (`/shopping/[listId]`),
 * a strona tylko siebie. Kontrola tylko na stronie wpuszczałaby pod adres szczegółu.
 *
 * Administrator przechodzi zawsze — tak samo jak w pozostałych piętnastu trasach; ujednolicenie
 * tego zachowania było celem wydzielenia tej funkcji, żeby nie istniało piętnaście jego kopii.
 */
export async function wymagajDostepuDoModulu(permission: string | null) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (permission && !hasPermission(session, permission) && !hasPermission(session, PERMISSIONS.ADMIN)) {
    redirect("/");
  }
  return session;
}
