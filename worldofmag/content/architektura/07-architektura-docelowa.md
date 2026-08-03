# Architektura docelowa — struktura i reguły

> Od tego rozdziału dokument opisuje **stan docelowy**. Czas teraźniejszy oznacza „tak ma być po
> przebudowie".

## 1. Struktura

```
worldofmag/src/
├─ modules/                      ← 21 modułów, każdy samowystarczalny
│  ├─ tasks/
│  │  ├─ contract.ts             ← JEDYNE, co widzą inne moduły
│  │  ├─ module.ts               ← deklaracja rejestrująca
│  │  ├─ domain/                 ← logika bez Prismy i Reacta — testowalna w milisekundach
│  │  ├─ actions/                ← Server Actions (prywatne dla modułu)
│  │  ├─ ui/                     ← komponenty
│  │  └─ __tests__/
│  ├─ shopping/  notes/  kitchen/  pets/  health/  habits/  flota/
│  ├─ portfel/  languages/  news/  weather/  magazynowanie/  warsztaty/
│  ├─ services/  calendar/  contacts/  qa/  truck/  reports/  home/
│
├─ platform/                     ← wspólne zdolności; NIE zna żadnego modułu
│  ├─ auth/          sesja, RBAC modułowy
│  ├─ sharing/       ⭐ współdzielenie zasobów: ACL, role, zaproszenia, dziedziczenie
│  ├─ concurrency/   ⭐ wersjonowanie rekordów, wykrywanie konfliktu
│  ├─ db/            Prisma, pula połączeń, transakcje
│  ├─ events/        outbox, publikacja, subskrypcje
│  ├─ realtime/      ⭐ SSE, kanały per zasób, obecność
│  ├─ jobs/          kolejka (istnieje)
│  ├─ ai/            routing modeli, koszty, limity, pamięć treści
│  ├─ cache/         unieważnianie per użytkownik i zasób
│  ├─ i18n/          tłumaczenia, formatowanie
│  ├─ observability/ logi strukturalne, metryki
│  ├─ ui/            system komponentów, kontrakt widoku
│  ├─ viewState/  shortcuts/  favorites/  trash/  audit/  notifications/  activity/
│  └─ registry.ts    składa moduły w aplikację
│
├─ app/                          ← trasy Next.js — CIENKIE: sesja, dane, render
└─ generated/                    ← artefakty budowania
```

⭐ = zdolności, których dziś nie ma i które powstają w tej przebudowie.

**Kluczowa asymetria:** `platform/` **nie zna** żadnego modułu. Moduł zna platformę i kontrakty
innych modułów. Zależność idzie w jedną stronę — to jedyny sposób, żeby platforma pozostała stabilna,
gdy modułów przybywa.

## 2. Cztery reguły konstytucyjne

### R1 — moduł widzi inny moduł wyłącznie przez `contract.ts`

```ts
// ✅ dozwolone
import { tasksInRange } from "@/modules/tasks/contract";
import { requireAccess } from "@/platform/sharing";

// ❌ zablokowane przez ESLint
import { getTasks } from "@/modules/tasks/actions/tasks";
import { TaskRow } from "@/modules/tasks/ui/TaskRow";
```

Wymuszone `no-restricted-imports`:
```js
{ group: ["@/modules/*/!(contract)", "@/modules/*/!(contract)/**"],
  message: "Moduł widzi inny moduł tylko przez contract.ts. Potrzebujesz więcej? Rozszerz kontrakt." }
```

**Bez tej reguły cała przebudowa jest bezwartościowa** — granice bez egzekwowania erodują
w tygodnie. To najczęstszy sposób, w jaki takie przebudowy się marnują.

### R2 — moduł nie zmienia innego modułu; publikuje zdarzenie

```ts
// ❌ Zakupy wiedzą o Portfelu — trzeci odbiorca wymaga zmiany Zakupów
await bookWalletExpense({ amount, elementId });

// ✅ Zakupy ogłaszają fakt; kto chce, ten nasłuchuje
await publish({ type: "shopping.list.completed", ownerId, payload: { listId, total } });
```

### R3 — moduł rejestruje się jedną deklaracją

Rejestr modułów, uprawnienia, nawigacja, kafelek pulpitu, wpisy kalendarza, akcje AI i skróty
**wynikają** z `module.ts` (rozdział 9.3), zamiast być utrzymywane w ośmiu równoległych listach.

