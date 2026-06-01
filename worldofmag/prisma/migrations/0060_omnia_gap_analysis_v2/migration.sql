-- Korekta raportu luk (0059) zgodnie z precyzyjną weryfikacją kodu (2026-06-01).
-- Ten sam slug — ON CONFLICT DO UPDATE nadpisuje treść 0059. Poprawia 3 pozycje
-- błędnie policzone jako w pełni zrobione (R2/S2/NM1 → częściowo) i dodaje sekcję
-- „częściowo zrobione". Idempotentny upsert.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport luk wdrożeniowych (2026-06-01)',
  'omnia-luki-wdrozeniowe-2026-06-01',
  $omnia_gap$# Omnia — Raport luk wdrożeniowych vs raport architektury (2026-06-01, v2)

> **Cel:** uczciwa inwentaryzacja każdej sekcji „co poprawić" z raportu „Omnia — Pełna
> architektura aplikacji (stan 2026-05-31)". Stan zweryfikowany **w kodzie**, nie z pamięci.
> Legenda: ✅ zrobione · 🟡 częściowo · ❌ niezrobione.
> Szczególny nacisk: marketplace „Usługi" jako konkurent **Fixly/Booksy** (sekcja 3).

---

## 1. Zrobione w pełni ✅

- `X1` Design system — prymitywy `Button/Card/Surface/Badge/EmptyState/IconButton`.
- Helpery własności (`src/lib/ownership.ts`).
- `R4` Renderer markdown — listy zagnieżdżone + nagłówki `####`/`#####`/`######`.
- `X7` Aktualizacja `CLAUDE.md` + dokumentacja E2E (kiedy/jak klikać).
- `A4` `/admin/architecture` zsynchronizowane z realnym stanem (17 modułów, 12 domen DB).
- `H6`/`HA4` Akcje asystenta AI dla **Nawyków/Portfela/Kuchni/Floty** (`toggle_habit`, `add_expense`, `add_income`, `plan_meal`, `add_fuel_log`).
- `HA1` Heatmapa nawyków miesięczna/roczna (toggle 3m/6m/1r).
- `HA5` Statystyki motywacyjne nawyków (best streak + % ukończenia).
- `L4` Statystyki nauki języków (przeczone słówka, pasek postępu per talia).
- `R1` Podgląd live Markdown w edytorze raportów (edytor/split/podgląd).
- `K3` „Co ugotować z tego co mam?" — przycisk AI na stronie Kuchni.
- `N5` AI Q&A notatek wyeksponowane (`NotesQA`).
- `S3` Brak `prompt()` w repo (tworzenie listy = inline-input/modal).

## 2. Zrobione częściowo 🟡 (do domknięcia)

- `R2` **Wyszukiwarka raportów** — działa, ale **tylko po tytule**. Dokument (§14) wskazuje
  filtr **po treści**. Do uzupełnienia: zwrócić `content` z akcji serwerowej i filtrować po nim.
