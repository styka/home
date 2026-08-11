import { getTestTrends } from "../contract";
import { technicalToLabel } from "@/lib/ai/humanize";
import { describeFrequency } from "@/lib/medicationSchedule";
import { prisma } from "@/platform/db/prisma";
import { MedicationSchedule } from "@/types";
import { clampLimit, asStr, ownerScope } from "@/lib/ai/readToolShared";
import type { AiReadToolHandler } from "@/platform/ai/contribution";

/**
 * 049: narzędzia ODCZYTU tego modułu — wkład do asystenta, składany z deklaracji.
 *
 * Wcześniej wszystkie 56 narzędzi mieszkało w jednym `switch (name)` w warstwie AI, która
 * importowała kontrakty szesnastu modułów. Treść jest ta sama; zmienia się właściciel.
 */
export const readToolsPrompt = [
  "- list_health_events: args { kind?, search?, limit? } → [{ id, kind, title, scheduledAt, status }]. Wizyty/badania (kind: \"VISIT\"|\"TEST\").",
  "- list_medications: args { search?, limit? } → [{ id, kind, name, dosage, frequency, active }]. Harmonogramy leków (kind \"MEDICATION\") i czynności pielęgnacyjnych (kind \"CARE\") z opisem cykliczności.",
  "- get_test_trends: args {} → [{ name, points:[{ date, value }] }]. Trendy wyników badań laboratoryjnych (zdrowie).",
].join("\n");

export const readTools: Record<string, AiReadToolHandler> = {
  list_health_events: async (args, userId) => {
      // Z-270: dane zdrowotne dostępne dla AI tylko po opt-in użytkownika.
      const hs = await prisma.healthSettings.findUnique({ where: { userId }, select: { aiOptIn: true } });
      if (!hs?.aiOptIn) {
        return [{ note: "Dostęp AI do danych zdrowotnych jest wyłączony. Włącz go w module Zdrowie → ustawienia, jeśli chcesz, by asystent z nich korzystał." }];
      }
      const kind = asStr(args.kind);
      const search = asStr(args.search);
      const events = await prisma.healthEvent.findMany({
        where: {
          ...(await ownerScope(userId)),
          ...(kind ? { kind } : {}),
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, kind: true, title: true, scheduledAt: true, status: true },
        orderBy: { scheduledAt: "desc" },
        take: clampLimit(args.limit),
      });
      return events.map((e) => ({
        id: e.id,
        kind: technicalToLabel(e.kind),
        title: e.title,
        scheduledAt: e.scheduledAt.toISOString(),
        status: technicalToLabel(e.status),
      }));
  },
  list_medications: async (args, userId) => {
      // Z-270: leki/pielęgnacja dostępne dla AI tylko po opt-in użytkownika.
      const hsMed = await prisma.healthSettings.findUnique({ where: { userId }, select: { aiOptIn: true } });
      if (!hsMed?.aiOptIn) {
        return [{ note: "Dostęp AI do danych zdrowotnych jest wyłączony. Włącz go w module Zdrowie → ustawienia, jeśli chcesz, by asystent z nich korzystał." }];
      }
      const search = asStr(args.search);
      const schedules = await prisma.medicationSchedule.findMany({
        where: {
          ...(await ownerScope(userId)),
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        orderBy: [{ active: "desc" }, { name: "asc" }],
        take: clampLimit(args.limit),
      });
      return schedules.map((s) => ({
        id: s.id,
        kind: s.kind,
        name: s.name,
        dosage: s.dosage,
        frequency: describeFrequency(s as unknown as MedicationSchedule),
        active: s.active,
      }));
  },
  get_test_trends: async (args, userId) => {
      return getTestTrends();
  },
};
