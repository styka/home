# WorldOfMag — Disaster Recovery Guide

> **Cel tego dokumentu:** Jeśli masz tylko repozytorium i straciłeś dostęp do wszystkich serwisów,
> ten dokument przeprowadzi Cię przez pełne odtworzenie aplikacji na produkcji.

---

## 1. Spis serwisów i kont

| Serwis | URL | Konto | Do czego służy |
|--------|-----|-------|----------------|
| **GitHub** | github.com | tyka.szymon@gmail.com | Repozytorium kodu (`styka/home`) |
| **Neon** | console.neon.tech | tyka.szymon@gmail.com | Baza danych PostgreSQL na produkcji |
| **Render** | dashboard.render.com | tyka.szymon@gmail.com (przez GitHub OAuth) | Hosting aplikacji |
| **Google Cloud Console** | console.cloud.google.com | tyka.szymon@gmail.com | OAuth 2.0 credentials (logowanie przez Google) |

Wszystkie cztery serwisy są darmowe (free tier). Żaden nie wymaga karty kredytowej.

---

## 2. Zmienne środowiskowe

### Kompletna lista — co, gdzie, jak znaleźć

#### `DATABASE_URL`
- **Do czego:** Połączenie z bazą danych PostgreSQL. Używa connection poolera (PgBouncer) dla requestów aplikacji.
- **Format:** `postgresql://USER:PASS@HOST/neondb?sslmode=require`
- **Gdzie znaleźć:** Neon Dashboard → projekt `worldofmag` → **Connection Details** → zakładka **Pooled connection** → skopiuj cały connection string
- **Jak odzyskać:** Zaloguj się na console.neon.tech → projekt worldofmag → Connection Details. Jeśli straciłeś konto Neon — patrz sekcja 4B.

#### `DIRECT_URL`
- **Do czego:** Bezpośrednie połączenie z bazą (bez poolera) — używane wyłącznie przez `prisma migrate deploy` podczas buildu.
- **Format:** `postgresql://USER:PASS@HOST/neondb?sslmode=require` (bez `?pgbouncer=true`)
- **Gdzie znaleźć:** Neon Dashboard → projekt `worldofmag` → **Connection Details** → zakładka **Direct connection**
- **Uwaga:** Użytkownik i hasło są identyczne jak w `DATABASE_URL`, różni się tylko host (direct zamiast pooled).

#### `AUTH_SECRET`
- **Do czego:** Klucz do podpisywania JWT sesji NextAuth. Musi być tajny i losowy. Zmiana tego klucza unieważnia WSZYSTKIE aktywne sesje użytkowników (zostaną wylogowani).
- **Format:** Losowy string base64, min. 32 znaki
- **Gdzie znaleźć:** Render Dashboard → serwis `worldofmag` → **Environment** → zmienna `AUTH_SECRET`
- **Jak wygenerować nowy:**
  ```bash
  openssl rand -base64 32
  ```
- **Jak odzyskać:** Nie można odzyskać zagubionego `AUTH_SECRET` — wygeneruj nowy. Jedynym skutkiem jest wylogowanie wszystkich aktywnych sesji.

#### `AUTH_URL`
- **Do czego:** Bezwzględny URL aplikacji. Używany przez NextAuth do budowania redirect URL.
- **Wartość na produkcji:** `https://worldofmag.onrender.com`
- **Gdzie znaleźć/zmienić:** Render Dashboard → serwis → **Settings** → Custom Domain lub URL widoczny na dashboardzie
- **Uwaga:** Jeśli zmieniasz serwis Render i URL się zmieni, zaktualizuj tę zmienną i dodaj nowy URL w Google Cloud Console (patrz `GOOGLE_CLIENT_ID`).

