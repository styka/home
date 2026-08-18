-- 094 (zadanie 46; rozdz. 13.F9) — HISTORIA WERSJI: wpis „Omnia 🧐".
--
-- Zadanie 46 brzmi „wpis w historii wersji". Historii wersji w tym repozytorium **nie było** — nie ma
-- pliku CHANGELOG i nigdy nie było. Zakładanie go teraz oznaczałoby siódme miejsce, w którym trzeba
-- pamiętać o aktualizacji, i to takie, którego użytkownik nigdy nie zobaczy.
--
-- Powierzchnią, którą ta aplikacja MA na dokumenty dla człowieka, są raporty (`/reports`) —
-- seedowane idempotentnymi migracjami SQL, dokładnie tą konwencją, którą opisuje CLAUDE.md. Historia
-- wersji jest więc raportem: widoczna tam, gdzie użytkownik już czyta o systemie, i wersjonowana razem
-- z kodem, bo migracja jest częścią kodu.
--
-- Kolejny wpis dopisuje się jako NOWĄ sekcję w nowej migracji (`UPDATE … SET content = …`), nie przez
-- edycję tej — migracja już zastosowana nie zmienia się nigdy.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "storage", "authorId", "teamId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — historia wersji',
  'omnia-historia-wersji',
  $raport$# Omnia — historia wersji

> Ten dokument opisuje **wersje systemu**, a nie listę zmian w kodzie. Wersja to moment, w którym
> zmienia się to, na czym system stoi — a nie każdy dodany przycisk. Szczegóły techniczne każdego
> przebiegu są w dzienniku przebudowy (`/admin/architektura-docelowa`, rozdział 15).

---

## Omnia 🧐 — przebudowa do architektury docelowej

**Co się zmieniło w jednym zdaniu:** aplikacja przestała być jednym dużym programem z modułami
w środku, a stała się **platformą z modułami**, w której granice są pilnowane przez build, a nie
przez pamięć.

### Trzy rzeczy, które zmieniły się najbardziej

**1. Zasób należy do PRZESTRZENI, nie do konta.** Wcześniej każdy rekord miał dwie kolumny
własnościowe (`ownerId`, `ownerTeamId`) i każde zapytanie musiało obsłużyć oba przypadki. Dziś jest
jedna: przestrzeń. Kolumny własnościowe zniknęły z 40 tabel. Dzięki temu udostępnienie czegokolwiek
komukolwiek jest jednym mechanizmem, a nie pięcioma — i dlatego pytanie „co mi udostępniono?" da się
zadać jednym zapytaniem do jednej tabeli.

**2. Moduł deklaruje się sam.** Dodanie modułu to jeden katalog i jeden import w korzeniu
kompozycji. Wcześniej wymagało edycji ośmiu list w cudzych plikach: rejestru, uprawnień, nawigacji,
katalogu akcji asystenta, rejestru zadań w tle, agregatu kalendarza, migawki pulpitu. Każda z tych
list była miejscem, w którym dało się o czymś zapomnieć — i nikt by tego nie zauważył, bo build
świecił na zielono.

**3. Reguły są egzekwowane, nie zapisane.** Build ma ponad dwadzieścia bramek, które psują się, gdy
ktoś obejdzie zasadę: import przez granicę modułu, akcja asystenta bez kontroli dostępu, model bez
migracji, nowy tekst zaszyty w komponencie, nowe zapytanie zwracające wszystko, log poza warstwą
strukturalną. Kilka z nich pilnuje **długu, który nie może rosnąć** — i pada także wtedy, gdy dług
maleje, bo poprawę trzeba zapisać, inaczej zapas ukryje następny regres.

### Co użytkownik zobaczy

| Zmiana | Gdzie |
|---|---|
| Udostępnianie czegokolwiek: osobie, zespołowi albo linkiem, z rolą i terminem | przycisk „Udostępnij" przy zasobie, lista na `/udostepnione` |
| „Wykorzystano X z Y" dla asystenta AI — limit widoczny, zanim odmówi | `/settings` |
| Język i strefa czasowa **przestrzeni**, nie konta | `/settings` |
| Zgłaszanie konfliktu, gdy dwie osoby edytują to samo — z wyborem, co zrobić | okno konfliktu przy zapisie |
| Retencja danych: co i po jakim czasie znika | `/admin/config` |
| Metryki: czas operacji (percentyl 95), błędy i **konflikty edycji** per moduł | `/admin/health` |
| Budżet AI: wyłącznik awaryjny, kwota miesięczna, alarmy 50/80/100 % | `/admin/llm` |

### Czego świadomie NIE zrobiliśmy

- **Tłumaczeń na inne języki.** Zrobiliśmy możliwość ich dodania bez programisty; samo tłumaczenie
  jest pracą tłumacza i osobną decyzją.
- **Cache'u rozstrzygnięć dostępu.** Bez natychmiastowego unieważniania byłby dziurą w kontroli
  dostępu wprowadzoną przez optymalizację. Warunek (zdarzenia o nadaniach) jest już spełniony, sam
  cache pozostaje decyzją.
- **Współredagowania w czasie rzeczywistym.** Zamiast zgadywać, czy jest potrzebne, mierzymy
  konflikty edycji per moduł. Decyzja poczeka na dane.
$raport$,
  'system',
  'db',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
