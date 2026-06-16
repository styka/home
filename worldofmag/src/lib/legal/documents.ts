/**
 * Z-053 (RODO) — dokumenty prawne i rejestr podprocesorów.
 *
 * UWAGA: treść polityki prywatności i regulaminu jest WERSJĄ ROBOCZĄ (`draft`)
 * przygotowaną technicznie — **wymaga weryfikacji prawnika/DPO przed publicznym
 * startem**. Mechanizm zgód (wersjonowanie + zapis akceptacji) jest gotowy.
 *
 * Wersja dokumentu (`version`) jest powiązana z treścią — po zmianie treści podnieś
 * `version`, a użytkownicy zostaną poproszeni o ponowną akceptację (baner zgód).
 */
export interface LegalDoc {
  key: string;
  title: string;
  version: string;
  updatedAt: string;
  draft: boolean;
  /** Czy dokument wymaga zgody (baner). Rejestr podprocesorów jest informacyjny. */
  consent: boolean;
  markdown: string;
}

const PRIVACY: LegalDoc = {
  key: "privacy",
  title: "Polityka prywatności",
  version: "2026-06-16",
  updatedAt: "2026-06-16",
  draft: true,
  consent: true,
  markdown: `# Polityka prywatności

> **Wersja robocza — wymaga weryfikacji prawnej (DPO/radca) przed publicznym startem.**

## 1. Administrator danych
Administratorem danych jest właściciel aplikacji **Omnia** (WorldOfMag). Kontakt: tyka.szymon@gmail.com.

## 2. Jakie dane przetwarzamy
- dane konta (adres e-mail, imię, awatar) — z logowania Google,
- dane, które sam wprowadzasz w modułach (zadania, notatki, finanse, zdrowie, zwierzęta itd.),
- dane techniczne niezbędne do działania (sesja, preferencje, logi aktywności).

## 3. Cele i podstawy przetwarzania
- świadczenie usługi (art. 6 ust. 1 lit. b RODO),
- prawnie uzasadniony interes — bezpieczeństwo, diagnostyka (art. 6 ust. 1 lit. f),
- zgoda — funkcje opcjonalne, np. asystent AI dla danych wrażliwych (art. 6 ust. 1 lit. a; art. 9 dla danych zdrowotnych).

## 4. Odbiorcy / podprocesorzy
Dane mogą być powierzane podprocesorom wymienionym w **[Rejestrze podprocesorów](/legal/podprocesorzy)**.

## 5. Twoje prawa
Masz prawo do dostępu, sprostowania, **usunięcia** („prawo do bycia zapomnianym”), ograniczenia,
**przenoszenia danych** oraz sprzeciwu. Eksport i usunięcie konta zrealizujesz samodzielnie w
**Ustawienia → Prywatność i dane**.

## 6. Okres przechowywania
Dane przechowujemy do czasu usunięcia konta lub wycofania zgody; kosz/logi wg polityki retencji.

## 7. Dane wrażliwe (zdrowie)
Moduł Zdrowie przetwarza dane szczególnej kategorii wyłącznie na podstawie Twojej zgody i z
podwyższoną ochroną; przetwarzanie przez AI jest opcjonalne (opt-in).
`,
};

const TERMS: LegalDoc = {
  key: "terms",
  title: "Regulamin",
  version: "2026-06-16",
  updatedAt: "2026-06-16",
  draft: true,
  consent: true,
  markdown: `# Regulamin

> **Wersja robocza — wymaga weryfikacji prawnej przed publicznym startem.**

## 1. Postanowienia ogólne
Regulamin określa zasady korzystania z aplikacji **Omnia** — osobistego systemu do zarządzania
życiem i pracą.

## 2. Konto
Dostęp wymaga zalogowania (Google). Odpowiadasz za poufność dostępu do swojego konta.

## 3. Zasady korzystania
Nie wolno wykorzystywać aplikacji niezgodnie z prawem ani naruszać praw innych użytkowników
(np. w module Usługi). Treści wprowadzasz na własną odpowiedzialność.

## 4. Usługi (marketplace)
Aplikacja pośredniczy w kontakcie między klientem a wykonawcą. Rozliczenia i spory regulują
odrębne zasady modułu Usługi.

## 5. Odpowiedzialność
Usługa dostarczana jest „tak jak jest”. W zakresie dozwolonym prawem ograniczamy odpowiedzialność
za przerwy i utratę danych — wykonuj kopie istotnych treści (eksport danych).

## 6. Zmiany
O istotnych zmianach regulaminu poinformujemy w aplikacji; dalsze korzystanie oznacza akceptację.
`,
};

const PROCESSORS: LegalDoc = {
  key: "podprocesorzy",
  title: "Rejestr podprocesorów",
  version: "2026-06-16",
  updatedAt: "2026-06-16",
  draft: false,
  consent: false,
  markdown: `# Rejestr podprocesorów

Lista podmiotów, którym powierzamy przetwarzanie danych w celu świadczenia usługi.

| Podprocesor | Cel | Zakres danych | Lokalizacja |
|---|---|---|---|
| **Google** (OAuth, opcjonalnie Drive) | logowanie, opcjonalny zapis plików na Twoim Dysku | e-mail, profil, pliki które sam wgrasz | UE/USA (SCC) |
| **Groq / dostawca LLM** | funkcje AI (asystent, parsowanie, OCR) | treść zapytań do AI (minimalizowana) | USA (SCC) |
| **Neon** (PostgreSQL) | hosting bazy danych | wszystkie dane aplikacji | UE (Frankfurt) |
| **Render** | hosting aplikacji | dane przetwarzane w trakcie żądań | UE (Frankfurt) |

> Lista jest aktualizowana wraz ze zmianami infrastruktury. Korzystanie z funkcji AI dla danych
> wrażliwych (Zdrowie) jest opcjonalne (opt-in).
`,
};

export const LEGAL_DOCUMENTS: LegalDoc[] = [PRIVACY, TERMS, PROCESSORS];

/** Dokumenty wymagające zgody (do banera). */
export const CONSENT_DOCUMENTS = LEGAL_DOCUMENTS.filter((d) => d.consent);

export function getLegalDoc(key: string): LegalDoc | undefined {
  return LEGAL_DOCUMENTS.find((d) => d.key === key);
}
