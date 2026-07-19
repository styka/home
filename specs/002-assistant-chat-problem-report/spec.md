# Spec: Zgłaszanie problemu z czatem asystenta AI (admin) → zadanie w Omnia

- **ID:** 002-assistant-chat-problem-report
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-19
- **Moduł(y):** Home / Asystent AI (`AICommandSheet`) + Tasks (projekt „Omnia")

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba
Gdy w oknie asystenta AI coś pójdzie źle (asystent odpowiada nie na temat, zwraca błąd z backendu,
gubi kontekst), admin nie ma szybkiej drogi, żeby to zgłosić **razem z pełnym kontekstem** rozmowy.
Dziś jedyne zgłaszanie błędów to „robaczek" wskazujący element UI (`FeedbackInspector`) — nie nadaje
się do zgłoszenia treści samej rozmowy z asystentem. Potrzebny jest przycisk „zgłoś problem z tym
czatem" wprost w oknie asystenta, który zbierze zrzut rozmowy i logi i utworzy z tego zadanie.

## 2. Cel i miary sukcesu
- Cel: admin jednym kliknięciem (i opcjonalnym opisem) tworzy w liście zadań Omnia zadanie z pełnym
  kontekstem problematycznej rozmowy z asystentem.
- Sukces mierzymy: po zgłoszeniu w projekcie „Omnia" powstaje zadanie zawierające zrzut całej rozmowy
  + logi połączeń z backendem + (opcjonalny) opis — bez opuszczania okna asystenta.

## 3. Historyjki użytkownika
- Jako **admin** chcę w nagłówku okna asystenta AI mieć ikonę „Zgłoś problem z czatem", żeby szybko
  zgłosić złą odpowiedź/błąd bez ręcznego kopiowania rozmowy.
- Jako admin chcę móc dodać krótki opis („spodziewałem się odpowiedzi: …"), ale też móc zgłosić bez
  opisu, gdy wystarcza sam komunikat błędu z backendu.
- Jako osoba naprawiająca błąd chcę, żeby zgłoszenie zawierało pełny zrzut rozmowy i logi połączeń,
  żeby móc odtworzyć problem bez dopytywania.

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1** — Given zalogowany **admin** z otwartym oknem asystenta AI, when patrzę na rząd akcji
  w nagłówku (obok „nowa rozmowa"/„historia rozmów"), then widzę ikonę **„Zgłoś problem z czatem"**.
- [ ] **AC-2** — Given zalogowany **nie-admin**, when otwieram okno asystenta, then **nie widzę** tej
  ikony (jest admin-only, jak „robaczek" `FeedbackInspector`).
- [ ] **AC-3** — Given otwarte okno asystenta, when klikam ikonę zgłaszania, then pojawia się pole na
  **opcjonalny** opis problemu (z podpowiedzią w stylu „spodziewałem się odpowiedzi: …") oraz akcja
  potwierdzenia i anulowania.
- [ ] **AC-4** — Given w oknie jest rozmowa (co najmniej jedna tura) **lub** wystąpił błąd z backendu,
  when potwierdzam zgłoszenie (z opisem lub bez), then w projekcie **„Omnia"** powstaje **zadanie**,
  a ja dostaję potwierdzenie (z odnośnikiem/wejściem do listy zadań).
- [ ] **AC-5** — Given utworzone zadanie zgłoszenia, then jego treść zawiera: (a) **opis** problemu
  jeśli podany, (b) **zrzut całej rozmowy** (wszystkie tury: kto/rodzaj/treść w kolejności), (c)
  **logi połączeń z backendem** dla tego czatu (dla każdej tury asystenta: kroki agenta —
  iter/step/thought/wywołane narzędzia/wyniki, model i liczba tokenów), oraz (d) **ostatni błąd**
  z backendu, jeśli wystąpił.
- [ ] **AC-6** — Given brak jakiegokolwiek kontekstu (pusta rozmowa, brak błędu) **i** brak opisu,
  when próbuję zgłosić, then akcja jest **zablokowana**/nieaktywna (nie tworzymy pustych zgłoszeń).
- [ ] **AC-7** — Given wcześniejsza (błędna) ikona ustawień (zębatka z 001), then po tej zmianie **nie
  ma jej już** w rzędzie akcji nagłówka; ustawienia asystenta pozostają dostępne z menu „+".

## 5. Zakres
**W zakresie:**
- Admin-only ikona „Zgłoś problem z czatem" w rzędzie akcji nagłówka okna asystenta AI.
- Pole na opcjonalny opis problemu + potwierdzenie/anulowanie.
- Utworzenie zadania w projekcie „Omnia" (ten sam projekt co główne zgłaszanie błędów) z treścią:
  opis (opcjonalny) + zrzut całej rozmowy + logi połączeń z backendem + ostatni błąd.
- Zastąpienie ikony ustawień (zębatki z 001) tą nową ikoną (decyzja właściciela).

**Poza zakresem (świadomie):**
- Zmiana głównego „robaczka" (`FeedbackInspector`) i jego przepływu przez rozmowę z asystentem.
- Nowy model danych / osobny rejestr zgłoszeń — używamy istniejącej listy zadań (projekt „Omnia").
- Zbieranie logów serwerowych/HTTP niedostępnych po stronie klienta — zgłoszenie zawiera to, co klient
  faktycznie otrzymał (logi/kroki agenta z SSE, meta, komunikaty błędów), nie logi z serwera.
- Załączanie zrzutów ekranu/obrazów rozmowy.
- Udostępnianie ikony nie-adminom.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** brak nowego slug'a. Widoczność ikony gated tym samym `isAdmin`, którym
  `AppShell` już gatuje `FeedbackInspector` (C-22 — bez nowego uprawnienia).
- **Własność danych:** zadanie powstaje w projekcie „Omnia" **właściciela-admina** (per-user,
  `ownerId`), przez istniejący przepływ tworzenia zadań (C-21). Brak nowej encji.
- **Asystent AI:** nie dodajemy nowej `AIAction` — zgłoszenie tworzy zadanie **bezpośrednio** (nie
  przez pętlę rozmowy z agentem), bo przedmiotem zgłoszenia jest sama rozmowa i może być zepsuta.
  (C-23 nie dotyczy — brak nowej akcji AI.)
- **Kalendarz / powiadomienia / trash:** nie dotyczy (zwykłe zadanie w istniejącej liście).

## 7. Zgodność z konstytucją
- **C-01/C-02** — praca w `worldofmag/`, importy przez alias `@/*`.
- **C-20/C-21** — tworzenie zadania przez istniejące Server Actions (z `revalidatePath`), własność
  `ownerId` przez istniejący guard.
- **C-22** — admin-only widoczność (bez nowego slug'a), spójnie z `FeedbackInspector`.
- **C-30/C-31/C-32** — ikona/pole ze zmiennych CSS, układ mobilny nienaruszony, teksty po polsku.
- **C-53** — minimalizm i reuse: brak nowego modelu/migracji; wykorzystanie istniejącego projektu
  „Omnia" i istniejącego tworzenia zadań; brak nowych zależności.
- **C-50/C-52** — „gotowe" = `npm run build` zielony, potem auto-merge do `develop`.

## 8. Otwarte pytania / decyzje właściciela
- [x] **Dyspozycja ikony ustawień z 001** — Odpowiedź właściciela (jedyny moment pytań): **„Zastąp
  ikoną zgłaszania (zalecane)"** — usuwamy zębatkę i w jej miejsce wstawiamy ikonę zgłaszania;
  ustawienia asystenta pozostają dostępne z menu „+".
- [x] **Zakres logów** — przyjęto (domyślnie, C-55: rozstrzygalne z kodu/minimalizm): zgłoszenie
  zawiera logi/kroki agenta i komunikaty, które **klient faktycznie otrzymał** (SSE `log`/`meta`,
  stan błędu). Serwerowych logów HTTP klient nie ma i ich nie dołączamy.
- [x] **Cel zadania** — projekt „Omnia" (ten sam, którego używa główne zgłaszanie błędów), tworzony
  w razie potrzeby.
- [x] **Kiedy blokujemy** — gdy brak rozmowy, brak błędu i brak opisu (AC-6).

## 9. Ryzyka
- Bardzo długa rozmowa → duża treść zadania. Mitygacja: treść jest tekstem/markdownem zadania (listy
  zadań to obsługują); rozważ rozsądne, ale hojne przycięcie pojedynczych, ogromnych wpisów logu na
  etapie planu — bez gubienia sensu.
- Treść rozmowy może zawierać znaczniki markdown/HTML → renderowanie zadania. Mitygacja: renderer
  markdown Omnii escapuje `&`/`<` globalnie (por. CLAUDE.md), więc bez wektora XSS; logi w blokach kodu.
- Zgłoszenie przez nie-admina (obejście UI) → tworzy zadanie tylko w **jego własnym** projekcie
  „Omnia" (brak eskalacji uprawnień); ikona i tak montowana tylko dla admina.