#### `GOOGLE_CLIENT_ID`
- **Do czego:** Identyfikator aplikacji w Google OAuth. Publiczny (nie jest sekretem).
- **Format:** `something.apps.googleusercontent.com`
- **Gdzie znaleźć:** Google Cloud Console → projekt (np. `worldofmag`) → **APIs & Services** → **Credentials** → kliknij nazwę OAuth 2.0 Client ID
- **Jak odzyskać:** Zaloguj się na console.cloud.google.com → wybierz projekt → Credentials. Jeśli straciłeś projekt — patrz sekcja 4C.

#### `GOOGLE_CLIENT_SECRET`
- **Do czego:** Sekret OAuth. Nigdy nie powinien trafić do kodu ani publicznego repozytorium.
- **Gdzie znaleźć:** Google Cloud Console → Credentials → kliknij klienta OAuth → widoczny jako `Client secret`
- **Jak odzyskać:** Jeśli nie pamiętasz wartości — w Google Cloud Console możesz **Download JSON** lub **Reset Secret** (uwaga: reset wymaga aktualizacji w Render).

---

## 3. Gdzie są przechowywane dane użytkowników

| Dane | Gdzie | Jak sprawdzić |
|------|-------|---------------|
| Konta użytkowników (`User`, `Account`) | Baza Neon → tabela `User` i `Account` | `npx prisma studio` (z ustawionym `DIRECT_URL` na Neon) |
| Sesje JWT | Cookie w przeglądarce użytkownika | Nie są przechowywane w DB (strategy: jwt) |
| Listy zakupów i pozycje | Baza Neon → `ShoppingList`, `Item` | Prisma Studio lub Neon Console |
| Historia produktów (autocomplete) | Baza Neon → `ItemHistory` | Prisma Studio |
| Dane OAuth (tokeny Google) | Baza Neon → tabela `Account` | Prisma Studio |

**Backup danych:** Neon free tier nie oferuje automatycznych backupów. Jeśli chcesz zrobić backup:
```bash
# Ustaw DIRECT_URL na Neon w .env.local, potem:
npx prisma db pull    # pobiera aktualny schemat
# lub pg_dump przez connection string Neon
```

---

## 4. Scenariusze awarii — co robić

### 4A. Zapomniałem wartości zmiennej środowiskowej na Render

1. Zaloguj się na **dashboard.render.com** (przez GitHub OAuth — potrzebujesz dostępu do GitHub)
2. Kliknij serwis **worldofmag**
3. Zakładka **Environment**
4. Widoczne są nazwy zmiennych — wartości są ukryte. Żeby zobaczyć wartość: kliknij ikonę oka przy zmiennej
5. Jeśli wartość jest niezrozumiała lub podejrzana — patrz sekcja 2 po informację jak odtworzyć każdą zmienną

---

### 4B. Straciłem dostęp do Neon (hasło, usunięte konto)

**Odtworzenie bazy od zera:**

1. Zarejestruj się na **console.neon.tech** (przez GitHub lub email tyka.szymon@gmail.com)
2. Utwórz nowy projekt: nazwa `worldofmag`, region **eu-central-1 (Frankfurt)**
3. Skopiuj `DATABASE_URL` (pooled) i `DIRECT_URL` (direct) z Connection Details
4. Zaktualizuj obie zmienne w Render Dashboard → Environment
5. Zaaplikuj schemat bazy:
   ```bash
   cd worldofmag
   # Ustaw DIRECT_URL w .env.local na nowe połączenie Neon
   npx prisma migrate deploy   # uruchamia 0001_init i 0002_auth_and_teams
   ```
6. (Opcjonalnie) Załaduj seed danych dla autocomplete:
   ```bash
   npm run db:seed
   ```
7. Zrób redeploy na Render — aplikacja będzie działać z pustą nową bazą

**Skutek:** Wszyscy użytkownicy będą musieli zalogować się ponownie (konta zostaną odtworzone przy pierwszym logowaniu przez Google OAuth). Dane (listy zakupów) zostaną utracone.

---

### 4C. Straciłem dostęp do Google Cloud Console / OAuth credentials

