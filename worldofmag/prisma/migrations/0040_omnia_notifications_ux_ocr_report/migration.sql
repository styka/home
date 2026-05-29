-- Raport implementacji (powiadomienia na iPhone, zwijana sekcja „Zrobione", OCR przepisu)
-- → /admin/reports oraz /reports. Slug z sufiksem, bo bazowy 2026-05-29 jest zajęty,
-- a INSERT używa ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-05-29 (powiadomienia iPhone, UX listy, OCR)',
  'omnia-implementacja-2026-05-29-notif-ux-ocr',
  $omnia_notif_ux_ocr$# Omnia — Raport implementacji 2026-05-29

Sesja realizująca 3 zgłoszenia: naprawa powiadomień zadań na iPhone, dopracowanie UX
sekcji ukończonych zadań oraz naprawa OCR przepisów ze zdjęcia.

---

## Powiadomienia zadań nie pojawiają się na iPhone
**Diagnoza:** Po poprzedniej poprawce (dedup + nazwa projektu w treści) powiadomienia działały
tylko na desktopie, a na iPhone w ogóle. Przyczyną był konstruktor `new Notification(...)`, którego
iOS Safari/PWA nie wspiera — powiadomienia na iOS można wyświetlać wyłącznie przez Service Worker
(`registration.showNotification`). Na telefonie konstruktor cicho zawodził.
**Rozwiązanie:** Dodano `showTaskNotification()`, która najpierw próbuje ścieżki Service Workera
(`navigator.serviceWorker.ready` → `reg.showNotification`), uniwersalnej dla iOS i desktopu, a
`new Notification()` zostaje jedynie fallbackiem. Wybrano SW jako główną drogę, bo to jedyna metoda
działająca na iOS, a na desktopie działa równie dobrze. Do `sw.js` dodano handler `notificationclick`
(fokus okna lub otwarcie `/tasks`) i podbito wersję cache do v2, by klient pobrał nowy worker. `tag`
powiadomienia = klucz dedup, żeby system nie zdublował notyfikacji.
**Zmienione pliki:**
- `src/components/tasks/TasksPage.tsx` — helper `showTaskNotification` przez Service Worker + fallback
- `public/sw.js` — handler `notificationclick`, podbita wersja cache `worldofmag-v2`

## Zwijana sekcja „Zrobione / Anulowane" na liście zadań
**Diagnoza:** Na filtrze „Wszystkie" ukończone i anulowane zadania trafiały na dół jako stała,
zawsze rozwinięta sekcja — zaśmiecała widok i wymagała przewijania mimo że rzadko jest potrzebna.
**Rozwiązanie:** Wydzielono komponent `CompletedSection` — nagłówek jest jednocześnie przyciskiem
rozwijania (licznik + obracana strzałka `ChevronRight`, `aria-expanded`), domyślnie zwiniętym. Stan
trzymany lokalnie w komponencie, więc każdy widok pamięta swój stan niezależnie. Wspólny komponent
użyto w obu miejscach renderujących ukończone (widok „Wszystkie" grupowany po projektach oraz
today/projekt grupowany po priorytecie), eliminując duplikację dotychczasowego inline'owego bloku.
**Zmienione pliki:**
- `src/components/tasks/CompletedSection.tsx` — nowy, zwijalny nagłówek-sekcja
- `src/components/tasks/TaskList.tsx` — oba bloki „Zrobione/Anulowane" zastąpione `CompletedSection`

## OCR przepisu ze zdjęcia zwracał błąd
**Diagnoza:** Po wybraniu zdjęcia OCR przepisu kończył się błędem (zgłoszone jako 503) i przepis nie
powstawał. Trasy `/api/llm/kitchen/ocr-image` oraz `/ocr-text` używały modelu wizyjnego Groq
`llama-3.2-11b-vision-preview`, który Groq wycofał (`model_decommissioned`) — każde zapytanie
wizyjne kończyło się odrzuceniem po stronie dostawcy.
**Rozwiązanie:** Nazwę modelu wyniesiono do jednego miejsca (`src/lib/groqVision.ts`,
`GROQ_VISION_MODEL = meta-llama/llama-4-scout-17b-16e-instruct` — aktualny model wizyjny Groq
zgodny z API OpenAI/`image_url`) i podpięto w obu trasach, by przy kolejnej zmianie nazwy nie
rozjechały się. Dodatkowo `parseGroqError()` wyciąga prawdziwy komunikat z odpowiedzi Groq i dokleja
kod HTTP do błędu zwracanego na front — przy następnej awarii widać realną przyczynę zamiast samego
statusu.
**Zmienione pliki:**
- `src/lib/groqVision.ts` — nowa stała modelu + parser błędu Groq
- `src/app/api/llm/kitchen/ocr-image/route.ts` — model ze stałej, czytelny błąd Groq
- `src/app/api/llm/kitchen/ocr-text/route.ts` — model ze stałej, czytelny błąd Groq

## Podsumowanie
Trzy zgłoszenia: dwie naprawy błędów (powiadomienia iOS, wycofany model wizyjny Groq) i jedna
poprawka UX (zwijana sekcja ukończonych zadań). Główne obszary zmian: moduł Zadania (powiadomienia
PWA + lista) oraz integracja LLM dla kuchni (OCR). Wspólny mianownik dwóch napraw to ograniczenia
platform zewnętrznych — iOS nie wspiera konstruktora `Notification`, a Groq bez zapowiedzi wycofuje
modele „preview"; w obu przypadkach rozwiązanie polega na użyciu wspieranej ścieżki i trzymaniu
zależnej konfiguracji w jednym miejscu. Build (`next build`) przechodzi. Lekcje dopisane do
`doświadczenia.md`.
$omnia_notif_ux_ocr$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
