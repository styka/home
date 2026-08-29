// 115 (Z-INT-06/07): zapis OSOBY wpisanej tekstem przy rekordzie innego modułu (lekarz przy
// wizycie, weterynarz przy wizycie zwierzęcia, wykonawca z marketplace'u) do Kontaktów.
//
// Mieszka w `src/lib` (warstwa kompozycji), bo konsumentów jest trzech — Zdrowie, Zwierzęta,
// Usługi — a reguła przynależności mówi: helper wielu modułów zostaje wspólny. Idzie przez
// KONTRAKT Kontaktów, więc guardy własności robi moduł docelowy.

import { createContact, getContacts } from "@/modules/contacts/contract";

export type WpisKontaktu = {
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  /** Rola źródłowa — trafia do tagów ("lekarz" | "weterynarz" | "wykonawca" …). */
  tag: string;
  notes?: string | null;
};

export type WynikZapisuKontaktu = { utworzono: boolean; istnial: boolean };

/**
 * Czy wśród kontaktów jest już dokładnie ta osoba. Dopasowanie po NAZWIE bez rozróżniania
 * wielkości liter — ta sama nazwa wpisana przy drugiej wizycie nie ma tworzyć duplikatu,
 * a nic mocniejszego (telefon, e-mail) źródła zwykle nie niosą.
 */
export function dopasujIstniejacy(kontakty: Array<{ name: string }>, name: string): boolean {
  const szukana = name.trim().toLocaleLowerCase("pl-PL");
  return kontakty.some((k) => k.name.trim().toLocaleLowerCase("pl-PL") === szukana);
}

/** Tworzy kontakt z wpisu, chyba że kontakt o tej nazwie już istnieje. */
export async function zapiszKontaktZWpisu(w: WpisKontaktu): Promise<WynikZapisuKontaktu> {
  const name = w.name.trim();
  if (!name) throw new Error("Brak nazwy osoby do zapisania");

  const istniejace = await getContacts(name);
  if (dopasujIstniejacy(istniejace, name)) return { utworzono: false, istnial: true };

  await createContact({
    name,
    phone: w.phone ?? null,
    email: w.email ?? null,
    company: w.company ?? null,
    tags: [w.tag],
    notes: w.notes ?? null,
  });
  return { utworzono: true, istnial: false };
}
