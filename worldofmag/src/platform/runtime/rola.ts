/**
 * 088 (zadanie 33, Faza 6) — ROLA PROCESU.
 *
 * Rozdz. 11.8 dzieli aplikację na trzy procesy: `web` (żądania i SSE, skalowany poziomo),
 * `worker` (zadania w tle i publikacja outboxu, 1–2 instancje) i `cron` (retencja, przypomnienia,
 * kursy walut, 1 instancja). Powód jest jeden i konkretny: **ciężkie zadania AI przestają
 * konkurować o CPU z obsługą żądań użytkownika**.
 *
 * **Jeden obraz, trzy role.** Nie ma osobnych bundli ani osobnych punktów wejścia — to ta sama
 * aplikacja uruchomiona z inną wartością `OMNIA_ROLE`. Osobny build dla workera znaczyłby drugi
 * artefakt do wdrażania i pierwszą okazję, żeby oba rozjechały się wersją.
 *
 * **Domyślną rolą jest `all`** i to jest decyzja, nie niedbałość: dzisiejsze wdrożenie to jedna
 * usługa Rendera, która robi wszystko. Gdyby domyślną wartością było `web`, samo wdrożenie tej
 * zmiany zatrzymałoby kolejkę i retencję — bez błędu, bez logu, po prostu nic by się nie działo.
 * Rozdzielenie jest więc **włączane świadomie**, przez ustawienie zmiennej w każdej z usług.
 *
 * Zgodność wsteczna: `JOBS_WORKER_DISABLED=1` (Z-131) działa dalej i znaczy dokładnie to samo, co
 * rola `web` — jest starszy od tej zmiany i mógł zostać ustawiony na produkcji.
 */
export type RolaProcesu = "web" | "worker" | "cron" | "all";

const ROLE: RolaProcesu[] = ["web", "worker", "cron", "all"];

/**
 * Rola tego procesu. Wartość nieznana → `all` **i ostrzeżenie**: literówka w nazwie roli
 * („workers", „Worker") nie może po cichu wyłączyć przetwarzania. Zawsze wybieramy wariant, który
 * coś robi, i mówimy o tym w logu.
 */
export function rolaProcesu(): RolaProcesu {
  const raw = (process.env.OMNIA_ROLE ?? "").trim().toLowerCase();
  if (!raw) return "all";
  if ((ROLE as string[]).includes(raw)) return raw as RolaProcesu;
  return "all";
}

/** `true`, gdy wartość `OMNIA_ROLE` jest ustawiona i nierozpoznana — wołający ma to zgłosić. */
export function rolaNierozpoznana(): boolean {
  const raw = (process.env.OMNIA_ROLE ?? "").trim().toLowerCase();
  return raw.length > 0 && !(ROLE as string[]).includes(raw);
}

/** Czy ten proces ma pobierać zadania z kolejki i publikować outbox. */
export function czyPrzetwarzaZadania(): boolean {
  if (process.env.JOBS_WORKER_DISABLED === "1") return false;
  const r = rolaProcesu();
  return r === "worker" || r === "all";
}

/**
 * Czy ten proces ma wykonywać zadania okresowe (sprzątanie kolejki i limitera, retencja).
 *
 * Osobno od przetwarzania zadań, bo to inne wymaganie skalowania: workerów mogą być dwa, a procesów
 * `cron` **jeden**. Praca okresowa i tak odbiera sobie prawo do przebiegu atomowo (083), więc dwa
 * procesy jej nie zdublują — ale wykonywanie retencji w każdej instancji `web` to zbędne obciążenie
 * bazy przy każdym tyknięciu.
 */
export function czyWykonujeOkresowe(): boolean {
  const r = rolaProcesu();
  return r === "cron" || r === "all";
}