- `S2` **„Zakończ zakupy"** — archiwizacja listy działa, ale **bez ekranu podsumowania**
  zakupów (§2.6 mówi „archiwizacja z podsumowaniem").
- `NM1` **Kalendarz** — agreguje Zadania/Posiłki/Zdrowie/Pojazdy, ale **NIE** opiekę nad
  zwierzętami ani powtórki języków (SRS). §18.5 chce „daty ze **wszystkich** modułów".
  Do domknięcia: dorzucić `PetCareTask`/`PetTreatment` (nextDueAt) i `Vocabulary` (dueAt) + spiąć `/pets/calendar`.
- `X1/X2/X3` Design system — prymitywy są, ale **propagacja niepełna** (część modułów wciąż inline-style); brak pełnych stanów ładowania/błędów i onboardingu.
- `S5` Mapy sklepów — generator AI (`StoreWizard` → `/api/llm/stores/generate`) jest; brak szablonów sieci i importu.
- `W4` Auto-wydatki Portfela — AI `add_expense` dodaje ręcznie; brak **automatycznej** integracji Zakupy/Flota/Kuchnia.
- `P3` Zwierzęta — wykresy trendów są; brak **eksportu** (PDF/dla weterynarza).

## 3. Marketplace „Usługi" vs Fixly/Booksy (§18.6 „Mali usługodawcy")

Wymóg właściciela: dział ma **wygrać wszystkim** z Fixly/Booksy; user jest jednocześnie
klientem i wykonawcą; UX najlepszy na świecie. Stan: **v1 = rdzeń CRUD** (oferty, zlecenia
ze statusami, oceny, katalog z szukajką+filtrem kategorii, dwustronność ról). Zweryfikowane
braki — **20 funkcji**, w tym **5 × P0**.

### 3.1 Braki P0 (rdzeń transakcyjny)
| # | Luka | Fixly | Booksy |
|---|------|:---:|:---:|
| M1 | **Czat / wiadomości** klient↔wykonawca | ✓ | ✓ |
| M2 | **Kalendarz dostępności + rezerwacja slotów** (rdzeń Booksy) | — | ✓ |
| M3 | **Wyceny** (wykonawca podaje cenę na zapytanie, klient akceptuje) | ✓ | — |
| M4 | **Zdjęcia / portfolio** ofert i realizacji | ✓ | ✓ |
| M6 | **Powiadomienia** o zleceniu/wiadomości/wizycie (wymaga NM3) | ✓ | ✓ |

### 3.2 Braki P1 (zaufanie i wygoda)
M5/M20 geolokalizacja + mapa + promień (dziś tylko `area` jako tekst) · M7 weryfikacja
wykonawcy (badge, NIP/dokumenty) · M8 usługi z czasem trwania + warianty cennika · M9
płatności/depozyt/faktury (spięcie z Portfelem) · M10 filtry zaawansowane (cena/ocena/lokalizacja/dostępność)
· M12 reschedule + polityka anulowania · M18 onboarding wykonawcy (kreator profilu).

### 3.3 Braki P2 (skala i monetyzacja)
M11 ulubieni/obserwowani · M13 statystyki wykonawcy (przychód/konwersja/obłożenie) · M14
firma z wieloma pracownikami (dziś 1 provider/user) · M15 abonamenty/pakiety · M16
promocje/rabaty/kody · M17 moderacja/spory · M19 profil publiczny/SEO.

### 3.4 Roadmapa marketplace
- **Etap A (P0):** M1 czat (`ServiceMessage`, wątek/zlecenie) · M2 dostępność+rezerwacja
  (`ServiceAvailability` + sloty, kalendarz wykonawcy spięty z NM1) · M3 wyceny (`ServiceQuote`)
  · M4 zdjęcia (`ServiceImage`, wzorzec `RecipeImage`) · M6 powiadomienia (po NM3).
- **Etap B (P1):** geo+mapa · weryfikacja · usługi z czasem trwania · płatności+faktury · filtry · reschedule · onboarding.
- **Etap C (P2):** ulubieni · statystyki · firma+pracownicy · abonamenty · promocje · moderacja · profil/SEO.

**Zależność krytyczna:** M6 wymaga **NM3** (silnik powiadomień push PWA + e-mail), którego nie ma
(jest tylko lokalne `showLocalNotification` na kliencie). NM3 blokuje też T3/Z4/F2/K4/L5.

## 4. Niezrobione ❌ (pozostały backlog wg sekcji „co poprawić")

**Home/AI:** H1 personalizacja dashboardu · H3 transparentność (historia/undo/tokeny/model) ·
H4 niezawodność (rate-limit/kolejka/degradacja) · H5 kosz/soft-delete+potwierdzenie · H7 głos.

**Zakupy:** S1 drag-and-drop · S4 realtime · S6 ceny→Portfel.

**Zadania:** T1 timeline/kalendarz · T2 Kanban · T3 powiadomienia (→NM3) · T4 blocked-by ·
T5 wspólny silnik NL z Home · T6 audyt skrótów.

**Notatki:** N1 WYSIWYG/live-preview · N2 wikilinks+ważony FTS · N3 załączniki · N4 wersjonowanie.

**Kuchnia:** K1 skalowanie porcji→zakupy · K2 kalorie/odżywcze · K4 alerty przeterminowania (→NM3) · K5 review po OCR.

**Zwierzęta:** P1 progressive disclosure · P2 alerty parametrów · P4 spięcie /pets/calendar z NM1.

**Zdrowie:** Z1 repozytorium wyników (PDF/zdjęcia) · Z2 trendy badań · Z3 leki/suplementy · Z4 przypomnienia (→NM3).

**Nawyki:** HA2 cele (3×/tydz) · HA3 synergia z Zadaniami.

**Flota:** F1 TCO+Portfel · F2 push przegląd/OC (→NM3) · F3 załączniki · F4 B2B.

**Portfel:** W1 budżety/cele · W2 import banku · W3 raporty miesięczne · W5 kursy walut.

**Języki:** L1 TTS · L2 typy ćwiczeń · L3 gamifikacja · L5 przypomnienia powtórek (→NM3).

**QA:** Q1 powiązanie scenariuszy↔E2E + pokrycie · Q2 przeniesienie pod admina.

**Truck:** TR1 dokończyć UI · TR2 spiąć z Flotą.

**Raporty:** R3 eksport PDF.

**Ustawienia/Zespoły:** SE1 preferencje (motyw/język/data/strefa/widoki) · SE2 bezpieczeństwo/sesje · SE3 eksport RODO · SE4 onboarding zespołu.

**Admin:** A1 audyt RBAC/config · A2 szyfrowanie kluczy + maskowanie · A3 panel zdrowia systemu.

**Cross-cutting:** X4 i18n (PL/EN) · X5 a11y · X6 tryby motywu light/system.

**Nowe działy:** NM2 Praca · **NM3 silnik powiadomień (push+email) — KRYTYCZNY, blokuje wszystkie przypomnienia i M6** ·
NM4 dokumenty/pliki · NM5 budżet/cele (=W1) · NM6 podróże · NM7 dom · NM8 dziennik/fitness ·
**NM9 kontakty/CRM — fundament marketplace** · NM10 API publiczne.

**Skala (§18.3, całość ❌):** SC1 hosting/DB płatny · SC2 AI limity/kolejki/cache · SC3 wydajność
(paginacja/wirtualizacja) · SC4 observability/Sentry · SC5 RODO/backup/DR · SC6 testy jednostkowe
(SRS/recurrence/stats/routing) · SC7 monetyzacja.

**Branże pro (§18.6):** V1 Hodowca · V2 Gastronomia · V3 Flota B2B · V5 Rolnictwo.

## 5. Rekomendowana kolejność realizacji

1. **NM3** — silnik powiadomień (odblokowuje M6 marketplace + T3/Z4/F2/K4/L5).
2. **NM9** — kontakty/CRM (fundament relacji klient↔wykonawca).
3. **Marketplace Etap A** (M1/M2/M3/M4/M6).
4. **Marketplace Etap B** (geo/weryfikacja/płatności+faktury/filtry/onboarding).
5. **Finanse** W1/W3/W4/W5 (wspiera płatności i auto-wydatki).
6. **AI pro** H3/H4/H5 + **Zadania** T1/T2 + **cross-cutting** X3/X5.
7. **Domknięcie 🟡** R2 (szukaj po treści), S2 (podsumowanie), NM1 (zwierzęta+języki w kalendarzu).
8. **Marketplace Etap C** + branże pro + skala (SC2/SC3/SC4).

**Bilans:** z ~70 pozycji backlogu — **~13 ✅, 7 🟡, reszta ❌**. Marketplace ma rdzeń, lecz do
poziomu „pokonać Fixly/Booksy" brakuje 20 funkcji (5× P0: czat, rezerwacja, wyceny, zdjęcia, powiadomienia).
$omnia_gap$,
  'proposal',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "content" = EXCLUDED."content",
  "category" = EXCLUDED."category",
  "updatedAt" = CURRENT_TIMESTAMP;
