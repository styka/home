import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import { Shield } from "lucide-react"
import { auth } from "@/platform/auth/session"
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions"
import { RamaPanelu } from "@/components/admin/RamaPanelu"

/**
 * 110: PANEL ADMINISTRATORA JEST WYRZUTNIĄ, NIE STRONĄ Z TREŚCIĄ.
 *
 * Do 110 była to jedna kolumna na 408 linii: karta buildu, jedenaście liczników z bazy, skrót do
 * konfiguracji, **płaska lista dwudziestu jeden odnośników** bez grup i bez szukania, a na końcu
 * aktywna sesja. Zgłoszenie właściciela: „trzeba przewijać/szukać, gdzie coś jest, żeby do czegoś
 * dojść, i ciężko jest na to trafić".
 *
 * Dwie rzeczy zmieniły się naraz. (1) Narzędzia stoją w nazwanych grupach, każde z opisem, a nad
 * nimi jest wyszukiwarka. (2) Build, liczniki i sesja wyprowadziły się na `/admin/przeglad` — dzięki
 * czemu **wejście do panelu nie wykonuje już ani jednego zapytania zliczającego**. Przedtem płacił
 * za nie także ten, kto wchodził tylko po to, żeby kliknąć jedno narzędzie.
 *
 * Nagłówka nie rysujemy ręcznie — robi to rama widoku (C-33).
 */
export default async function AdminPage() {
  const session = await auth()
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/")

  const t = await getTranslations("app.admin.panel")

  return <RamaPanelu tytul={t("tytul")} podtytul={t("podtytul")} ikona={<Shield size={22} />} />
}
