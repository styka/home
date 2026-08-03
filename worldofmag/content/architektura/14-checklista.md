# Checklista dla Claude Code

> Każdy punkt to **osobny przebieg spec-driven pipeline'u**. Uruchamiaj `/specify` z treścią punktu
> plus odsyłaczem do właściwego rozdziału tego dokumentu.
>
> Kolumna **„Blokuje"** mówi, których punktów nie wolno zacząć przed ukończeniem tego.

## Faza 0 — Siatka bezpieczeństwa

| # | Zadanie | Rozdział | Blokuje |
|---|---------|----------|---------|
| 1 | Klikacz ścieżki szczęśliwej dla 21/21 modułów | 13.F0 | **wszystko** |
| 2 | Generowany test izolacji najemcy z manifestu 545 akcji | 13.F0, 12.2 | **wszystko** |
| 3 | Bramka rozjazdu `schema.prisma` ↔ migracje | 13.F0 | 12 |

## Faza 1 — Granice modułów

| # | Zadanie | Rozdział | Blokuje |
|---|---------|----------|---------|
| 4 | `src/platform/` — przeniesienie wspólnych zdolności | 7.1 | 5 |
| 5 | `src/modules/<x>/` — moduł po module, od najmniej sprzężonych | 7.1 | 6 |
| 6 | `contract.ts` + reguła ESLint blokująca import przez granicę | 7.2 R1, 9.2 | 7 |
| 7 | `defineModule` + wyprowadzenie rejestru, uprawnień, nawigacji, pulpitu, kalendarza | 9.3 | 8, 12 |
| 8 | Migracja asystenta AI na katalog składany z deklaracji | 9.6 | — |

## Faza 2 — Współdzielenie i współbieżność

| # | Zadanie | Rozdział | Blokuje |
|---|---------|----------|---------|
| 9 | Modele `Workspace`, `WorkspaceMember`, `ResourceGrant`, `ResourceInvitation` | 8.3 | 10 |
| 10 | `platform/sharing` — `requireAccess`, dziedziczenie, cache per żądanie | 8.9 | 11, 13 |
| 11 | Migracja `ownerId`/`ownerTeamId` → `workspaceId` na 46 modelach (4 kroki!) | 8.10 | 12, 13 |
| 12 | Migracja `TaskProjectMember`/`TaskShare`/`PetShare` → `ResourceGrant` | 8.10 | 13 |
| 13 | Deklaracje `resources` w `module.ts` wszystkich modułów | 8.4, 9.3 | 14 |
| 14 | `ShareDialog`, „Udostępnione mi", „Co udostępniłem", zaproszenia | 8.7, 10.4 | — |
| 15 | Kolumna `version` + wzorzec `updateMany` z warunkiem na wersji | 8.5 | 16 |
| 16 | `ConflictDialog` — wybór zamiast cichego nadpisania | 8.5.2, 10.4 | — |
| 17 | Test odwołania dostępu (natychmiastowość, także przy aktywnym SSE) | 12.2 | — |
| 18 | Test kontraktowy: read-toole AI przechodzą przez `requireAccess` | 12.2.1 | — |

## Faza 3 — Domena i paginacja

| # | Zadanie | Rozdział | Blokuje |
|---|---------|----------|---------|
| 19 | `domain/` w każdym module + testy bez bazy | 10.1 | — |
| 20 | Paginacja kursorowa we wszystkich widokach listowych | 11.4 | — |

## Faza 4 — Zdarzenia i koniec odpytywania

| # | Zadanie | Rozdział | Blokuje |
|---|---------|----------|---------|
| 21 | `DomainEvent` + zapis w tej samej transakcji co mutacja | 9.4 | 22 |
| 22 | Publikacja przez worker (`LISTEN/NOTIFY` albo Redis Pub/Sub) | 9.4.3 | 23 |
| 23 | SSE `/api/events` z kanałami przestrzeń / zasób / użytkownik | 11.1 | 24, 25 |
| 24 | Usunięcie `setInterval` z `DataFreshness` + degradacja do 5 min | 11.1.4 | — |
| 25 | Subskrypcje międzymodułowe (Zakupy→Portfel, Magazyn→Zakupy) | 9.5 | — |

## Faza 5 — Skala i koszt

