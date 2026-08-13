# Weryfikacja: okno konfliktu — zadanie 16

Data: 2026-08-13 · build **exit 0**, `test:unit` **744/744**, liczniki **160 / 551 / 35 / 35**.

**AC-1** ✅ trzy nazwane wyjścia, żadne domyślne; okno zamknięte krzyżykiem = „wróć do edycji",
czyli nie robi nic. **AC-2** ✅ `recordRejectedDraft` zapisuje wersję roboczą do istniejącego kosza
z rozpoznawalnym tytułem; test pilnuje prefiksu. **AC-3** ✅ degradacja poza powłoką sprawdzona
testem — zwraca `wroc`, **nigdy** `nadpisz`. **AC-4** ✅ wyłącznie zmienne CSS, teksty po polsku,
okno stoi na wspólnym `Modal` (pułapka focusu, Esc, `role="dialog"` za darmo). **AC-5** ✅.

**Werdykt: GOTOWE.** Zadanie 16 domknięte w zakresie, który da się dowieźć bez wiedzy o polach
modułów; widok różnic czeka na pierwszego konsumenta (C-35).
