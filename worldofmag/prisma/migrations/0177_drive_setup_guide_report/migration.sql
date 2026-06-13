-- 0177: instrukcja konfiguracji Dysku Google (Google Cloud Console) jako raport admina.
INSERT INTO "Report" ("id","title","slug","content","category","authorId","createdAt","updatedAt")
VALUES (gen_random_uuid()::text,
  'Konfiguracja Dysku Google (Google Cloud Console) — instrukcja',
  'konfiguracja-dysku-google-cloud-console',
  $drive_setup$# Konfiguracja Dysku Google (Google Cloud Console)

> **Po co.** Aby działało „Połącz Dysk Google" w *Ustawieniach* (per-user store na pliki, scope
> `drive.file`), trzeba jednorazowo skonfigurować ten sam projekt OAuth, którego Omnia używa do
> logowania. To **konfiguracja w panelu Google — nie wymaga zmian w kodzie.**

## A. Wejście do właściwego projektu
1. Otwórz **https://console.cloud.google.com/**
2. W przełączniku projektów (góra strony) wybierz **ten sam projekt**, w którym skonfigurowane jest
   logowanie Google do Omnia (te same `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` co na Render).
   Jeśli nie wiesz który — potwierdzisz po Client ID w kroku B.

## B. Dodanie redirect URI (do OAuth Client)
1. Menu (≡) → **APIs & Services → Credentials**.
2. W sekcji **OAuth 2.0 Client IDs** otwórz swój klient typu **Web application**. Potwierdź, że to
   właściwy — Client ID musi się zgadzać z `GOOGLE_CLIENT_ID` z Rendera.
3. W **Authorized redirect URIs** → **+ ADD URI** dodaj **dwa** wpisy (dokładnie, ze ścieżką
   `/api/drive/callback`, bez ukośnika na końcu):
   - `https://worldofmag.onrender.com/api/drive/callback`
   - `http://localhost:3000/api/drive/callback`
4. **SAVE**. Propagacja zmian potrafi potrwać kilka minut.

> To muszą być **Redirect URIs**, nie „Authorized JavaScript origins". Adres musi się zgadzać znak
> w znak.

## C. Włączenie Drive API
- **APIs & Services → Library** → wyszukaj **„Google Drive API"** → **Enable**.
  (Bez tego upload zwróci błąd „API not enabled / has not been used".)

## D. Dodanie scope `drive.file` (OAuth consent screen)
1. **APIs & Services → OAuth consent screen** (w nowszym UI: **Google Auth Platform → Branding/Data
   Access**).
2. Wejdź w **Data Access → ADD OR REMOVE SCOPES** (lub „Edit App" → zakładka **Scopes**).
3. W filtrze wpisz `drive.file`, zaznacz **`.../auth/drive.file`** („See, edit, create, and delete
   only the specific Google Drive files you use with this app") → **UPDATE** → **SAVE**.

## E. Tryb aplikacji: Testing vs Production — jak DOKŁADNIE sprawdzić
1. Wejdź w **APIs & Services → OAuth consent screen** (lub **Google Auth Platform → Audience**).
2. Na górze, obok nazwy aplikacji, jest **Publishing status**:
   - **„Testing"** — wyświetla się żółta/szara etykieta *Testing* oraz przycisk
     **„PUBLISH APP"** (i sekcja **Test users** z listą e-maili). W tym trybie **tylko adresy
     dodane jako Test users** mogą przejść zgodę; pozostali dostaną *„Access blocked: … has not
     completed the Google verification process / app is in testing"*.
   - **„In production"** — status to **In production**, a zamiast „Publish app" jest
     **„BACK TO TESTING"**. Tu zgoda działa dla wszystkich kont Google.
3. **Co zrobić w zależności od trybu:**
   - Zostajesz w **Testing** → kliknij **+ ADD USERS** w **Test users** i dodaj swój e-mail
     (oraz innych testerów). To wystarczy, żeby `drive.file` działało dla nich.
   - Chcesz dla wszystkich → **PUBLISH APP**. Scope `drive.file` jest **non-sensitive**, więc
     **nie wymaga weryfikacji Google** — publikacja działa od ręki (bez procesu review).

> Szybki test: na koncie spoza listy Test users w trybie Testing zobaczysz ekran „Access blocked".
> Jeśli widzisz normalny ekran zgody Google — albo jesteś Test userem, albo apka jest In production.

## F. Test końcowy w aplikacji
- **Ustawienia → Dysk Google → Połącz** → przejdź zgodę Google → sprawdź, czy na Twoim Dysku
  powstał folder **„Omnia"**. Wgraj zdjęcie np. w Przepisie/Magazynie i potwierdź, że się wyświetla.

## Najczęstsze błędy
- **`redirect_uri_mismatch`** → URI z kroku B nie zgadza się co do znaku (literówka, brak `https`,
  ukośnik na końcu, zła ścieżka). Popraw i zapisz.
- **`Access blocked` / „not verified"** → apka w trybie Testing, a konto nie jest na liście
  **Test users** (krok E) — dodaj e-mail albo opublikuj apkę.
- **Upload: „API not enabled"** → nie włączono Drive API (krok C).
$drive_setup$,
  'general', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
