# Dodatek A.3 — Plany wdrożenia: bezpieczeństwo i RODO

Plany realizujące zalecenia z Rozdz. 8. **Najwięcej P0 w całym audycie — „brama” przed publicznym
startem.**

---

## Plan Z-050 (P0) — Eksport danych użytkownika (RODO art. 15/20)

**Cel:** użytkownik pobiera komplet swoich danych na żądanie.
**Kroki:**
1. Server Action `exportMyData()` w nowym `src/actions/privacy.ts`: zebrać wszystkie rekordy usera ze
   wszystkich modułów (po `ownerId` i członkostwie zespołów — uważać, by nie eksportować cudzych danych
   zespołu bez kontekstu) do struktury JSON; spakować (ZIP) z plikami per moduł.
2. UI w `/settings`: przycisk „Pobierz moje dane” → akcja → pobranie pliku.
3. Operacja potencjalnie ciężka → użyć kolejki (plan Z-131) i powiadomić, gdy gotowe.
**Pliki:** `src/actions/privacy.ts`, `src/app/settings/*`, komponent ustawień.
**Kryteria:** eksport zawiera dane ze wszystkich modułów usera; nie zawiera cudzych; format czytelny
(JSON/ZIP).
**Ryzyka:** wydajność (duże konta) → kolejka; prywatność (dane zespołu) → eksportować tylko to, czego
user jest właścicielem + jasno oznaczyć dane współdzielone.

---

## Plan Z-051 (P0) — Twarde usunięcie konta (RODO art. 17)

**Cel:** użytkownik trwale usuwa konto i dane.
**Kroki:**
1. Server Action `deleteMyAccount()` (`privacy.ts`): po potwierdzeniu (np. wpisanie e-maila) usunąć/
   zanonimizować dane usera — opierając się na **jawnej polityce `onDelete`** (plan Z-033). `AuditLog`
   zostaje (zrzut e-maila, bez FK — patrz CLAUDE.md).
2. Obsłużyć skutki dla zespołów (przekazanie własności lub usunięcie zasobów user-only) i marketplace
   (otwarte zlecenia/płatności — reguły zamknięcia).
3. Wylogowanie + potwierdzenie.
**Pliki:** `src/actions/privacy.ts`, `prisma` (polityki `onDelete`), UI ustawień.
**Kryteria:** po usunięciu brak danych usera w bazie (poza wymaganymi prawnie logami/fakturami); brak
sierot; testy (plan Z-172).
**Ryzyka:** dane wymagane prawnie (faktury) — zachować/zanonimizować zgodnie z prawem, nie kasować na ślepo.

---

## Plan Z-052 (P0) — Audyt pokrycia autoryzacji w Server Actions (anty-IDOR)

**Cel:** żadna akcja nie pozwala sięgnąć po cudzy rekord po ID.
**Kroki:**
1. Przejść 57 plików `src/actions/*`; dla każdej akcji przyjmującej `id` zasobu sprawdzić, że woła
   `assert*Access`/filtruje po `OR(ownerId, ownerTeamId ∈ teamIds)` **przed** mutacją/odczytem.
2. Uzupełnić braki; ujednolicić helpery dostępu (`src/lib/ownership.ts`).
3. Rozważyć **strażnik buildu** (jak `check-action-coverage`) wykrywający akcje bez wywołania guarda.
**Kryteria:** każda akcja na cudzych danych ma sprawdzenie własności; testy IDOR (plan Z-172) zielone.
**Ryzyka:** false-negatives przy nietypowych akcjach — uzupełnić testami, nie tylko statyką.

---

## Plan Z-053 (P0) — Polityka prywatności, regulamin, zgody, rejestr przetwarzania

**Cel:** spełnić formalne wymogi przed wpuszczeniem publicznych userów.
**Kroki:** przygotować (z prawnikiem/DPO) politykę prywatności, regulamin, baner zgód (cookie/analityka/
reklamy), rejestr czynności przetwarzania, umowy powierzenia z podprocesorami (Google, Groq/LLM, Neon,
Render); dodać strony `/legal/*` + link w stopce/onboardingu; mechanizm zgód (zapis + wersjonowanie).
**Kryteria:** dostępne dokumenty prawne; zgody zbierane i zapisywane; lista podprocesorów aktualna.
**Uwaga:** **wymaga decyzji właściciela + prawnika** — część niewykonalna „kodem”; oznaczyć w raporcie
jako zależne od decyzji, dostarczyć część techniczną (strony, mechanizm zgód).

---

## Plan Z-054 (P1) — Procedura `AUTH_SECRET`/`CONFIG_SECRET`

**Cel:** nie utracić zaszyfrowanych kluczy przez rotację sekretu.
**Kroki:** udokumentować w CLAUDE.md, że sekret jest stały; trzymać w menedżerze sekretów Render (nie w
repo); jeśli rotacja konieczna — procedura re-szyfrowania kluczy (`secrets.ts`).
**Kryteria:** dokument procedury istnieje; sekret poza repo.

---

## Plan Z-055 / Z-137 (P1) — Minimalizacja danych w promptach LLM

**Cel:** nie wysyłać nadmiaru danych wrażliwych do dostawcy.
**Kroki:** przejrzeć budowanie promptów (`src/lib/ai/*`, `/api/llm/*`); ograniczyć kontekst do
niezbędnego; dodać per-operację informację, jakie dane i do kogo trafiają; opcja wyłączenia AI dla
modułów wrażliwych (Zdrowie).
**Kryteria:** prompty nie zawierają zbędnych pól wrażliwych; user wie, co jest wysyłane.

---

## Pozostałe (skrót)

- **Z-056 (P1)** — reklamy kontekstowe (bez profilowania) jako domyślny model — patrz plan A.10 (Rozdz. 56).
- **Z-057 (P1)** — testy bezpieczeństwa ścieżek krytycznych — patrz plan A.9 (Rozdz. 55).
- **Z-058 (P2)** — zarządzanie sesjami/urządzeniami + 2FA — po fundamencie RODO.
- **Z-059 (P1)** — polityka retencji (kosz/logi/nieaktywne konta) + zadanie czyszczące.

**Kolejność:** Z-053 (równolegle, z prawnikiem) ‖ Z-033→Z-051, Z-050, Z-052, Z-190 (plan A.12) → reszta.
**Twardy warunek:** Z-050, Z-051, Z-052, Z-053 + Z-190 muszą być gotowe **przed** publicznym startem.
