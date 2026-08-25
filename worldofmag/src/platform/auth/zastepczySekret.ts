/**
 * 101 (AC-10) — wartość zastępcza sekretu podpisującego sesje, w osobnym pliku **bez żadnych
 * zależności**.
 *
 * Dlaczego nie zostaje w `session.ts`: czyta ją strażnik w `src/instrumentation.ts`, a ten plik jest
 * pakowany **także dla środowiska brzegowego**. Import `session.ts` wciągnąłby tam NextAuth i Prismę
 * — dokładnie ta droga wywracała już build (notatka Z-131 w `instrumentation.ts`). Stała bez importów
 * jest bezpieczna wszędzie, a literał zostaje w jednym miejscu, więc strażnik nie może się rozjechać
 * z wartością, którą porównuje.
 */
export const ZASTEPCZY_SEKRET_SESJI = "build-time-placeholder-set-real-value-on-render";
