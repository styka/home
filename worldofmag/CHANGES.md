# Changelog — 2026-05-04

## UX Improvements: LLM Section Inline, Rich Emoji Picker, Loading States

### 1. Sekcja LLM/AI — inline zamiast popupu

**Nowy komponent:** `src/components/shopping/LLMInputSection.tsx`

- Sekcja AI zawsze widoczna nad ręcznym polem dodawania produktu
- Niebieska lewa ramka (`border-left: 3px solid accent-blue`) + `bg-elevated` tło — wyraźne odróżnienie od sekcji ręcznej
- Mały label "AI" z ikoną Sparkles w lewym górnym rogu
- **Tryb idle:** kompaktowy pasek z textarea (2 linie) + przycisk mikrofonu + przycisk "Przetwórz"
- **Tryb results:** rozwinięte wiersze z wynikami LLM inline (checkbox, nazwa, qty, unit, kategoria, 📚 katalog)
- Mikrofon obsługuje Web Speech API (pl-PL) — ta sama logika co wcześniej w popupie
- Po "Dodaj do listy" sekcja wraca do trybu idle
- `VoiceLLMModal.tsx` usunięty (logika przeniesiona)

**Zmienione pliki:**
- `src/components/shopping/ShoppingPage.tsx` — dodano `<LLMInputSection>` przed `<QuickAddBar>`
- `src/components/shopping/VoiceLLMModal.tsx` — usunięty

---

### 2. QuickAddBar — jeden przycisk "+", inputy blokowane podczas pending

**Plik:** `src/components/shopping/QuickAddBar.tsx`

- Usunięte dekoracyjne ikony "+" (były widoczne podwójnie obok przycisku akcji)
- Usunięty przycisk mikrofonu (mikrofon przeniesiony do LLMInputSection)
- Przycisk `[+]`: gdy `isPending` → ikona zmienia się na `Loader2 animate-spin`, button disabled
- Wszystkie inputy (qty, unit, kategoria, nazwa): `disabled={isPending}` + `opacity-40`

---

### 3. Bogaty picker emoji — ~300 emoji z wyszukiwarką

**Plik:** `src/components/shopping/CategoryManager.tsx`

- Zastąpiono stary picker (20 emoji bez wyszukiwarki) nowym z:
  - ~300 emoji z polskimi i angielskimi słowami kluczowymi
  - Pole wyszukiwania filtruje emoji w czasie rzeczywistym
  - Grid 8 kolumn z wewnętrznym scrollem (max-height 240px)
  - Zamykanie po kliknięciu poza picker (mousedown listener)
  - Pole "Wpisz własne…" jako fallback (zostało)
- Kategorie emoji: warzywa/owoce, nabiał, mięso/ryby, pieczywo, napoje, przekąski/słodycze, dania, chemia/higiena, dom/kuchnia, transport/auto, sport, elektronika, dzieci, biuro, zwierzęta, prezenty i inne

---

### 4. Wskaźniki ładowania (`isPending`) przy mutacjach

#### ItemRow (`src/components/shopping/ItemRow.tsx`)
- `isPending` podłączony z `useTransition`
- Cały wiersz: `opacity: 0.55` gdy pending + `transition: opacity 0.15s`
- Przycisk toggle statusu: spinner `Loader2 size=9 animate-spin` gdy pending (zamiast checkboxa/wykrzyknika)
- Button toggle: `disabled={isPending}`

#### CategoryManager (`src/components/shopping/CategoryManager.tsx`)
- Przyciski Save/Delete/Create: `disabled={isPending}`, ikona `Loader2` zamiast `Check` gdy pending
- Wiersze kategorii: `opacity: 0.6` gdy pending

#### UnitManager (`src/components/shopping/UnitManager.tsx`)
- Przycisk "Nowa jednostka": spinner gdy pending, `disabled={isPending}`
- Przyciski rename/delete: `disabled={isPending}`
- Wiersze jednostek: `opacity: 0.6` gdy pending

#### ProductManager (`src/components/shopping/ProductManager.tsx`)
- Przycisk Create: `disabled={isPending || !name.trim()}`, `Loader2` gdy pending

---

### Pliki zmienione

| Plik | Operacja |
|------|----------|
| `src/components/shopping/LLMInputSection.tsx` | NOWY |
| `src/components/shopping/VoiceLLMModal.tsx` | USUNIĘTY |
| `src/components/shopping/ShoppingPage.tsx` | Dodano `<LLMInputSection>` |
| `src/components/shopping/QuickAddBar.tsx` | Usunięto ikony i mikrofon; spinner na przycisku |
| `src/components/shopping/CategoryManager.tsx` | Bogaty EmojiPicker + isPending |
| `src/components/shopping/ItemRow.tsx` | isPending → opacity + spinner |
| `src/components/shopping/UnitManager.tsx` | isPending → opacity + spinner |
| `src/components/shopping/ProductManager.tsx` | isPending na przycisku Create |

### Wcześniej (ta sama sesja)

- Dodano parametr `category` do `addItemStructured` (opcjonalny, fallback do `categorize()`)
- QuickAddBar: kolejność pól qty → unit → kategoria → nazwa
- VoiceLLMModal: pole kategorii per wiersz z auto-kategoryzacją
- Kategorie i jednostki fetchowane i przekazywane przez ShoppingPage → QuickAddBar
