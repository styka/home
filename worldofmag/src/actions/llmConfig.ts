"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  OPERATION_TYPES,
  OPERATION_TYPE_META,
  isOperationType,
  type OperationType,
} from "@/lib/llm/operationTypes";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto/secrets";

async function requireAdmin() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
}

export interface ProviderDTO {
  id: string;
  label: string;
  kind: string;
  baseUrl: string;
  apiKeyMasked: string;
  hasKey: boolean;
  enabled: boolean;
}

export interface AssignmentDTO {
  operationType: OperationType;
  label: string;
  description: string;
  defaultModel: string;
  providerId: string | null;
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
}

export async function getLlmProviders(): Promise<ProviderDTO[]> {
  await requireAdmin();
  const rows = await prisma.llmProvider.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((p) => ({
    id: p.id,
    label: p.label,
    kind: p.kind,
    baseUrl: p.baseUrl,
    // A2: deszyfruj tylko po to, by pokazać maskę (4 ostatnie znaki realnego klucza).
    apiKeyMasked: maskSecret(decryptSecret(p.apiKey)),
    hasKey: Boolean(p.apiKey),
    enabled: p.enabled,
  }));
}

export async function createProvider(data: {
  label: string;
  kind: string;
  baseUrl: string;
  apiKey: string;
}): Promise<void> {
  await requireAdmin();
  const label = data.label.trim();
  const baseUrl = data.baseUrl.trim().replace(/\/+$/, "");
  const kind = data.kind === "anthropic" ? "anthropic" : "openai_compat";
  if (!label || !baseUrl) throw new Error("Nazwa i adres bazowy są wymagane");
  await prisma.llmProvider.create({
    data: { label, kind, baseUrl, apiKey: encryptSecret(data.apiKey.trim()), enabled: true },
  });
  revalidatePath("/admin/llm");
}

export async function updateProvider(
  id: string,
  data: { label?: string; kind?: string; baseUrl?: string; apiKey?: string; enabled?: boolean }
): Promise<void> {
  await requireAdmin();
  const patch: Record<string, unknown> = {};
  if (data.label !== undefined) patch.label = data.label.trim();
  if (data.baseUrl !== undefined) patch.baseUrl = data.baseUrl.trim().replace(/\/+$/, "");
  if (data.kind !== undefined) patch.kind = data.kind === "anthropic" ? "anthropic" : "openai_compat";
  if (data.enabled !== undefined) patch.enabled = data.enabled;
  // Pusty klucz = nie nadpisuj (pozwala edytować inne pola bez ujawniania klucza).
  if (data.apiKey !== undefined && data.apiKey.trim()) patch.apiKey = encryptSecret(data.apiKey.trim());
  await prisma.llmProvider.update({ where: { id }, data: patch });
  revalidatePath("/admin/llm");
}

export async function deleteProvider(id: string): Promise<void> {
  await requireAdmin();
  const usedBy = await prisma.llmAssignment.count({ where: { providerId: id } });
  if (usedBy > 0) {
    throw new Error("Nie można usunąć — dostawca jest przypisany do typu operacji. Najpierw zmień przypisania.");
  }
  await prisma.llmProvider.delete({ where: { id } });
  revalidatePath("/admin/llm");
}

export async function getAssignments(): Promise<AssignmentDTO[]> {
  await requireAdmin();
  const rows = await prisma.llmAssignment.findMany();
  const byType = new Map(rows.map((r) => [r.operationType, r]));
  return OPERATION_TYPES.map((op) => {
    const meta = OPERATION_TYPE_META[op];
    const a = byType.get(op);
    return {
      operationType: op,
      label: meta.label,
      description: meta.description,
      defaultModel: meta.defaultModel,
      providerId: a?.providerId ?? null,
      model: a?.model ?? null,
      temperature: a?.temperature ?? null,
      maxTokens: a?.maxTokens ?? null,
    };
  });
}

export async function setAssignment(data: {
  operationType: string;
  providerId: string;
  model: string;
  temperature?: number | null;
  maxTokens?: number | null;
}): Promise<void> {
  await requireAdmin();
  if (!isOperationType(data.operationType)) throw new Error("Nieznany typ operacji");
  const model = data.model.trim();
  if (!data.providerId || !model) throw new Error("Wybierz dostawcę i podaj model");
  await prisma.llmAssignment.upsert({
    where: { operationType: data.operationType },
    update: {
      providerId: data.providerId,
      model,
      temperature: data.temperature ?? null,
      maxTokens: data.maxTokens ?? null,
    },
    create: {
      operationType: data.operationType,
      providerId: data.providerId,
      model,
      temperature: data.temperature ?? null,
      maxTokens: data.maxTokens ?? null,
    },
  });
  revalidatePath("/admin/llm");
}