**Odtworzenie credentials:**

1. Zaloguj się na **console.cloud.google.com** kontem tyka.szymon@gmail.com
2. Utwórz nowy projekt lub znajdź istniejący
3. Włącz Google OAuth API: **APIs & Services** → **Enable APIs** → szukaj "Google+ API" lub "Google Identity"
4. Utwórz nowe OAuth credentials: **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs — dodaj **oba**:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://worldofmag.onrender.com/api/auth/callback/google`
5. Skopiuj nowy **Client ID** i **Client Secret**
6. Zaktualizuj `GOOGLE_CLIENT_ID` i `GOOGLE_CLIENT_SECRET` w Render Dashboard → Environment
7. Zrób redeploy na Render (lub poczekaj na auto-deploy po pushu)

**Skutek:** Użytkownicy będą musieli zalogować się ponownie. Dane w DB pozostają bez zmian.

---

### 4D. Straciłem dostęp do Render (serwer)

**Render jest połączony z GitHub OAuth** — wystarczy dostęp do konta GitHub.

1. Zaloguj się na **dashboard.render.com** → kliknij **Sign in with GitHub**
2. Jeśli serwis `worldofmag` nie istnieje (usunięto konto/serwis):

   **Odtworzenie serwisu na Render:**
   1. **New** → **Web Service**
   2. Połącz repozytorium `styka/home` z GitHub
   3. Ustaw:
      - **Root Directory:** `worldofmag`
      - **Build Command:** `npm ci && npx prisma generate && npm run build`
      - **Start Command:** `next start`
      - **Region:** Frankfurt (EU Central)
      - **Plan:** Free
   4. Dodaj wszystkie zmienne środowiskowe (patrz sekcja 2):
      - `DATABASE_URL`
      - `DIRECT_URL`
      - `AUTH_SECRET` (wygeneruj nowy: `openssl rand -base64 32`)
      - `AUTH_URL` = `https://<nowy-url>.onrender.com`
      - `GOOGLE_CLIENT_ID`
      - `GOOGLE_CLIENT_SECRET`
   5. Zaktualizuj `AUTH_URL` w Render
   6. Zaktualizuj redirect URI w Google Cloud Console (nowy URL z Render)
   7. Deploy

---

### 4E. Mam tylko repozytorium — pełna odbudowa od zera

Jeśli masz tylko kod z `git clone` i straciłeś wszystko inne, wykonaj **w tej kolejności**:

```
Krok 1 → Neon (baza)
Krok 2 → Google Cloud (OAuth)
Krok 3 → Render (hosting)
Krok 4 → Lokalna weryfikacja
```

#### Krok 1 — Baza danych (Neon)

1. Zarejestruj się / zaloguj: **console.neon.tech**
2. Utwórz projekt: `worldofmag`, region: `eu-central-1`
3. Skopiuj connection strings (pooled i direct) — będą potrzebne w kroku 3

#### Krok 2 — Google OAuth

