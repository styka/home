-- H1: personalizacja pulpitu (kolejnosc + ukrywanie sekcji strony glownej, per-user).
CREATE TABLE "DashboardPref" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "order" TEXT NOT NULL DEFAULT '[]',
    "hidden" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DashboardPref_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DashboardPref_userId_key" ON "DashboardPref"("userId");
ALTER TABLE "DashboardPref" ADD CONSTRAINT "DashboardPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
