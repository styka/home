# Notes Module — Backlog poprawek i nowych funkcji

## 1. Błędy krytyczne do naprawienia

### 1.1 Funkcje AI zwracają 503
**Objaw:** `/api/llm/notes/rewrite`, `/api/llm/notes/qa`, `/api/llm/notes/tags` → HTTP 503  
**Przyczyna:** Brak zmiennej środowiskowej `GROQ_API_KEY` na Render.  
**Naprawa:** Dodać `GROQ_API_KEY` w ustawieniach środowiskowych Render (Environment → Add env var).

### 1.2 Sugestie tagów — błąd JS
**Objaw:** `TypeError: Cannot read properties of undefined (reading 'includes')` przy próbie sugestii tagów.  
**Przyczyna:** Odpowiedź z API nie zawiera pola `suggested` (lub jest `undefined`) — brak obsługi edge case w filtrze.  
**Naprawa:** Dodać defensive check: `(parsed.suggested ?? []).filter(...)` wszędzie gdzie iteruje się po odpowiedzi LLM.

### 1.3 Przycisk "All tags" nie działa
**Objaw:** Przycisk widoczny podczas tworzenia notatki, kliknięcie nic nie robi. Brak go przy edycji.  
**Naprawa:** Usunąć lub zastąpić spójną listą tagów do wyboru (inline tag picker), identyczną w trybie tworzenia i edycji.

---

## 2. Poprawki UX / Layout

### 2.1 Przyciski akcji za daleko po prawej
**Objaw:** Przyciski (pin, edit, delete) w wierszu notatki są odsunięte za daleko od treści.  
**Oczekiwanie:** Układ spójny z działem Zakupy — przyciski tuż przy treści, bez nadmiernych odstępów.

### 2.2 Grupowanie notatek na liście
**Oczekiwanie:** Lista notatek pogrupowana według grup (NoteGroup). Każda grupa to sekcja z nagłówkiem, którą można rozwinąć/zwinąć. Notatki bez grupy w sekcji „Bez grupy". Wzorzec: `CategoryGroup` z modułu Zakupy.

---

## 3. Nowe funkcje

### 3.1 Auto-tagowanie i sugestia grupy po zmianie treści
**Oczekiwanie:**
- Sugestie tagów i grupy pojawiają się automatycznie po zmianie tytułu lub treści notatki (zarówno w trybie tworzenia, jak i edycji).
- Debounce ~1500 ms — request do LLM wysyłany dopiero po zatrzymaniu pisania.
- LLM sugeruje: (a) istniejące tagi, (b) nowe tagi do zatwierdzenia, (c) istniejącą grupę.
- Zatwierdzenie nowego tagu → zapis do bazy + przypisanie do notatki.

**Zmiana w API `/api/llm/notes/tags`:**  
Rozszerzyć response o pole `suggestedGroup: string | null` — nazwa istniejącej grupy która pasuje do treści.

### 3.2 Auto-generowanie tytułu przez LLM
**Oczekiwanie:**
- Podczas tworzenia notatki: po wpisaniu treści (debounce ~1500 ms) LLM generuje propozycję tytułu.
- Tytuł jest wpisywany w pole tytułu z oznaczeniem „AI" (np. małym chipem lub ikoną ✨).
- Użytkownik może go zaakceptować (nic nie robi) lub ręcznie edytować.
- Jeśli pole tytułu jest już wypełnione przez użytkownika — nie nadpisywać.

**Nowy endpoint:** `/api/llm/notes/title` POST `{ content: string }` → `{ title: string }`

### 3.3 Głosowe dodawanie treści notatki
**Oczekiwanie:**
- Przycisk mikrofonu przy polu treści (w trybie tworzenia i edycji).
- Używa Web Speech API (`SpeechRecognition`, `lang: "pl-PL"`) — tak jak w `LLMInputSection` w module Zakupy.
- Transkrypt doklejany do aktualnej treści lub zastępuje zaznaczony fragment.
- Przycisk toggle: start/stop nagrywania z wizualnym feedbackiem (pulsujące kółko).

### 3.4 Głosowe redagowanie notatki przez LLM
**Oczekiwanie:**
- W trybie edycji notatki: przycisk „🎤 Powiedz co zmienić".
- Użytkownik mówi instrukcję (np. „Usuń ostatni akapit", „Dodaj sekcję z wnioskami").
- Transkrypt + aktualna treść notatki wysyłane do LLM (`/api/llm/notes/rewrite`, nowy mode `"voice_edit"`).
- LLM zwraca zmodyfikowaną treść → zastępuje pole edycji (z możliwością undo — przycisk „Przywróć").
- Przyciski do zatwierdzenia: **Zapisz** / **Anuluj** / **Przywróć** (poprzednia treść).

**Zmiana w API `/api/llm/notes/rewrite`:**  
Dodać mode `"voice_edit"` z promptem: `"Zmodyfikuj poniższą notatkę zgodnie z instrukcją użytkownika. Odpowiedz TYLKO zmodyfikowanym tekstem."` + `instruction` w body.

### 3.5 Wyszukiwanie tekstowe wśród notatek
**UX:**  
Osobna zakładka filtra: **Szukaj** (obok „Wszystkie", „Przypięte", „Bez grupy") — otwiera inline pole wyszukiwania.  
Wyniki: lista notatek z zaznaczonym fragmentem pasującym do frazy (highlight). Notatki bez dopasowania ukryte.  
Opcja: **Szukaj tylko wśród odfiltrowanych** (checkbox, jak w Q&A).

**Implementacja:**
- Wyszukiwanie lokalne (client-side) po `note.title` i `note.content` — nie wymaga API.
- Highlight: owijać pasujący fragment w `<mark>` lub span ze stylem.

### 3.6 Wyniki źródłowe w panelu Q&A
**Oczekiwanie:**
- Po otrzymaniu odpowiedzi AI w panelu Q&A — poniżej odpowiedzi wyświetlić sekcję „Źródła" z listą notatek użytych jako kontekst.
- Format: tytuł notatki (klikalny → przewija listę do tej notatki lub otwiera edycję) + fragment treści (pierwsze 80 znaków).

**Zmiana w API `/api/llm/notes/qa`:**  
Dodać do prompta instrukcję: zwróć na końcu odpowiedzi JSON blok `<!-- sources: [1,3,5] -->` z numerami notatek z kontekstu (indeksy z listy wysłanej do LLM).  
Klient parsuje ten blok i renderuje sekcję źródeł.

---

## Kolejność implementacji (sugerowana)

1. Fix 503 — dodać `GROQ_API_KEY` na Render (ręcznie, nie w kodzie)
2. Fix bug sugestii tagów (defensive null check)
3. Fix przycisk "All tags" (usunąć / zastąpić)
4. Poprawka layoutu przycisków (prawa strona)
5. Grupowanie notatek na liście (collapsible)
6. Debounce auto-tagowania + sugestia grupy
7. Auto-generowanie tytułu przez LLM
8. Głosowe dodawanie treści
9. Głosowe redagowanie z LLM + przycisk Przywróć
10. Wyszukiwanie tekstowe
11. Źródła w Q&A
