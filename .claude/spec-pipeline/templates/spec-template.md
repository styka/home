# Spec: <NAZWA FEATURE'A>

- **ID:** <NNN-slug>
- **Status:** draft <!-- draft | planned | in-progress | verified | done -->
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** <YYYY-MM-DD>
- **Moduł(y):** <np. Tasks / Portfel / nowy moduł>

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba
<1–3 zdania: jaki ból użytkownika lub braką funkcji rozwiązujemy. Dlaczego teraz.>

## 2. Cel i miary sukcesu
- Cel: <jedno zdanie — stan docelowy>
- Sukces mierzymy: <obserwowalny efekt, np. „użytkownik dodaje X w ≤2 kliknięcia">

## 3. Historyjki użytkownika
- Jako <rola> chcę <akcja>, żeby <korzyść>.
- …

## 4. Kryteria akceptacji (testowalne)
Format Given/When/Then — każde musi dać się zweryfikować w `/verify`.
- [ ] **AC-1** — Given <stan>, when <akcja>, then <obserwowalny wynik>.
- [ ] **AC-2** — …

## 5. Zakres
**W zakresie:**
- …

**Poza zakresem (świadomie):**
- …

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** <istniejący slug `module.*` czy nowy? — por. C-22>
- **Własność danych:** <user-only / user+team (`ownerId`/`ownerTeamId`) — por. C-21>
- **Asystent AI:** <czy wymaga nowej `AIAction` / read-toola? — por. C-23. Jeśli nie: „nie dotyczy">
- **Kalendarz / powiadomienia / trash:** <czy feature powinien się w nie wpiąć?>

## 7. Zgodność z konstytucją
Które reguły z `constitution.md` są kluczowe dla tego feature'a (po numerach `C-NN`) i dlaczego.

## 8. Otwarte pytania / decyzje właściciela
- [ ] <pytanie, na które potrzebna odpowiedź Szymona zanim ruszymy z planem>

## 9. Ryzyka
- <ryzyko → jak je ograniczamy>
