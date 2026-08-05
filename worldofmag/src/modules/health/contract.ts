/**
 * Kontrakt modułu **Zdrowie** (wizyty, repozytorium badań, leki i pielęgnacja).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/health/*` poza `contract`.
 *
 * Konsumenci:
 * - **pulpit** (`app/page.tsx`) → `getHealthEvents`,
 * - **narzędzia odczytu asystenta** → `getTestTrends` (trendy wyników badań),
 * - **egzekutor akcji asystenta** → wizyty oraz harmonogramy leków i pielęgnacji.
 *
 * Dwie rzeczy o nazwie sugerującej ten moduł **do niego nie należą** i celowo zostały poza nim:
 * - `lib/medicationSchedule.ts` — czysta mechanika dat, z której korzysta **agregat kalendarza**
 *   i narzędzia asystenta. Wciągnięcie jej tutaj zmusiłoby kalendarz (jeszcze nie moduł) do
 *   importu kontraktu Zdrowia dla funkcji, która nie dotyka bazy.
 * - `lib/health/queryDiag.ts` — mimo nazwy to diagnostyka zapytań do bazy, używana przez
 *   `actions/systemHealth` w panelu admina. Nazwa jest myląca; jej poprawienie to zmiana
 *   zachowania, więc nie wchodzi do commita przenoszącego.
 *
 * Załączniki badań (PDF/obrazy) i zgoda na analizę AI zostają prywatne — to sprawa własnego widoku.
 */

export {
  // wizyty i badania
  getHealthEvents,
  getTestTrends,
  createHealthEvent,
  updateHealthEvent,
  setHealthStatus,
  deleteHealthEvent,
} from "./actions/health";

export {
  // leki i pielęgnacja
  getMedicationDay,
  createMedicationSchedule,
  updateMedicationSchedule,
  deleteMedicationSchedule,
  logDose,
  unlogDose,
} from "./actions/medications";