### R4 — dostęp do zasobu rozstrzyga platforma, nie moduł

```ts
// ❌ każdy moduł pisze własny guard, po swojemu
if (list.ownerId !== userId && !teamIds.includes(list.ownerTeamId)) throw …

// ✅ jeden mechanizm dla wszystkich zasobów
await requireAccess(user, { type: "shopping.list", id: listId }, "edit");
```

To jest bezpośrednia odpowiedź na diagnozę 5.6: pięć mechanizmów, trzy słowniki ról, per-zasobowe
udostępnianie w 3 z 21 modułów. Szczegóły w rozdziale 8.

## 3. Co się NIE zmienia

| Element | Status | Dlaczego zostaje |
|---------|--------|------------------|
| Next.js App Router + Server Actions | bez zmian | trafny wybór; zmiana = miesiące za zero wartości |
| Prisma + PostgreSQL, jedna baza | bez zmian | 147 modeli splecionych relacjami; jedna baza jest warunkiem taniego ACL |
| Brak enumów Prisma (`String` + unia TS) | bez zmian | konwencja `C-12` |
| Motyw przez zmienne CSS + skórki | bez zmian | działa i jest skalowalny |
| Kolejka `Job` | bez zmian | już wielo-instancyjna |
| Bramki jakości | **rozszerzone** | najcenniejszy mechanizm w repo |
| Stan widoku w adresie | **rozszerzony na wszystkie moduły** | fundament pod cache i udostępnianie linków |
| `ownerId` / `ownerTeamId` | **uzupełnione o `ResourceGrant`** | własność zostaje; dochodzi współdzielenie |

## 4. Jak architektura odpowiada na wymagania

| Wymaganie | Odpowiedź |
|-----------|-----------|
| „sprawnie utrzymywać i rozwijać o kolejne moduły" | R3 — jeden katalog, jedna deklaracja (8 miejsc → 1) |
| „wszystkie moduły integrują się z innymi" | R1 i R2 — integracja tania, ale bez sieci N×N |
| „wszystko, co ma sens, da się udostępniać" | R4 + rozdział 8 — współdzielenie jako zdolność platformy |
| „100 tys., docelowo miliony" | Rozdział 11 + `workspaceId` jako klucz partycjonowania |
| „spójność od backendu po UI/UX" | Rozdział 10 — warstwy, system komponentów, kontrakt widoku |
| „rynki zagraniczne" | Rozdział 12 — i18n jako warstwa platformy |
| „przygotowana, ale nie publiczna" | Progi A/B/C — budujemy do B, umożliwiamy C |

## 5. Test poprawności architektury

Dobra architektura to taka, w której **da się wskazać zmianę, której nie obsłuży** — i sprawdzić,
czy ta zmiana jest prawdopodobna.

| Hipotetyczna zmiana | Obsłuży? |
|---------------------|----------|
| Nowy moduł „Podróże" integrujący się z Kalendarzem, Portfelem i Zadaniami | ✅ jeden katalog + deklaracja + subskrypcja zdarzeń; zero zmian w tamtych modułach |
| Udostępnianie zasobów w module, który go dziś nie ma (np. przepisy) | ✅ deklaracja typu zasobu; ACL, zaproszenia i UI z platformy |
| Współredagowanie treści notatki w czasie rzeczywistym (CRDT) | ✅ **wewnątrz modułu Notatek**; reszta nietknięta |
| Wydzielenie Usług do osobnej aplikacji, gdyby marketplace odjechał ruchem | ✅ kontrakt jest już granicą — zamiana wywołania na HTTP jest lokalna |
| Zmiana bazy na inną **w jednym module** | ❌ **nie obsłuży** — jedna baza to świadome ograniczenie |

Ostatni wiersz to **znany, zaakceptowany koszt**, nie przeoczenie. Gdyby stał się problemem, byłby
problemem jednego modułu, nie całej aplikacji.

## 6. Czego architektura NIE gwarantuje

1. **Nie przyspieszy sama z siebie aplikacji** — wydajność to rozdział 11, osobna praca.
2. **Nie zapobiegnie złemu kodowi wewnątrz modułu** — pilnuje granic **między** modułami.
3. **Nie działa bez egzekwowania** — bez reguły ESLint z R1 granice erodują w tygodnie.
4. **Nie zwalnia z testów** — przeciwnie: bez siatki bezpieczeństwa (Faza 0) sama przebudowa jest
   najgroźniejszą zmianą w historii tego projektu.
