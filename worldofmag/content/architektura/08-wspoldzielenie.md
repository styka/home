# Współdzielenie i współpraca — zdolność platformy

> Najważniejszy rozdział produktowy. Odpowiada na wymaganie: **„wszystko, co ma sens, powinno dać
> się udostępniać"** — i na diagnozę 5.1 (cicha utrata pracy) oraz 5.6 (pięć niespójnych
> mechanizmów).

## 1. Zasada nadrzędna

> **Udostępnianie jest zdolnością platformy, nie funkcją modułu.**
> Moduł deklaruje, jakie ma typy zasobów i co znaczą na nich role. Wszystko pozostałe — nadania,
> zaproszenia, dziedziczenie, odwoływanie, UI, audyt — daje platforma.

Konsekwencja: **nowy moduł dostaje pełne współdzielenie za darmo**, deklarując kilka linijek.
Dziś wymagałoby to własnej tabeli, własnych ról i własnych guardów — czyli podatku od każdej
przyszłej funkcji współpracy.

## 2. Przestrzeń (`Workspace`) — nowe pojęcie

Każdy zasób żyje w dokładnie jednej **przestrzeni**. Użytkownik należy do wielu.

| Rodzaj przestrzeni | Powstaje | Przykład |
|--------------------|----------|----------|
| **osobista** | automatycznie przy rejestracji | prywatne notatki, zdrowie, portfel |
| **zespołowa** | ręcznie | „Dom", „Firma", „Hodowla" |

**Dlaczego to pojęcie jest potrzebne, skoro są zespoły:**

1. **Klucz partycjonowania na Próg C.** Zasób współdzielony między użytkownikami z różnych partycji
   łamie naiwny sharding po `ownerId`. `workspaceId` jest naturalną granicą partycji, bo zasób należy
   do dokładnie jednej przestrzeni. **To jedyny element Progu C, który musi być w modelu danych już
   teraz** — dodanie takiego klucza później to migracja 147 modeli.
2. **Zastępuje dwuznaczność `ownerId` + `ownerTeamId`.** Dziś każde zapytanie musi obsłużyć oba
   przypadki (`OR: [{ownerId}, {ownerTeamId: {in: teamIds}}]`). Po zmianie: `where: { workspaceId: { in: mySpaces } }`.
3. **Daje naturalne miejsce na ustawienia wspólne** — waluta, strefa czasowa, język przestrzeni.

**Migracja:** `ownerId: X, ownerTeamId: null` → przestrzeń osobista użytkownika X;
`ownerTeamId: T` → przestrzeń zespołu T. Kolumny `ownerId`/`ownerTeamId` **zostają** przez okres
przejściowy jako źródło prawdy dla migracji, potem znikają.

## 3. Model danych

```prisma
model Workspace {
  id        String   @id @default(cuid())
  kind      String   // "personal" | "team"   (String + unia TS — C-12)
  name      String
  createdAt DateTime @default(now())

  members   WorkspaceMember[]
  grants    ResourceGrant[]
}

model WorkspaceMember {
  workspaceId String
  userId      String
  role        String   // "owner" | "admin" | "member" | "guest"
  createdAt   DateTime @default(now())

  @@id([workspaceId, userId])
  @@index([userId])
}

/** JEDNO nadanie dostępu do JEDNEGO zasobu. Zastępuje TaskShare, PetShare, TaskProjectMember… */
model ResourceGrant {
  id           String    @id @default(cuid())
  workspaceId  String                  // przestrzeń, w której żyje zasób
  resourceType String                  // "tasks.project" | "notes.note" | "shopping.list" | …
  resourceId   String
  subjectType  String                  // "user" | "workspace" | "link"
  subjectId    String?                 // userId | workspaceId | null dla linku
  role         String                  // "viewer" | "commenter" | "editor" | "manager"
  inherited    Boolean   @default(false) // nadanie wyliczone z rodzica (projekt → zadanie)
  expiresAt    DateTime?
  createdById  String
  createdAt    DateTime  @default(now())

  @@unique([resourceType, resourceId, subjectType, subjectId])
  @@index([subjectType, subjectId])          // „co mi udostępniono"
  @@index([resourceType, resourceId])        // „komu udostępniłem to"
  @@index([workspaceId])
}

/** Zaproszenie osoby, która jeszcze nie ma konta albo nie jest w przestrzeni. */
model ResourceInvitation {
  id           String    @id @default(cuid())
  resourceType String
  resourceId   String
  email        String
  role         String
  token        String    @unique
  expiresAt    DateTime
  acceptedAt   DateTime?
  createdById  String

  @@index([email])
}
```

## 4. Jeden słownik ról

