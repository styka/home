# Jak uruchomić testy „klikacze" (E2E) — instrukcja krok po kroku

> Ta instrukcja jest dla osoby **nietechnicznej**. Nie musisz nic umieć
> programować. Wystarczy, że będziesz **kopiować polecenia** i wklejać je do
> jednego okna (Terminala), a następnie naciskać Enter. Efektem będzie okno
> przeglądarki, które **samo klika** po aplikacji WorldOfMag — zobaczysz na
> żywo, jak przechodzi przez kolejne ekrany i sprawdza, czy wszystko działa.

Całość zajmuje ok. **20–30 minut** za pierwszym razem (głównie pobieranie
programów). Każde kolejne uruchomienie to już tylko 1–2 minuty.

---

## Co będzie potrzebne (instalujemy raz)

Zainstalujemy trzy darmowe programy. Klikaj „dalej/zgadzam się" jak przy
zwykłej instalacji aplikacji.

### Program 1 — Node.js (silnik aplikacji)
1. Wejdź na stronę: **https://nodejs.org**
2. Kliknij duży przycisk z napisem **„LTS"** (zalecana wersja).
3. Otwórz pobrany plik i przeklikaj instalator (same „Continue/Dalej",
   na końcu „Install/Zainstaluj", podaj hasło do komputera, jeśli poprosi).

### Program 2 — Docker Desktop (tymczasowa baza danych do testów)
1. Wejdź na: **https://www.docker.com/products/docker-desktop/**
2. Pobierz wersję dla swojego komputera (Mac z procesorem Apple = „Apple
   chip"; starszy Mac = „Intel chip"; Windows = „Windows").
3. Zainstaluj i **uruchom** aplikację Docker Desktop (ikona wieloryba).
   Poczekaj, aż wieloryb przestanie się animować — to znaczy, że jest gotowy.
   Docker musi być **włączony** w trakcie testów.

### Program 3 — Git (do pobrania kodu aplikacji)
- **Mac:** Git zwykle już jest. Sprawdzimy to w kroku poniżej — jeśli go nie
  ma, system sam zaproponuje instalację, wystarczy kliknąć „Zainstaluj".
- **Windows:** pobierz z **https://git-scm.com/download/win** i przeklikaj
  instalator (zostaw domyślne ustawienia).

---

## Otwórz Terminal (to nasze „okno poleceń")

- **Mac:** naciśnij `Cmd (⌘) + Spacja`, wpisz **Terminal**, naciśnij Enter.
- **Windows:** naciśnij klawisz Windows, wpisz **PowerShell**, naciśnij Enter.

Pojawi się okno z migającym kursorem. Do niego będziesz wklejać polecenia.

> 💡 **Wklejanie:** zaznacz polecenie tutaj, skopiuj (`Cmd/Ctrl + C`), kliknij
> w okno Terminala i wklej (`Cmd + V` na Macu, `Ctrl + V` lub prawy przycisk
> myszy na Windows). Po wklejeniu **zawsze naciśnij Enter**.

---

## Krok 1 — Pobierz kod aplikacji

Wklej i naciśnij Enter (skopiuje aplikację do folderu `home` na Twoim koncie):

```bash
cd ~
git clone https://github.com/styka/home.git
cd home/worldofmag
```

> Jeśli Mac zapyta o instalację „narzędzi wiersza poleceń" — kliknij
> **„Zainstaluj"** i poczekaj, potem wklej te trzy linijki ponownie.

## Krok 2 — Zainstaluj wnętrzności aplikacji

Wklej **całość** (to jedna komenda po drugiej) i naciśnij Enter. Potrwa kilka
minut — będzie się przewijać dużo tekstu, to normalne. Poczekaj, aż znów
pojawi się kursor.

```bash
npm install
npm run test:e2e:install
```

## Krok 3 — Uruchom klikacze 🎬

Wklej i naciśnij Enter:

```bash
npm run test:e2e:local
```

Co się stanie:
1. W tle wstanie tymczasowa baza danych (dlatego Docker musi być włączony).
2. **Otworzy się okno przeglądarki**, które samo zacznie klikać po aplikacji —
   loguje się, otwiera listy zakupów, zadania, notatki, kuchnię itd.
3. Klikanie jest **celowo spowolnione**, żeby dało się je obejrzeć.
4. W Terminalu przy kolejnych testach pojawią się zielone „ptaszki" ✓.

Na końcu zobaczysz podsumowanie, np. `12 passed` (12 testów zaliczonych) —
to znaczy, że **wszystko działa**. ✅

## Krok 4 — Posprzątaj po testach (opcjonalnie)

Gdy skończysz, wyłącz tymczasową bazę:

```bash
npm run test:e2e:local:down
```

---

## Następnym razem (gdy już wszystko zainstalowane)

Wystarczą trzy linijki — upewnij się tylko, że **Docker Desktop jest włączony**:

```bash
cd ~/home/worldofmag
git pull
npm run test:e2e:local
```

---

## Warianty (gdybyś chciał/a)

- **Tylko wersja na komputer (desktop):**
  ```bash
  npm run test:e2e:desktop
  ```
- **Tylko wersja na telefon (iPhone):**
  ```bash
  npm run test:e2e:mobile
  ```
- **Ładny raport na koniec** (otworzy się w przeglądarce ze szczegółami):
  ```bash
  npm run test:e2e:report
  ```

---

## Gdy coś nie zadziała — najczęstsze przyczyny

| Co widzisz | Co zrobić |
|-----------|-----------|
| `Cannot connect to the Docker daemon` / błąd o Dockerze | Uruchom aplikację **Docker Desktop** i poczekaj, aż wieloryb się uspokoi. Potem powtórz Krok 3. |
| `command not found: npm` lub `node` | Node.js nie zainstalował się — wróć do „Program 1", zainstaluj ponownie, **zamknij i otwórz Terminal na nowo**. |
| `command not found: git` | Zainstaluj Git („Program 3") i otwórz Terminal na nowo. |
| Okno przeglądarki nie otwiera się, ale w Terminalu lecą ✓ | To też OK — testy działają w tle; podsumowanie `passed` na końcu jest najważniejsze. |
| Pobieranie w Kroku 2 przerwane / błąd sieci | Sprawdź internet i wklej polecenia z Kroku 2 jeszcze raz. |

Jeśli utknniesz — skopiuj **ostatnich kilka linijek** z Terminala i wyślij je
osobie technicznej (albo Szymonowi). Po treści błędu od razu widać, co poprawić.

---

### Dla ciekawskich: co to są te „klikacze"?
To program (Playwright), który udaje prawdziwego użytkownika: otwiera
przeglądarkę, klika przyciski, wpisuje teksty i sprawdza, czy aplikacja
reaguje poprawnie. Dzięki temu po każdej zmianie w kodzie można w minutę
sprawdzić, że nic się nie zepsuło — bez ręcznego klikania po wszystkich
ekranach.