| # | Zadanie | Rozdział | Blokuje |
|---|---------|----------|---------|
| 26 | Współdzielony rate-limit (ten sam interfejs) + test dwuprocesowy | 11.2 | — |
| 27 | Budżety AI: per użytkownik, globalny wyłącznik, alarmy progowe | 11.3 | — |
| 28 | Pula połączeń, audyt N+1, indeksy `workspaceId` i `ResourceGrant` | 11.4 | — |
| 29 | Cache agregatów i rozstrzygnięć dostępu, unieważniany zdarzeniami | 11.5 | — |
| 30 | Retencja danych, konfigurowalna w `/admin/config` | 11.6 | — |

## Faza 6 — Obserwowalność i procesy

| # | Zadanie | Rozdział | Blokuje |
|---|---------|----------|---------|
| 31 | Logi strukturalne (bez PII) | 11.7 | 32 |
| 32 | Metryki na `/admin/health`, w tym konflikty edycji per moduł | 11.7 | — |
| 33 | Rozdzielenie procesów `web` / `worker` / `cron` | 11.8 | — |

## Faza 7 — Wielojęzyczność

| # | Zadanie | Rozdział | Blokuje |
|---|---------|----------|---------|
| 34 | `next-intl` + infrastruktura tłumaczeń | 12.1 | 35 |
| 35 | Wyciągnięcie tekstów modułami do `messages/pl.json` | 12.1 | 36 |
| 36 | **Zmiana `C-32` w konstytucji** | 12.1.2 | — |
| 37 | Formatowanie `Intl` + język i strefa w ustawieniach przestrzeni | 12.1 | — |
| 38 | Język przestrzeni w kontekście promptów AI | 12.1.3 | — |

## Faza 8 — Gotowość produkcyjna

| # | Zadanie | Rozdział | Blokuje |
|---|---------|----------|---------|
| 39 | Eksport danych użytkownika | 12.3 | — |
| 40 | Usunięcie konta z decyzją o zasobach zespołowych | 12.3 | — |
| 41 | Przeprowadzona próba odtworzenia z kopii + runbook | 12.5 | — |
| 42 | Stany błędów i puste w każdym module | 10.4 | — |
| 43 | Budżet wydajnościowy w CI | 13.F8 | — |

## Faza 9 — Domknięcie

| # | Zadanie | Rozdział |
|---|---------|----------|
| 44 | Aktualizacja `CLAUDE.md` i konstytucji do nowej struktury | 13.F9 |
| 45 | Aktualizacja `/admin/architecture` i tego dokumentu | 13.F9 |
| 46 | Wersja **Omnia 🧐** — wpis w historii wersji | 13.F9 |

---

## Trzy rzeczy do zapamiętania

1. **Punkty 1–3 są bezwarunkowo pierwsze.** Refaktor bez siatki bezpieczeństwa to nie refaktor,
   tylko przepisywanie z nadzieją.
2. **Punkt 11 jest najgroźniejszy w całej przebudowie** — migracja `workspaceId` na 46 modelach.
   Cztery kroki, nigdy jeden. Próba odtworzenia kopii **przed** rozpoczęciem.
3. **Punkt 6 (reguła ESLint) nie jest opcjonalny.** Granice bez egzekwowania erodują w tygodnie —
   to najczęstszy sposób, w jaki takie przebudowy się marnują.

---

## Weryfikacja końcowa — pytania kontrolne

Po ukończeniu wszystkich faz odpowiedz na te pytania **kodem, nie deklaracją**:

- [ ] Ile miejsc trzeba dotknąć, żeby dodać moduł? *(cel: 1)*
- [ ] Czy da się udostępnić notatkę, listę zakupów i przepis? *(cel: tak, tym samym oknem)*
- [ ] Ile zapytań do bazy generuje bezczynna karta w ciągu 5 minut? *(cel: 0)*
- [ ] Po ilu sekundach współpracownik widzi moją zmianę na wspólnej liście? *(cel: < 2)*
- [ ] Co się stanie, gdy dwie osoby zapiszą to samo zadanie? *(cel: wybór, nie ciche nadpisanie)*
- [ ] Czy użytkownik z rolą `viewer` może zmienić zadanie **przez asystenta AI**? *(cel: nie)*
- [ ] Czy odebranie dostępu działa natychmiast przy otwartej karcie? *(cel: tak)*
- [ ] Ile trwa dodanie języka angielskiego? *(cel: praca tłumacza, nie programisty)*
