import { PrismaClient } from "@prisma/client";
import { ustalPule } from "./pula";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * 084 (zadanie 28, Faza 5) — LICZENIE ZAPYTAŃ NA ŻĄDANIE.
 *
 * `OMNIA_QUERY_LOG=1` włącza zdarzeniowy log zapytań, na którym stoi pomiar N+1
 * (`src/platform/db/__tests__/nplusjeden.integration.test.ts`). Nie jest to opcja produkcyjna:
 * zmienną ustawia wyłącznie test, a bez niej klient zachowuje się dokładnie jak przedtem.
 *
 * Dlaczego to musi być tutaj, a nie w teście: `$on("query")` działa tylko wtedy, gdy klient został
 * ZBUDOWANY z `emit: "event"`, a klient jest singletonem — test nie ma jak go przebudować.
 * Wariant z `$use` wyglądał prościej, ale middleware'u nie da się odpiąć, więc pomiar zostawałby
 * w procesie na zawsze.
 */
const liczZapytania = process.env.OMNIA_QUERY_LOG === "1";

/**
 * 084 (zadanie 28): jawny `connection_limit`. Domyślna wartość Prismy zależy od liczby rdzeni
 * instancji, więc zmienia się po każdej zmianie planu hostingu i nikt się o tym nie dowiaduje.
 * Szczegóły i powód, dla którego NIE dopisujemy `pgbouncer=true` — w `pula.ts`.
 */
export const PULA = ustalPule(process.env.DATABASE_URL, process.env.DATABASE_POOL_LIMIT);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: PULA.url ? { db: { url: PULA.url } } : undefined,
    log: liczZapytania
      ? [{ level: "query", emit: "event" }, "error", "warn"]
      : process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
