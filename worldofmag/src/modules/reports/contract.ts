/**
 * Kontrakt modułu **Raporty** (dokumenty markdown: systemowe, użytkownika, zespołowe).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/reports/*` poza `contract`.
 *
 * Raporty mają **najwięcej zewnętrznych konsumentów** ze wszystkich modułów pilotażowych i to
 * właśnie sprawdza, czy kontrakt unosi realne współdzielenie:
 *
 * | Konsument | Czego potrzebuje |
 * |---|---|
 * | `app/admin/reports/*` (panel admina) | `getReportsMeta`, `getReport`, `createReport`, `updateReport`, `deleteReport` |
 * | `components/home/AICommandSheet` | `createUserReport` (asystent proponuje raport z sesji) |
 * | `lib/ai/executors/reportExecutor` | `createUserReport` |
 * | `lib/ai/agentTools` | `searchReports` (narzędzie odczytu asystenta) |
 * | trasa `app/reports/*` | `getUserReportsMeta`, `getUserReport` |
 *
 * Podział na `getReport*` i `getUserReport*` **nie jest** dublowaniem: pierwsze wymaga admina
 * i widzi wszystko, drugie działa w zakresie użytkownika. Kontrakt musi wystawiać oba, bo
 * obsługuje dwie różne powierzchnie — administracyjną i użytkownika.
 *
 * Widok (`ui/ReportsHomePage`) celowo **nie** przechodzi przez kontrakt: to komponent kliencki
 * konsumowany wyłącznie przez własną trasę modułu, a przepuszczanie `"use client"` przez plik
 * importowany po stronie serwera tylko rozmywałoby granicę. Kontrakt opisuje dane, nie ekrany.
 */

export {
  getReportsMeta,
  getUserReportsMeta,
  searchReports,
  getReport,
  getUserReport,
  createReport,
  createUserReport,
  updateReport,
  deleteReport,
} from "./actions/reports";

export type { ReportMeta, ReportStorage } from "./actions/reports";
