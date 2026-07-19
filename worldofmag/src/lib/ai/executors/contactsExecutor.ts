// 011-ai-full-action-coverage: handler akcji asystenta dla modułu Kontakty (CRM).
// Kontakty były dotąd niewidoczne dla asystenta (brak akcji i narzędzia odczytu).
import { getContacts, createContact, updateContact, deleteContact } from "@/actions/contacts";
import { asStr, undoAction, type ExecOutcome } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";

// Namierz kontakt po nazwie/telefonie/mailu (getContacts zawęża do zakresu użytkownika).
async function resolveContactId(params: Record<string, unknown>, searchQuery?: string): Promise<{ id: string; name: string }> {
  const id = asStr(params.contactId);
  const q = searchQuery ?? asStr(params.name) ?? "";
  const rows = await getContacts(id ? undefined : q);
  const found = id ? rows.find((c) => c.id === id) : rows[0];
  if (!found) throw new Error(`Nie znaleziono kontaktu: "${q}"`);
  return { id: found.id, name: found.name };
}

function parseTags(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map((t) => asStr(t)).filter((t): t is string => !!t);
  const s = asStr(v);
  return s ? s.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
}

export async function executeContactsAction(action: AIAction, _userId: string): Promise<string | ExecOutcome> {
  const { type, params, searchQuery } = action;

  if (type === "create_contact") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj imię/nazwę kontaktu");
    await createContact({
      name,
      phone: asStr(params.phone) ?? null,
      email: asStr(params.email) ?? null,
      company: asStr(params.company) ?? null,
      tags: parseTags(params.tags),
      notes: asStr(params.notes) ?? null,
    });
    return `Dodano kontakt „${name}"`;
  }

  if (type === "update_contact") {
    const { id, name } = await resolveContactId(params, searchQuery);
    const patch: Parameters<typeof updateContact>[1] = {};
    if (params.name !== undefined) patch.name = String(params.name);
    if (params.phone !== undefined) patch.phone = asStr(params.phone) ?? null;
    if (params.email !== undefined) patch.email = asStr(params.email) ?? null;
    if (params.company !== undefined) patch.company = asStr(params.company) ?? null;
    if (params.notes !== undefined) patch.notes = asStr(params.notes) ?? null;
    if (params.tags !== undefined) patch.tags = parseTags(params.tags) ?? [];
    await updateContact(id, patch);
    return `Zaktualizowano kontakt „${name}"`;
  }

  if (type === "delete_contact") {
    const { id, name } = await resolveContactId(params, searchQuery);
    await deleteContact(id);
    return { message: `Usunięto kontakt „${name}"`, undo: undoAction("contacts", "create_contact", { name }, `Przywróć kontakt „${name}"`) };
  }

  throw new Error(`Nieznany typ akcji kontaktów: ${type}`);
}