Dziś: `MEMBER|ADMIN|OWNER` (zespoły i projekty zadań), `VIEWER|EDITOR` (zadania i zwierzęta),
`String?` (personel firm). **Trzy słowniki, częściowo pokrywające się znaczeniowo.**

Docelowo — **cztery role, uporządkowane rosnąco**:

| Rola | Może |
|------|------|
| `viewer` | czytać |
| `commenter` | czytać + komentować |
| `editor` | czytać + tworzyć / edytować / usuwać zawartość |
| `manager` | jw. + zarządzać dostępem i ustawieniami zasobu |

**Właściciel przestrzeni** ma zawsze `manager` na wszystkim, co w niej żyje.

Moduł **nie definiuje własnych ról** — mapuje swoje operacje na te cztery:

```ts
// modules/tasks/module.ts
resources: {
  "tasks.project": {
    label: "Projekt zadań",
    // Operacje modułu → minimalna rola
    operations: {
      "task.create": "editor",
      "task.edit":   "editor",
      "task.delete": "editor",
      "project.rename": "manager",
      "project.share":  "manager",
    },
    // Dziedziczenie: nadanie na projekcie obowiązuje jego zadania
    children: ["tasks.task"],
  },
}
```

## 5. Kontrola współbieżności — koniec cichej utraty pracy

**Diagnoza 5.1:** żaden model nie ma wersji, więc ostatni zapis wygrywa po cichu.

### 5.1. Mechanizm

Każdy model edytowalny przez wielu użytkowników dostaje kolumnę:

```prisma
version Int @default(0)
```

Każdy zapis:

```ts
const updated = await prisma.task.updateMany({
  where: { id, version: expectedVersion },     // ← warunek na wersji
  data:  { ...patch, version: { increment: 1 } },
});
if (updated.count === 0) throw new ConflictError("task", id);
```

`updateMany` zamiast `update` jest tu istotne: zwraca liczbę zmienionych wierszy zamiast rzucać przy
braku dopasowania, więc **konflikt da się odróżnić od nieistniejącego rekordu**.

### 5.2. Co widzi użytkownik

Nie surowy błąd, tylko wybór — komponent `ConflictDialog` z platformy:

> **Ktoś zmienił to zadanie, zanim zapisałeś.**
> Marek zmienił *termin* i *status* 12 sekund temu.
> `[Zobacz różnice]` `[Nadpisz moją wersją]` `[Odrzuć moje zmiany]` `[Scal ręcznie]`

**Zasada UX:** konflikt nigdy nie kończy się utratą pracy użytkownika bez jego świadomej decyzji.
Wersja odrzucona trafia do kosza jako wersja robocza, żeby dało się do niej wrócić.

### 5.3. Gdzie wersjonowanie NIE wchodzi

Świadome pominięcia, żeby nie płacić za nic:

- **liczniki i agregaty** aktualizowane atomowo (`increment`) — z definicji bezkonfliktowe;
- **wpisy dziennikowe** (`ItemHistory`, `UserActivity`, `AiMessage`) — tylko dopisywane;
- **zasoby nieudostępnialne** (`AssistantPref`, `DashboardPref`, `UserMenuPref`) — jeden użytkownik.

## 6. Współredagowanie tekstu — odroczone, ale przewidziane

Kształt C z rozdziału 4.2 (~1 % operacji): dwie osoby piszą w tym samym polu tekstowym jednocześnie.
Wersjonowanie tego nie rozwiązuje — komunikat „ktoś inny zmienił" przy współredagowaniu jest
bezużyteczny.

**Decyzja: odroczone, wchodzi per pole, gdy pojawi się realne zgłoszenie.**

Architektura ma to umożliwiać:
- pole oznaczone w deklaracji modułu jako `collaborative: true`;
- kanał czasu rzeczywistego (`platform/realtime`) już istnieje — CRDT dokłada tylko warstwę scalania;
- zmiana jest **lokalna dla modułu** — reszta aplikacji jej nie zauważa.

**Kandydaci:** `Note.content`, `Task.description`, `HealthEvent.notes`. To kilka pól, nie 147 modeli.

