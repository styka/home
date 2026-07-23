# Spec: Naprawa czatu asystenta AI po wyborze dostawcy Anthropic (parametr `temperature`)

- **ID:** 026-anthropic-temperature-fix
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-23
- **Moduł(y):** Home (asystent AI) / warstwa integracji LLM

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Szczegóły techniczne (który plik, jaki warunek) należą do `plan.md`.

## 1. Problem / potrzeba
Po przełączeniu dostawcy LLM na **Anthropic** w panelu Admin → LLM asystent AI na stronie głównej
przestaje odpowiadać. Użytkownik pisze zwykłą wiadomość („Cześć") i dostaje komunikat „Asystent
chwilowo nie może połączyć się z modelem AI. Spróbuj ponownie za chwilę.". Diagnostyka wywołań modelu
pokazuje, że tańsze operacje `dispatch` (model Haiku) przechodzą (HTTP 200), ale kluczowa operacja
`reasoning` (agent asystenta, model **claude-sonnet-5**) pada z **HTTP 400** i błędem dostawcy:
```
`temperature` is deprecated for this model.
```
Efekt: cały asystent jest bezużyteczny dla dostawcy Anthropic z nowszymi modelami — mimo poprawnie
ustawionego dostawcy, klucza i przydziału modeli. To krytyczny błąd blokujący korzystanie z Anthropic.

## 2. Cel i miary sukcesu
- Cel: po wybraniu Anthropic jako dostawcy LLM asystent AI (oraz pozostałe operacje LLM) działają
  poprawnie na aktualnych modelach Anthropic — bez błędu 400 z powodu przekazywanego parametru
  `temperature`.
- Sukces mierzymy:
  - operacja `reasoning` (agent asystenta) na modelu Anthropic, który odrzuca `temperature`, zwraca
    poprawną odpowiedź (HTTP 200) zamiast błędu 400,
  - użytkownik wysyła wiadomość w czacie i otrzymuje odpowiedź asystenta,
  - w logu diagnostyki wywołań modelu nie pojawia się już wpis FAIL/400 z treścią
    „temperature is deprecated for this model".

## 3. Historyjki użytkownika
- Jako właściciel Omnii, po przełączeniu dostawcy LLM na Anthropic w panelu admina, chcę żeby asystent
  AI normalnie odpowiadał na moje wiadomości, żeby móc korzystać z modeli Anthropic zamiast Groq.
- Jako właściciel chcę, żeby przełączenie dostawcy/modelu w panelu nie wymagało żadnych dodatkowych
  ustawień ani obejść — ma po prostu działać.

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1** — Given dostawca LLM ustawiony na Anthropic z modelem, który odrzuca parametr
  `temperature` (np. `claude-sonnet-5`), when warstwa klienta LLM wykonuje operację `reasoning`
  (agent asystenta), then żądanie do Anthropic **nie zawiera** parametru `temperature` i kończy się
  powodzeniem (nie ma błędu 400 „temperature is deprecated").
- [ ] **AC-2** — Given ten sam dostawca/model, when użytkownik wysyła wiadomość w czacie asystenta na
  stronie głównej, then otrzymuje odpowiedź asystenta zamiast komunikatu o braku połączenia z modelem.
- [ ] **AC-3** — Given dostawca Anthropic, when wykonywana jest operacja LLM w trybie strumieniowym
  (streaming), then również **nie jest** wysyłany parametr `temperature` do modelu, który go odrzuca,
  i strumień odpowiedzi rusza poprawnie.
- [ ] **AC-4** — Given dostawca **Groq** (OpenAI-compatible) bez zmiany ustawień, when wykonywana jest
  dowolna operacja LLM, then zachowanie pozostaje **niezmienione** (parametr sterujący losowością jest
  nadal przekazywany tak jak dotąd) — naprawa nie regresuje działania Groq.
- [ ] **AC-5** — Given dostawca Anthropic i operacja wymagająca deterministycznego wyniku (np.
  `dispatch`/parsowanie), when jest wykonywana, then nadal zwraca poprawny wynik (jak dotąd, HTTP 200).

## 5. Zakres
**W zakresie:**
- Warstwa klienta LLM Omnii budująca żądania do dostawcy Anthropic (Messages API) — zarówno ścieżka
  jednorazowej odpowiedzi, jak i strumieniowa.
- Zaprzestanie wysyłania parametru `temperature` do modeli Anthropic, które go nie akceptują, tak aby
  operacje `reasoning`, `dispatch`, `vision`, `generation` działały po wyborze Anthropic.
- Wpis do `doświadczenia.md` z lekcją (C-51).

**Poza zakresem (świadomie):**
- Zmiana domyślnego dostawcy z Groq na Anthropic (pozostaje decyzją admina w panelu).
- Zmiana zachowania parametru `temperature` dla dostawców OpenAI-compatible (Groq/OpenAI) — tam działa
  poprawnie i zostaje bez zmian.
- Dodawanie nowych ustawień per-operację w UI panelu LLM.
- Szersza refaktoryzacja warstwy LLM czy mechanizmu fallbacku.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — korzysta z istniejącego `module.home` (asystent) i `module.admin`
  (panel LLM). Brak nowego slugu (C-22 nie dotyczy).
- **Własność danych:** nie dotyczy — brak nowych modeli danych ani migracji (to naprawa warstwy
  integracyjnej, nie danych).
- **Asystent AI:** dotyczy bezpośrednio — przywraca działanie agenta asystenta dla dostawcy Anthropic.
  Brak nowej `AIAction` ani read-toola (C-23 nie dotyczy — nie zmieniamy zestawu narzędzi agenta).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-40 (routing DB-driven)** — kluczowa: nie hardcodujemy dostawcy ani modelu; naprawa działa w
  ramach istniejącego rozwiązywania modelu per typ operacji. Warunek „czy wysłać temperature" zależy od
  **rodzaju dostawcy / modelu**, nie od zaszytego na sztywno providera w kodzie funkcji.
- **C-41 (klucze/komunikaty)** — nie logujemy ani nie zwracamy surowej treści klucza; komunikaty błędów
  pozostają bezpieczne.
- **C-53 (minimalizm)** — najmniejsza możliwa zmiana: warunkowe pominięcie jednego parametru w żądaniu
  do Anthropic; bez nowych zależności i refaktorów „przy okazji".
- **C-50 (build zielony)** — całość musi przejść `npm run build` (do kroku `next build`).
- **C-51 (lekcja)** — dopisujemy wpis do `doświadczenia.md`.
- **C-01/C-02** — praca tylko w `worldofmag/`, importy przez alias `@/*`.
- **C-52 (merge)** — po zielonym buildzie merge do `develop` i automatyczna promocja `develop → master`.

## 8. Otwarte pytania / decyzje właściciela
- Brak. Diagnostyka jednoznacznie wskazuje przyczynę i naprawę; sposób realizacji (pominięcie parametru
  dla modeli Anthropic, które go odrzucają) jest rozstrzygalny z kodu i dokumentacji API Anthropic —
  to detal techniczny do `plan.md`, nie decyzja właściciela (C-55). Domyślne założenie przyjęte bez
  pytania: **dla dostawcy Anthropic nie wysyłamy `temperature`** (Messages API użyje wartości domyślnej),
  co jest najbezpieczniejsze i odporne na przyszłe modele; determinizm operacji `dispatch`/JSON dla
  Anthropic i tak jest wymuszany promptem, nie parametrem.

## 9. Ryzyka
- **Ryzyko:** pominięcie `temperature` zmienia losowość odpowiedzi Anthropic (użyje domyślnej). →
  Ograniczamy: dla operacji wymagających determinizmu i tak polegamy na prompt-based JSON (Anthropic),
  a operacje `reasoning`/`generation` działają dobrze na domyślnej temperaturze.
- **Ryzyko:** regresja dla Groq/OpenAI, gdyby zmiana dotknęła wspólnej ścieżki. → Ograniczamy: zmiana
  jest ograniczona wyłącznie do ścieżki Anthropic; ścieżka OpenAI-compatible pozostaje nietknięta
  (AC-4).
- **Ryzyko:** przyszłe modele Anthropic mogą znów akceptować/wymagać `temperature`. → Ograniczamy:
  domyślne pomijanie jest zgodne z aktualnym kierunkiem API Anthropic i nie powoduje błędu na żadnym
  obecnym modelu (pominięty parametr = wartość domyślna).
