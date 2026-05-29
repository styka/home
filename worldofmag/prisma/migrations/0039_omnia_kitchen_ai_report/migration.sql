-- Raport implementacji (załączniki+OCR do przepisów, kontekst projektu w AI, powiadomienia)
-- → /admin/reports oraz /reports. Slug odrębny (poprzednie 2026-05-29[...] zajęte),
-- bo INSERT używa ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-05-29 (przepisy OCR, AI projekt, powiadomienia)',
  'omnia-implementacja-2026-05-29-kitchen-ai',
  $omnia_kitchen_ai$# Omnia — Raport implementacji 2026-05-29 (przepisy OCR, AI projekt, powiadomienia)

Sesja realizująca 3 zgłoszenia: duża funkcja (załączniki + OCR do przepisów), poprawka AI
(kontekst otwartego projektu) oraz analiza powiadomienia („from Omnia").

---

## Załączniki i zdjęcia do przepisu + odczyt tekstu (OCR) per zdjęcie
**Diagnoza:** Przepisy nie miały załączników/zdjęć kartek. Wymagano: dołączać wiele zdjęć, a dla
każdego zdjęcia ZAWIERAJĄCEGO tekst pokazać osobne pole z treścią odczytaną przez LLM (Markdown),
wyraźnie sparowane ze zdjęciem. Brak zewnętrznego storage — obrazy w projekcie trzymane były dotąd
tylko jako URL-e.
**Rozwiązanie:** Wykorzystano istniejący model `RecipeImage` (był nieużywany w UI) i dodano pole
`ocrMarkdown` na transkrypcję per zdjęcie. Zdjęcia zmniejszane są po stronie klienta (canvas, max
1400 px, JPEG) i zapisywane jako `data:`-URL w DB — to pragmatyczne wobec braku S3/CDN i nie wymaga
nowej infrastruktury. OCR działa per zdjęcie (osobny endpoint `ocr-text` zwracający Markdown, w
odróżnieniu od istniejącego `ocr-image`, które parsuje ustrukturyzowany przepis) — dzięki temu każdy
obraz ma własny, edytowalny tekst. W widoku każde zdjęcie jest sparowane z jego transkrypcją
(„Zdjęcie N" ↔ „Tekst odczytany ze zdjęcia N"), więc widać, co z czego pochodzi. Rozróżniamy stan
„nieanalizowane" (NULL) od „brak tekstu na zdjęciu" (""), by wiedzieć, czy ponowić OCR. Zarządzanie
zdjęciami jest w trybie edycji (po zapisaniu przepisu — akcje wymagają istniejącego `recipeId`).
**Zmienione pliki:**
- `prisma/schema.prisma` + migracja `0038` — pole `RecipeImage.ocrMarkdown`.
- `src/actions/recipes.ts` — akcje `addRecipeImage` / `updateRecipeImage` / `deleteRecipeImage`.
- `src/app/api/llm/kitchen/ocr-text/route.ts` — vision-OCR zwracający `{ hasText, markdown }`.
- `src/lib/llm-client.ts` — `kitchen.ocrText`.
- `src/components/kitchen/recipes/RecipeImagesEditor.tsx` — upload (downscale), galeria, OCR per
  zdjęcie, edytowalny Markdown.
- `RecipeEditor.tsx` — sekcja „Zdjęcia i załączniki" (edycja) / podpowiedź (nowy przepis).
- `RecipeView.tsx` — sekcja „Zdjęcia z przepisu" z parami zdjęcie ↔ renderowany Markdown.

## AI: nowe zadanie ma trafiać do otwartego projektu
**Diagnoza:** Na widoku konkretnego projektu polecenie do „magicznej ikony AI" tworzyło zadanie w
skrzynce zamiast w otwartym projekcie. `AICommandSheet` przekazywał do LLM tylko opisowy `routeHint`
(„widok projektu zadań") — bez ID/nazwy projektu — a `execute` przy braku `projectName` zawsze wpadał
w fallback do skrzynki.
**Rozwiązanie:** Kontekst widoku przekazujemy jako twarde dane: `AICommandSheet` wyciąga
`activeProjectId` ze ścieżki (tylko realny projekt, nie widoki wirtualne today/upcoming/overdue/all)
i wysyła `currentProjectId` do interpret i execute. Interpret podaje modelowi nazwę bieżącego projektu
(LLM ustawia `projectName` tylko gdy użytkownik wskaże inny). Kluczowa decyzja: domyślny projekt
egzekwujemy po stronie serwera — `execute` przy braku `projectName` używa `currentProjectId`
(po sprawdzeniu dostępu) PRZED fallbackiem do skrzynki — nie polegamy wyłącznie na „domyśle" modelu.
**Zmienione pliki:**
- `src/components/home/AICommandSheet.tsx` — `activeProjectId` + przekazanie `currentProjectId`.
- `src/app/api/llm/home/interpret/route.ts` — nazwa bieżącego projektu w promptcie + reguła.
- `src/app/api/llm/home/execute/route.ts` — `currentProjectId` jako domyślny cel zadania.

## Tytuł powiadomienia „from Omnia"
**Diagnoza:** Prośba o usunięcie sufiksu „from Omnia". Śledztwo w kodzie: aplikacja NIE wysyła e-maili
(brak nodemailer/resend/sendgrid/smtp) ani web-push (brak handlera `push` w `public/sw.js`, brak VAPID).
Powiadomienia powstają wyłącznie przez `new Notification()` w `TasksPage.tsx`. „Omnia" pochodzi z pola
`name` manifestu PWA (`appName.ts` → `APP_TITLE`) i jest doklejane jako ŹRÓDŁO przez system/przeglądarkę
dla zainstalowanego PWA.
**Rozwiązanie:** Świadomie BEZ zmiany w kodzie — atrybucja źródła w powiadomieniu jest dodawana przez
system operacyjny (tak samo jak u aplikacji natywnych) i nie istnieje API, by ją usunąć. Jedyny kodowy
regulator to zmiana `name` w manifeście — ale to zmienia słowo, nie usuwa konstrukcji „from <app>".
Zamiast pozorować poprawkę, udokumentowano ograniczenie i jedyną realną dźwignię. (Wcześniej do treści
powiadomienia dodano już nazwę projektu, co i tak czyni je czytelniejszym.)
**Zmienione pliki:** brak (analiza; wnioski w `doświadczenia.md`).

## Podsumowanie
Trzy zgłoszenia: jedna duża funkcja (załączniki + OCR per zdjęcie w przepisach — model `RecipeImage`
rozszerzony o `ocrMarkdown`, downscale do data-URL, parowanie zdjęcie↔tekst w widoku), jedna poprawka
zachowania AI (twarde przekazanie kontekstu projektu + serwerowy domyślny cel zadania) oraz jedna
analiza zakończona werdyktem „nieusuwalne z kodu" (atrybucja powiadomień to zachowanie OS). Główne
obszary: moduł Kuchnia oraz warstwa AI (home interpret/execute). Zmiana schematu: migracja `0038`.
Weryfikacja: `prisma generate`, `tsc --noEmit`, `next build` — czysto. Lekcje dopisane do
`doświadczenia.md`.
$omnia_kitchen_ai$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
