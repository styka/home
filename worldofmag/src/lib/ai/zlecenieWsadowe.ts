/**
 * 080 (Z6): rozpoznanie ZLECENIA WSADOWEGO — wiadomości, która jest listą, a nie pytaniem.
 *
 * Powstało z konkretnego zgłoszenia: właściciel wkleił ~100 produktów do dopisania do listy
 * zakupów i nie dostał nic. W logu tamtej rozmowy KAŻDE wywołanie modelu kończy się dokładnie na
 * `+1200` tokenów wyjścia — to nie odpowiedź, tylko odcięcie limitem. Plan wracał ucięty, pętla
 * powtarzała i po sześciu obrotach kończyła się komunikatem „zabrakło kroków". Dwie tury po ~60
 * tys. tokenów, zero efektu.
 *
 * Ta funkcja odpowiada wyłącznie na pytanie „czy warto zarezerwować większy zapas na odpowiedź".
 * Limit dotyczy WYJŚCIA, więc dla zwykłych pytań nic się nie zmienia — i o to chodzi: stała
 * rezerwacja jest wliczana do limitu zapytań na minutę, więc podnoszenie jej wszędzie kosztowałoby
 * przepustowość przy każdej rozmowie.
 *
 * Progi są celowo WYSOKIE. Fałszywe rozpoznanie kosztuje przepustowość; nierozpoznanie kosztuje
 * całe zlecenie. Ale „kilka linijek" to normalna wiadomość, nie lista zakupów.
 */

/** Tyle niepustych linii wystarczy, żeby uznać wiadomość za listę. */
const MIN_LINII = 12;
/** Albo tyle wypunktowanych pozycji, gdy linii jest mniej (np. lista sklejona w akapity). */
const MIN_PUNKTOROW = 8;

const PUNKTOR = /^[-*•]\s+/;
const NUMERACJA = /^\d+[.)]\s+/;

export function zlecenieWsadowe(text: string): boolean {
  const linie = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linie.length >= MIN_LINII) return true;
  const punktory = linie.filter((l) => PUNKTOR.test(l) || NUMERACJA.test(l)).length;
  return punktory >= MIN_PUNKTOROW;
}