**Tańsza namiastka na teraz:** blokada miękka („Marek edytuje ten opis od 30 s") oparta na obecności
(punkt 8), plus automatyczny zapis wersji roboczej. Rozwiązuje 80 % bólu za 5 % kosztu.

## 7. Zaproszenia i odkrywalność

| Element | Zachowanie |
|---------|------------|
| **Zaproszenie e-mailem** | Osoba bez konta dostaje link; po rejestracji nadanie aktywuje się automatycznie |
| **Link do udostępnienia** | `subjectType: "link"` — dostęp `viewer`/`editor` dla posiadacza linku, z terminem ważności |
| **„Udostępnione mi"** | Jedno miejsce w aplikacji: wszystkie zasoby ze wszystkich modułów, z rolą i właścicielem |
| **„Co udostępniłem"** | Widok per zasób i zbiorczy; odwołanie dostępu jednym kliknięciem |
| **Powiadomienie** | Nadanie i odwołanie generuje powiadomienie (mechanizm istnieje) |
| **Audyt** | Każde nadanie i odwołanie trafia do `AuditLog` (kategoria `sharing`) |

**Widok „Udostępnione mi" jest możliwy tylko dzięki jednolitemu modelowi** — przy pięciu
mechanizmach wymagałby pięciu zapytań i pięciu formatów.

## 8. Obecność — kto jeszcze tu jest

Tania nadbudowa nad kanałem czasu rzeczywistego (rozdz. 11.1), a produktowo bardzo widoczna:

- awatary osób oglądających ten sam zasób;
- „Marek edytuje" przy polu, które ktoś właśnie zmienia;
- znikanie po rozłączeniu (bez trwałego stanu — obecność żyje w pamięci procesu i w kanale).

**Priorytet: niski.** Wchodzi po Fazie 4, gdy kanał już działa. Wymieniona tu, żeby kanał został
zaprojektowany z myślą o niej (identyfikacja nadawcy, kanały per zasób), a nie przerabiany później.

## 9. Wpływ na sprawdzanie dostępu

```ts
// platform/sharing/access.ts
export async function requireAccess(
  user: SessionUser,
  resource: { type: string; id: string },
  operation: string,
): Promise<void>;
```

**Wymagania niefunkcjonalne — bo to wywołanie jest na ścieżce każdego żądania:**

1. **Jedno zapytanie**, nie N — nadania rozwiązywane razem z dziedziczeniem, jednym `IN`.
2. **Cache per żądanie** — sprawdzenie tego samego zasobu w jednym żądaniu liczy się raz.
3. **Unieważnianie zdarzeniem** — zmiana nadania publikuje `sharing.grant.changed`, co czyści cache
   i wypycha zmianę do przeglądarek (użytkownik traci dostęp **od razu**, nie po odświeżeniu).
4. **Zero zapytań dla właściciela** — najczęstszy przypadek rozstrzyga porównanie `workspaceId`
   z przestrzeniami z sesji.

## 10. Migracja z pięciu mechanizmów do jednego

Kolejność ma znaczenie — od modeli, które już mają udostępnianie, żeby wzorzec sprawdzić na czymś
działającym.

| Krok | Źródło | Cel | Uwagi |
|------|--------|-----|-------|
| 1 | `Team` + `TeamMember` | `Workspace(kind: "team")` + `WorkspaceMember` | 1:1, role prawie identyczne |
| 2 | `ownerId` (bez zespołu) | `Workspace(kind: "personal")` | jedna przestrzeń na użytkownika |
| 3 | `ownerTeamId` na 46 modelach | `workspaceId` | migracja danych + kolumna |
| 4 | `TaskProjectMember` | `ResourceGrant("tasks.project")` | `MEMBER→editor`, `ADMIN/OWNER→manager` |
| 5 | `TaskShare` | `ResourceGrant("tasks.task")` | `VIEWER→viewer`, `EDITOR→editor` |
| 6 | `PetShare` | `ResourceGrant("pets.pet")` | jw. |
| 7 | `ServiceStaff` | zostaje | to **rola w firmie**, nie dostęp do zasobu — inne pojęcie |
| 8 | pozostałe 18 modułów | deklaracja typów zasobów | dostają udostępnianie **po raz pierwszy** |

**Uwaga do kroku 7:** `ServiceStaff` opisuje strukturę organizacyjną firmy w marketplace, a nie
dostęp do zasobu. Wciągnięcie go do `ResourceGrant` byłoby pomyleniem dwóch pojęć — zostaje osobno.

**Uwaga do kroku 3 — to najbardziej ryzykowny krok całej przebudowy.** Dotyka 46 modeli i wymaga
migracji danych. Wykonać: (a) dodać `workspaceId` jako nullable, (b) wypełnić migracją SQL,
(c) przełączyć zapytania, (d) dopiero potem uczynić wymaganym. Nigdy w jednym kroku.

## 11. Kryteria sukcesu tego rozdziału

1. **Każdy moduł, dla którego to ma sens, wspiera udostępnianie** — bez pisania własnej tabeli.
2. **Jedna lista „udostępnione mi"** obejmuje wszystkie moduły.
3. **Dwie osoby edytujące ten sam rekord dostają wybór, nie ciche nadpisanie.**
4. **Odebranie dostępu działa natychmiast**, nie po odświeżeniu strony.
5. **Dodanie udostępniania do nowego modułu to kilka linijek deklaracji.**
