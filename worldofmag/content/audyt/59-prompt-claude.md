# Dodatek B — Prompt startowy dla Claude Code

Ten rozdział to **gotowy do skopiowania prompt** dla kolejnej sesji Claude Code. Jego zadaniem jest:
wczytać kontekst całego tego audytu, zrealizować zalecenia z Dodatku A (zaczynając od P0) zgodnie z
konwencjami repo, a na końcu wyprodukować **raport 1:1** — mapowanie każdego `Z-NNN` na status
(zrobione / odłożone) z uzasadnieniem.

> **Jak użyć:** otwórz nową sesję Claude Code na tym repozytorium i wklej całość bloku poniżej (możesz
> dostosować zakres „Na tę sesję weź…”). Prompt jest samowystarczalny — wskazuje, co przeczytać i jak
> pracować.

---

## Prompt (kopiuj od tej linii)

```
Jesteś Claude Code pracującym na repozytorium WorldOfMag/Omnia (katalog aplikacji: worldofmag/).

KONTEKST DO WCZYTANIA (przeczytaj NAJPIERW, w tej kolejności):
1. CLAUDE.md (katalog główny) — konwencje i niezmienniki repo.
2. doświadczenia.md (katalog główny) — lekcje z poprzednich sesji (NIE powtarzaj tych błędów).
3. worldofmag/content/audyt/47-dodatek-lista-zalecen.md — pełna lista zaleceń Z-NNN (P0 najpierw).
4. worldofmag/content/audyt/48..58-plany-*.md — szczegółowe plany wdrożenia per obszar (Dodatek A.2–A.12).
5. Rozdziały źródłowe danego zalecenia (Część II/III/IV) — uzasadnienie i „stan z kodu”.
   Cały audyt żyje w worldofmag/content/audyt/*.md i jest renderowany w /admin/audyt.

NIEZMIENNIKI (z CLAUDE.md — przestrzegaj bezwzględnie):
- Mutacje = Server Actions w src/actions/* kończące się revalidatePath().
- Własność 3-poziomowa (ownerId / ownerTeamId / systemowe); helpery src/lib/ownership.ts.
- RBAC: uprawnienia module.* w src/lib/permissions.ts; nowy moduł = uprawnienie + seed ról + bramka trasy.
- Statusy jako String + unia TS — NIGDY enum Prisma.
- Zmiany schematu = ręczna migracja w prisma/migrations/ z UNIKALNYM numerem (npm run next:migration);
  raporty/seed = idempotentny SQL (dollar-quoting, ON CONFLICT (slug) DO …). NIE renumeruj migracji.
- Build/weryfikacja: `cd worldofmag && npx next build` (sam kompilator; migrate.js pisze do prod-DB —
  nie uruchamiaj go lokalnie). Strażniki: npm run check:actions, npm run check:migrations.
- Po każdej pozycji: zielony build → commit → merge claude/* → develop → push (autoryzacja stała).
- Dopisuj lekcje do doświadczenia.md po każdym nietrywialnym problemie.

ZAKRES TEJ SESJI:
- Na tę sesję weź [WSTAW: np. „wszystkie P0” / „obszar Bezpieczeństwo+RODO (Z-050..Z-059)” / „Z-030, Z-070, Z-090”].
- Realizuj w kolejności priorytetów (P0 → P1 → P2) i wg „Rekomendowanej kolejności realizacji” z rozdz. 47.
- Dla każdego zalecenia: zajrzyj do jego planu wdrożenia (Dodatek A.2–A.12), wykonaj minimalną, spójną
  z repo zmianę, zweryfikuj build, commituj. Nie rób nadmiarowych abstrakcji.

ZASADY PRACY:
- Pracuj pozycja po pozycji; commituj po każdej (małe, odwracalne kroki).
- Jeśli zalecenie wymaga decyzji właściciela (np. wybór bramki płatności, reklamy, hosting płatny,
  scope OAuth Google) albo sieci/infrastruktury niedostępnej w sandboxie — NIE blokuj się: oznacz jako
  „odłożone” z powodem i przejdź dalej (wzorzec graceful degradation jak W5/NBP).
- Aktualizuj statusy w worldofmag/content/audyt (jeśli dotyczy) i listę zaleceń.

PRODUKT KOŃCOWY — RAPORT 1:1:
Po zakończeniu sesji utwórz raport (migracja seedująca Report, kategoria general, slug unikalny,
np. omnia-realizacja-audytu-RRRR-MM-DD) o strukturze:
- Dla KAŻDEGO zalecenia z zakresu sesji: `Z-NNN — <tytuł> — STATUS: ZROBIONE | ODŁOŻONE`
  + 1–3 zdania (co zrobiono i jak / dlaczego odłożone), + zmienione pliki.
- Sekcja „Podsumowanie”: ile P0/P1/P2 zrobione vs odłożone, główne obszary zmian, co zostaje na kolejną
  sesję. Raport ma odzwierciedlać Dodatek A 1:1 (każde Z-NNN ma swój wiersz statusu).

ZACZNIJ od wczytania kontekstu (pkt 1–4) i krótkiego planu, które Z-NNN bierzesz w tej sesji i w jakiej
kolejności. Potem realizuj.
```

## Wskazówki do dostosowania promptu

- **Pierwsza sesja po audycie:** ustaw zakres na **„wszystkie P0”** (16 zaleceń) — to „brama” przed
  marketingiem. Realnie zmieści się kilka na sesję; raport pokaże postęp i resztę.
- **Sesje tematyczne:** podawaj jeden obszar (np. „Bezpieczeństwo+RODO Z-050..Z-059”) — spójniejsze
  commity i łatwiejszy przegląd.
- **Decyzje właściciela:** zalecenia z planów oznaczone jako wymagające decyzji (płatności, reklamy,
  hosting płatny, scope’y OAuth) zostaw w raporcie jako „odłożone — czeka na decyzję”, z rekomendacją
  audytu.
- **Spójność raportu:** raport ma być **mapowalny 1:1** na rozdz. 47 — recenzent powinien móc obok
  każdego `Z-NNN` postawić „zrobione/odłożone”.

## Dlaczego tak

Audyt jest celowo trzymany jako **wersjonowane pliki markdown w repo** (`content/audyt/*.md`,
renderowane w `/admin/audyt`), a nie w bazie — dzięki temu **każda kolejna sesja Claude Code ma do
niego natywny dostęp** (czyta pliki, nie pyta o eksport), a zmiany w audycie są wersjonowane razem z
kodem. Ten rozdział zamyka pętlę: audyt → zalecenia → plany → **prompt** → realizacja → raport 1:1 →
(aktualizacja audytu) → kolejna iteracja.
