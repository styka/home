# Rozdzielenie procesów: `web` / `worker` / `cron`

> 088 (zadanie 33, Faza 6). Rozdz. 11.8 architektury docelowej.

## Po co

Ciężkie zadania (OCR, plan tygodnia, odświeżanie wiadomości, generowanie skórek) konkurują dziś
o CPU z obsługą żądań użytkownika, bo chodzą **w tym samym procesie**. Rozdzielenie jest tanie, bo
kolejka już to udźwignie: `claimNext` używa `FOR UPDATE SKIP LOCKED`, więc dwa procesy nie wezmą
tego samego zadania.

## Jak to działa

**Jeden obraz, trzy role.** Nie ma osobnego builda ani osobnego punktu wejścia — to ta sama
aplikacja uruchomiona z inną wartością `OMNIA_ROLE`. Osobny artefakt dla workera znaczyłby drugi
element do wdrażania i pierwszą okazję, żeby oba rozjechały się wersją.

| `OMNIA_ROLE` | Pętla zadań + outbox | Praca okresowa | Ile instancji |
|---|---|---|---|
| `web` | nie | nie | poziomo, ile trzeba |
| `worker` | **tak** | nie | 1–2 |
| `cron` | nie | **tak** | 1 |
| `all` (domyślna) | tak | tak | 1 |

**Domyślną rolą jest `all`** — dzisiejsze wdrożenie to jedna usługa Rendera, która robi wszystko.
Gdyby domyślną wartością było `web`, samo wdrożenie tej zmiany zatrzymałoby kolejkę i retencję: bez
błędu, bez logu, po prostu nic by się nie działo. **Rozdzielenie włącza się świadomie**, ustawiając
zmienną w każdej z usług.

Wartość nierozpoznana (literówka: `workers`, `Worker `) → rola `all` **plus ostrzeżenie w logu**
(`runtime.rola.nierozpoznana`). Nigdy cisza.

Stara flaga `JOBS_WORKER_DISABLED=1` (Z-131) działa dalej i znaczy to samo, co rola `web`.

## Konfiguracja na Renderze

Trzy usługi z **tego samego repozytorium i tej samej gałęzi**, różniące się wyłącznie zmiennymi:

| Usługa | `OMNIA_ROLE` | Uwagi |
|---|---|---|
| `omnia-prod` (istniejąca) | `web` | ruch użytkowników i SSE |
| `omnia-worker` | `worker` | plan płatny — proces musi żyć między żądaniami |
| `omnia-cron` | `cron` | plan płatny, **jedna** instancja |

Wszystkie trzy dostają ten sam `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` i klucze API.
**Obniż `DATABASE_POOL_LIMIT`** przy zwiększaniu liczby usług — limit jest per instancja
(patrz `pula-polaczen-i-nplus1.md`).

### Jak procesy w tle w ogóle startują

Worker uruchamia się leniwie z tras API działających w runtime Node — **nie** z
`instrumentation.ts`, które jest bundlowane także dla runtime EDGE, a łańcuch workera używa modułów
node-only (Z-131). Instancja bez ruchu użytkownika nie wykona jednak żadnej trasy, więc worker
budzi się na **`/api/health`**: to jedyne żądanie, które platforma hostingowa wysyła sama
i regularnie (health check). Wywołanie jest idempotentne.

**Konsekwencja praktyczna: usługa `worker` musi mieć włączoną kontrolę zdrowia na `/api/health`.**
Bez niej proces wstanie i nie zrobi nic.

Odpowiedź `/api/health` zawiera pole `role` — przy trzech usługach z jednego obrazu to jedyny
sposób, żeby sprawdzić, czy każda dostała tę, którą miała dostać.

### Zadania okresowe

Rola `cron` wykonuje: sprzątanie kolejki, sprzątanie limitera i **retencję danych** (zadanie 30).
Prawo do przebiegu retencji jest odbierane atomowo (warunkowy `UPDATE` na wierszu w `Config`), więc
przypadkowe dwie instancje `cron` niczego nie zdublują — ale nie jest to powód, żeby je uruchamiać.

Osobno istnieje **wyzwalana z zewnątrz** trasa `/api/cron/retention` (Z-059, czyszczenie kosza),
autoryzowana `CRON_SECRET`. Zostaje: darmowy plan usypia usługę, więc zewnętrzny wyzwalacz jest
jedyną pewną drogą na środowisku testowym.

## Czego to NIE rozwiązuje

**SSE nadal żyje w jednym procesie.** Karta trzyma strumień na konkretnej instancji `web`;
zdarzenie opublikowane przez inną do niej nie dotrze (rozdz. 11.9). Przy skalowaniu `web` poziomo
potrzebny jest `LISTEN/NOTIFY` albo Redis Pub/Sub — decyzja świadomie odłożona (072), a siatką
pozostaje pięciominutowe odpytywanie awaryjne w `DataFreshness`.