1. Zaloguj się: **console.cloud.google.com**
2. Utwórz projekt (lub użyj istniejącego)
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<twój-serwis>.onrender.com/api/auth/callback/google` (uzupełnisz po kroku 3)
6. Skopiuj **Client ID** i **Client Secret**

#### Krok 3 — Hosting (Render)

1. Zaloguj się: **dashboard.render.com** → Sign in with GitHub
2. **New** → **Web Service** → połącz `styka/home`
3. Konfiguracja:
   ```
   Root Directory:    worldofmag
   Build Command:     npm ci && npx prisma generate && npm run build
   Start Command:     next start
   Region:            Frankfurt (EU Central)
   Plan:              Free
   ```
4. Dodaj zmienne środowiskowe:
   ```
   DATABASE_URL      = (pooled string z Neon)
   DIRECT_URL        = (direct string z Neon)
   AUTH_SECRET       = (wynik: openssl rand -base64 32)
   AUTH_URL          = https://<nazwa>.onrender.com
   GOOGLE_CLIENT_ID  = (z kroku 2)
   GOOGLE_CLIENT_SECRET = (z kroku 2)
   NODE_ENV          = production
   NEXT_TELEMETRY_DISABLED = 1
   ```
5. Utwórz serwis — poczekaj na build
6. Wróć do Google Cloud Console → dodaj właściwy URL Render do Authorized redirect URIs

#### Krok 4 — Weryfikacja

1. Wejdź na URL serwisu Render → powinna pojawić się strona logowania
2. Kliknij "Zaloguj się przez Google" → przejdź przez OAuth → aplikacja powinna działać
3. Sprawdź Prisma Studio lokalnie żeby potwierdzić że rekord `User` i `Account` trafił do bazy:
   ```bash
   cd worldofmag
   echo 'DIRECT_URL="<twój direct URL z Neon>"' >> .env.local
   npx prisma studio
   ```

---

## 5. Lokalne uruchomienie deweloperskie

```bash
git clone https://github.com/styka/home.git
cd home/worldofmag
npm install

# Opcja A: SQLite (szybko, brak konieczności konfiguracji)
echo 'DATABASE_URL="file:./dev.db"' > .env.local
echo 'DIRECT_URL="file:./dev.db"' >> .env.local
echo 'AUTH_SECRET="dev-secret-replace-in-production"' >> .env.local
echo 'AUTH_URL="http://localhost:3000"' >> .env.local
echo 'GOOGLE_CLIENT_ID="twoj-client-id"' >> .env.local
echo 'GOOGLE_CLIENT_SECRET="twoj-client-secret"' >> .env.local

npm run db:push   # tworzy tabele w SQLite
npm run db:seed   # 69 produktów dla autocomplete
npm run dev       # → http://localhost:3000

# Opcja B: Neon PostgreSQL (produkcyjna baza lokalnie)
# Ustaw DATABASE_URL i DIRECT_URL na connection strings z Neon
# Reszta zmiennych jak wyżej
npm run dev
```

> **Uwaga:** Logowanie Google lokalnie wymaga poprawnych `GOOGLE_CLIENT_ID` i `GOOGLE_CLIENT_SECRET`
> oraz `http://localhost:3000/api/auth/callback/google` na liście redirect URIs w Google Cloud Console.

---

## 6. Architektura auth — jak to działa (skrót)

```
Użytkownik → Google OAuth → NextAuth (Node.js runtime)
                                ↓
                         PrismaAdapter: upsert User + Account w DB
                                ↓
                         JWT signed cookie ← AUTH_SECRET
                                ↓
              Middleware weryfikuje JWT z cookie (Edge Runtime, BEZ Prismy)
```

- **Sesje są w cookies** (strategy: jwt), nie w bazie — utrata `AUTH_SECRET` = utrata sesji
- **Dane użytkowników są w Neon** — utrata bazy = utrata danych (użytkownicy mogą się ponownie zalogować, ale stracą swoje listy)
- **Pierwszy login tyka.szymon@gmail.com** → automatycznie otrzymuje rolę `ADMIN` (zdefiniowane w `src/lib/auth.ts` jako `ADMIN_EMAIL`)

---

## 7. Szybka lista kontrolna po odtworzeniu

- [ ] Neon: projekt `worldofmag` istnieje, baza ma tabele (sprawdź w Neon Console → Tables)
- [ ] Render: serwis działa, URL odpowiada
- [ ] Google Cloud Console: redirect URI pasuje do URL serwisu Render
- [ ] Wszystkie 6 zmiennych środowiskowych ustawione w Render
- [ ] `AUTH_URL` = dokładny URL serwisu (z `https://`, bez trailing slash)
- [ ] Po pierwszym logowaniu: sprawdź w Neon że tabela `User` ma rekord

---

*Ostatnia aktualizacja: Maj 2026*
