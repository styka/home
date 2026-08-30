# Recenzja: Advanced Skins (116)

- **Spec:** ./spec.md · **Weryfikacja:** ./verify.md (GOTOWE Z UWAGAMI)
- **Data:** 2026-08-30
- **Zakres:** `git diff 89667b46..HEAD` — 30 plików, ~3400 dodanych linii
- **Metoda:** recenzja świeżym okiem (subagent omnia-reviewer) + własny przegląd punktów
  ryzyka (ścieżki tekst→CSS, spread atrybutów na `<html>`, guardy akcji, fallbacki)

## Rdzeń bezpieczeństwa — bez zastrzeżeń

Nie istnieje ścieżka, którą tekst z LLM/importu trafia do CSS bez sanityzacji: wartości
przechodzą `sanitizeValueOfKind` z zamkniętych katalogów, `url()`/`var()` w wartościach są
niemożliwe (whitelisty funkcji per rodzaj), klucze i wartości atrybutów `data-*`
w `{...skin.atrybuty}` pochodzą wyłącznie ze stałych katalogów kompilatora (nie da się
wstrzyknąć `onload` itp.), `url()` buduje tylko kompilator z cuid-a zweryfikowanego
w magazynie. Rename w pickerze nie zeruje definicji; migracja 0284 spójna ze schematem.

## Ustalenia (od najpoważniejszego) — wszystkie NANIESIONE w ramach recenzji

1. **security · `api/skins/assets/[id]/route.ts`** — `Cache-Control: public` na odpowiedzi
   bramkowanej sesją pozwalałby cache'om współdzielonym serwować grafikę bez sesji.
   ✅ Poprawione: `private, max-age=31536000, immutable` + `X-Content-Type-Options: nosniff`;
   dodatkowo upload weryfikuje **magic bytes** (PNG/JPEG/WebP) zamiast ufać klienckiemu
   `file.type` (`skinAssets.ts`, `zgodnaSygnatura`).
2. **correctness · `polityki.ts` + trasa generowania** — polityka deklarowała
   `rownolegle: 1`, ale trasa wołała tylko `sprawdzLimit`; dwuklik „Generuj" odpalał dwie
   równoległe generacje. ✅ Poprawione: `zajmijSlot("ai.skorki")` + `release()` w `finally`
   (wzorzec trasy agenta), 429 z `komunikatSlot` przy zajętym slocie.
3. **correctness · `actions/skins.ts` (readActiveSkin)** — `parseDefinicja` nigdy nie
   rzuca, więc obiecana degradacja „błąd → lustrzana warstwa tokenów" była nieosiągalna
   (uszkodzony rekord/przyszła wersja → pusta kompilacja = domyślna ciemna). ✅ Poprawione:
   pusta definicja (żadnej warstwy) → powrót do warstwy tokenów z `Skin.tokens`.
4. **correctness · `SkinEditor.tsx`** — `onSavedAdvanced` szło bezwarunkowo, więc
   przełącznik „Zaawansowana" pojawiał się też w edytorze skórek SYSTEMOWYCH i tworzył
   tam prywatną skórkę konta admina, wbrew obietnicy przycisku. ✅ Poprawione: przełącznik
   tylko w `mode === "user"`.
5. **security (niska, częściowo zastana) · `actions/skins.ts` (duplicateSkin)** —
   `findUnique` po id bez guarda dostępności; 116 rozszerzył kopię o pełną definicję.
   ✅ Poprawione: ten sam guard co w `exportSkin` (tylko skórki widoczne w pickerze).
6. **correctness (kosmetyczne) · `skinGenerate.ts`** — `opisPorazki` dostawał liczność
   listy odrzuconych zamiast liczby pól przysłanych przez model, myląc diagnozę z 080.
   ✅ Poprawione: licznik `przyslanychPol`.
7. **simplification · `skinAssets.ts`** — nieużywany import `requireAuth`. ✅ Usunięty.
   Gałęzie własności zespołowej assetów zostają świadomie (upload zespołowy to naturalne
   następstwo; gałęzie są poprawne i pokrywane guardem).

Po poprawkach: `tsc` czysty, testy skórek/generatora/polityk 26/26, `next lint` bez
ostrzeżeń, `next build` + budżet wydajnościowy zielone (build3).

## Werdykt: **APPROVE Z UWAGAMI**

Uwagi (nieblokujące, poza zakresem 116):
- E2E ma 22 zastane porażki na `develop` (fixture oczekuje 22 modułów przy 24
  w rejestrze; nazwy zakładek Wiadomości po 111–115) — do osobnej roboty aktualizacji
  klikaczy; szczegóły i dowody w `verify.md`.
- Deduplikacja assetów per-właściciel+systemowe (nie globalna) — świadoma decyzja
  bezpieczeństwa (kaskada usuwania konta), plan §2.
- Generator obrazów = abstrakcja z providerem „brak" (decyzja właściciela) — sloty
  grafik działają, podłączenie dostawcy opisane w `docs/skorki/zaawansowane.md` §7.
