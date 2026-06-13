-- 0110: raport implementacyjny — integracja Dysku Google (Task 1 z 7).
INSERT INTO "Report" ("id","title","slug","content","category","authorId","createdAt","updatedAt")
VALUES (gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-13',
  'omnia-implementacja-2026-06-13',
  $drive_report$# Omnia — Raport implementacji 2026-06-13

> **Uwaga: to dopiero 1. z 7 zgłoszonych zadań.** Na życzenie właściciela ta sesja została
> w całości poświęcona Task 1 (integracja Dysku Google), bo to sam w sobie wielomodułowa zmiana
> wymagająca decyzji architektonicznej. Pozostałe 6 zadań czeka na kolejne iteracje (lista na końcu).

## Podpięcie Dysku Google jako per-user „store" na pliki

**Diagnoza:** Użytkownik chciał, by każdy miał własny magazyn plików (zdjęć) **we własnym Dysku
Google**, a aplikacja zarządzała strukturą folderów i operacjami na plikach. Kluczowy problem
zgłoszony wcześniej: sam link „każdy z linkiem może edytować" **nie wystarcza** do zapisu
serwerowego — Drive API wymaga OAuth albo konta serwisowego. Trzeba było wybrać metodę dostępu.

**Rozwiązanie (decyzja użytkownika: OAuth scope `drive.file`):** Ponieważ logowanie do Omnia i tak
odbywa się kontem Google, dołożyliśmy **osobny, opcjonalny flow OAuth** uruchamiany przyciskiem
„Połącz Dysk Google" w Ustawieniach. Świadomie **nie** dokładaliśmy scope Drive do głównego
loginu (`auth.config.ts` jest edge-safe i współdzielony z middleware — wymuszałoby to zgodę na
Drive u każdego usera przy każdym logowaniu). Zakres ograniczono do `drive.file`, więc aplikacja
widzi i zarządza **wyłącznie** plikami, które sama utworzy w folderze „Omnia" — nie ma dostępu do
reszty Dysku użytkownika.

Architektura celowo minimalizuje rozlew po modułach: istniejące pola obrazków to stringi z URL
(`photoUrl`, `coverImageUrl`…). Upload zwraca **URL do proxy** (`/api/drive/file/<id>`), który
trafia w to samo pole string — dzięki temu **żaden schemat modułu nie wymagał zmiany**, a
wyświetlanie działa wszędzie, gdzie już jest `<img src>`. Proxy streamuje bajty tokenem właściciela,
więc pliki nie muszą być publiczne na Dysku. Tokeny odświeżane są automatycznie (`access_type=offline`
+ refresh token). Foldery per-moduł („Omnia/Kuchnia", „Omnia/Zwierzęta"…) tworzone są leniwie.

**Podpięcie reużywalnego pola (reprezentatywny rollout):** komponent „URL **lub** wgraj" wstawiono
w polach zdjęć Przepisów, Zwierząt i (z fallbackiem) Magazynu. Magazyn wcześniej zapisywał zdjęcia
jako base64 data-URL w bazie — teraz preferuje Dysk (mniejsza baza), a gdy Dysk niepołączony,
wraca do starego zachowania. Pełny rollout do pozostałych miejsc (news, avatary) = osobna iteracja.

**Zmienione / nowe pliki:**
- `prisma/schema.prisma` — nowe modele `DriveConnection` (tokeny + root/folderMap) i `DriveFile`
  (rejestr wgranych plików); relacje na `User`.
- `prisma/migrations/0109_drive_integration/` — migracja Postgres dla powyższych tabel.
- `src/lib/drive/oauth.ts` — budowa URL zgody, wymiana kodu, odświeżanie tokenu, pobranie email.
- `src/lib/drive/client.ts` — klient Drive REST v3 (fetch): ważny token, foldery, upload, stream, delete.
- `src/app/api/drive/connect/route.ts` — start flow OAuth (redirect do Google + cookie `state`).
- `src/app/api/drive/callback/route.ts` — wymiana kodu, zapis połączenia, utworzenie folderu „Omnia".
- `src/app/api/drive/upload/route.ts` — upload multipart (limit 10 MB, tylko obrazy).
- `src/app/api/drive/file/[fileId]/route.ts` — proxy streamujące plik z Dysku.
- `src/actions/drive.ts` — `getDriveStatus`, `disconnectDrive`.
- `src/components/ui/ImageUrlInput.tsx` — reużywalne pole „URL lub wgraj z Dysku".
- `src/components/settings/DriveSettings.tsx` + `src/app/settings/page.tsx` — sekcja „Dysk Google".
- `src/components/pets/PetForm.tsx`, `src/components/kitchen/recipes/RecipeEditor.tsx`,
  `src/components/magazynowanie/StorageEditSheet.tsx` — podpięcie uploadu.

## ⚠️ Wymagany ręczny krok konfiguracyjny (poza kodem)

W Google Cloud Console (ten sam projekt OAuth co logowanie) trzeba:
1. Dodać **Authorized redirect URI**: `https://worldofmag.onrender.com/api/drive/callback`
   oraz `http://localhost:3000/api/drive/callback`.
2. W OAuth consent screen dodać scope `https://www.googleapis.com/auth/drive.file`.

Bez tego callback zwróci `redirect_uri_mismatch` / odmowę scope. To jedyny krok, którego nie da się
wykonać z poziomu kodu.

## Podsumowanie

Sesja zrealizowała **1 z 7** zgłoszonych zadań — pełny fundament integracji Dysku Google
(OAuth `drive.file`, klient Drive, upload/stream/proxy, panel w Ustawieniach, reużywalne pole
wpięte w 3 reprezentatywne moduły). Główne obszary zmian: auth/OAuth, nowe API `/api/drive/*`,
schemat bazy (2 tabele), warstwa UI pól zdjęć. `next build` przechodzi.

**Pozostałe zadania (2–7) do kolejnych iteracji:**
2. Bulkowe dodawanie zadań (tekst/CSV/JSON/zdjęcia) z inteligentnym mapowaniem pól — z widoku
   zadań i z magicznej ikony (input + załącznik).
3. Magiczna ikona — wyszukiwanie zawsze ignorujące wielkość liter (audyt pozostałych miejsc;
   większość już używa `mode: "insensitive"`).
4. Bug menu po otwarciu „Jak używać" w Mapach sklepów (przyczyna ustalona: `force-static` na
   `/shopping/stores/guide` → brak sesji → puste menu; fix = usunięcie `force-static`).
5. Cykliczność zadań — przy oznaczaniu „zrobione" możliwość odstępstwa od ustawionego trybu
   (DUE/COMPLETION) oraz wskazania konkretnej daty wykonania.
6. Sortowanie zadań po dacie wykonania (`completedAt` już istnieje — trzeba odsłonić opcję).
7. Cykliczność „konkretny dzień miesiąca" (pole `dayOfMonth` istnieje w typie, ale nieużywane
   w `computeNextDue` ani w UI).
$drive_report$,
  'general', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
