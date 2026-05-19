# Raport Refaktoringu — Iteracja 03

**Data:** 2026-05-18  
**Zakres:** Dedulikacja nawigacji w `ModuleSidebar` + przygotowanie linku do widoku architektury

---

## Podsumowanie wykonawcze

Trzecia iteracja skupiła się na `ModuleSidebar.tsx`, gdzie sekcja dolna (Zaproszenia, Ustawienia, Admin, Playground) była implementowana jako pełne linki z inline `onMouseEnter`/`onMouseLeave` handlerami — zamiast używać już istniejącego komponentu `NavItem` zdefiniowanego w tym samym pliku. Dało to 115 linii nadmiarowego kodu.

---

## Zidentyfikowane problemy

### 1. `ModuleSidebar.tsx` — `NavItem` nieużywane w sekcji dolnej

Plik definiuje `NavItem` jako reużywalny komponent, ale 4 linki w sekcji dolnej (linie 165–279) były implementowane bezpośrednio jako `<Link>` z ręcznie powielonymi hover handlerami:

```typescript
// Każdy link z 15+ linii kodu:
<Link
  href="/invitations"
  onMouseEnter={(e) => {
    if (!pathname.startsWith("/invitations")) {
      e.currentTarget.style.backgroundColor = "var(--bg-hover)";
      e.currentTarget.style.color = "var(--text-primary)";
    }
  }}
  onMouseLeave={(e) => {
    if (!pathname.startsWith("/invitations")) {
      e.currentTarget.style.backgroundColor = "";
      e.currentTarget.style.color = "var(--text-secondary)";
    }
  }}
>
```

### 2. `NavItem` nie obsługiwał `children` ani `accentColor`

Oryginalny `NavItem` miał stałe kolory (zawsze `--text-primary` dla aktywnego). Linki adminskie powinny być purpurowe — stąd osobna implementacja zamiast reużycia.

---

## Wprowadzone zmiany

### Rozszerzenie `NavItem` w `ModuleSidebar.tsx`

```typescript
function NavItem({
  href, label, icon, pathname,
  exact = false,
  accentColor,   // ← nowe: opcjonalny kolor aktywny (domyślnie --text-primary)
  children,      // ← nowe: slot dla badge/licznika
}: { ... }) {
```

`accentColor` pozwala na użycie `var(--accent-purple)` dla linków adminskich bez duplikowania kodu.

`children` umożliwia wstrzyknięcie badge z liczbą zaproszeń bezpośrednio do `NavItem`.

### Uproszczenie sekcji dolnej (115 → 20 linii)

```typescript
// Przed:
<Link href="/invitations" onMouseEnter={...} onMouseLeave={...}>
  <Mail size={18} />
  <span>Zaproszenia</span>
  {invitationCount > 0 && <span style={{...}}>{invitationCount}</span>}
</Link>
// ... (×4 podobne bloki)

// Po:
<NavItem href="/invitations" label="Zaproszenia" icon={<Mail size={18} />} pathname={pathname}>
  {invitationCount > 0 && <span style={{...}}>{invitationCount}</span>}
</NavItem>
<NavItem href="/settings" label="Ustawienia" icon={<Settings size={18} />} pathname={pathname} />
{isAdmin && <NavItem href="/admin" label="Admin" icon={<Shield size={18} />} pathname={pathname} accentColor="var(--accent-purple)" />}
{isAdmin && <NavItem href="/admin/playground" label="Playground" icon={<FlaskConical size={18} />} pathname={pathname} accentColor="var(--accent-purple)" />}
{isAdmin && <NavItem href="/admin/architecture" label="Architektura" icon={<Shield size={18} />} pathname={pathname} accentColor="var(--accent-purple)" />}
```

### Dodanie linku do Architektury

W obu miejscach nawigacji (`ModuleSidebar` i `AppShell` mobile menu) dodano link do `/admin/architecture` — nowego widoku dla adminów opisującego architekturę aplikacji (implementowany w Iteracji 5).

---

## Metryki

| Miara | Przed | Po |
|-------|-------|----|
| Linie sekcji dolnej `ModuleSidebar` | ~115 | ~22 |
| Prop `children` w `NavItem` | Brak | Jest |
| Prop `accentColor` w `NavItem` | Brak | Jest |
| Hover handler kopie | 4 | 0 |
| Linki admin w nawigacji | 2 | 3 (dodano Architecture) |

---

## Problemy znalezione przy okazji

1. **Duplikacja struktury nav między AppShell mobile i ModuleSidebar desktop:** Obydwa mają te same linki hardkodowane osobno. Pełna unifikacja wymagałaby wyekstrahowania wspólnej struktury do `src/lib/nav.ts` (definicje tras) i wspólnego komponentu. To większa zmiana zostawiona na osobną iterację — ryzyko regracji layout.

2. **`isShoppingActive` w AppShell jest zbędne** — używa `pathname.startsWith("/shopping")` ale nigdy się nie odwołuje do MODULES array. Zmienna jest zdefiniowana ale nieużywana w kilku miejscach.

3. **`MODULES` array w AppShell** definiuje `topBarIcon` i `icon` osobno (ten sam `size={20}` vs `size={16}`). Można by mieć jeden icon z CSS `font-size`.

4. **Admin "Architektura"** — ikona używa `<Shield>` zamiast dedykowanej ikony. Po stworzeniu strony warto zmienić na `<Map>` lub `<Network>` z lucide-react.

---

## Co pozostało do zrobienia

- Pełna ekstrakcja struktury nav do `src/lib/nav.ts` (unifikacja mobile + desktop)
- Zmiana ikony Architecture na bardziej reprezentatywną
- Usunięcie `isShoppingActive` z AppShell (dead code)
