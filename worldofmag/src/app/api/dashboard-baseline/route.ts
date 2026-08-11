import { NextResponse } from "next/server";
import { prisma } from "@/platform/db/prisma";
import { collectDashboardSnapshotLegacy } from "@/lib/dashboardLegacy";

/**
 * 050/T-3 — TRASA TYMCZASOWA, kasowana w fazie domknięcia (T-12b).
 *
 * Istnieje po to, żeby zrzucić migawkę pulpitu **w kontekście żądania**. Skrypt tego nie potrafi:
 * siedem z jedenastu bloków woła kontrakty modułów, a te są Server Actions wywodzącymi użytkownika
 * z sesji — poza żądaniem rzucają „headers was called outside a request scope", a `try/catch`
 * zamienia to na zera. Zrzut z zerami zgadza się z zerami po przebudowie, więc niczego nie dowodzi.
 *
 * Dostępna wyłącznie przy `E2E_TEST_MODE=1` (tryb offline, nigdy na produkcji). Użytkownika
 * wskazuje `?email=`, bo sesja bazodanowa bywa nieaktualna po przesianiu bazy, a nam potrzebny jest
 * konkretny użytkownik z fixture'a. `?brak=1` zwraca migawkę dla użytkownika BEZ uprawnień —
 * materiał do AC-5.
 */
export async function GET(req: Request) {
  if (process.env.E2E_TEST_MODE !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Podaj ?email=" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Nie ma takiego użytkownika" }, { status: 404 });

  const WSZYSTKIE = [
    "module.shopping", "module.tasks", "module.notes", "module.kitchen", "module.pets",
    "module.flota", "module.portfel", "module.languages", "module.health", "module.magazynowanie",
  ];
  const permissions = url.searchParams.has("brak") ? [] : WSZYSTKIE;
  const snapshot = await collectDashboardSnapshotLegacy(user.id, permissions, false);
  return NextResponse.json(snapshot);
}
