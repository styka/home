// 039: składanie wiedzy o użytkowniku w blok tekstu doklejany do promptów.
//
// Osobno od `lib/userFacts.ts` (typy i etykiety, importowane też przez komponenty klienckie) i od
// `actions/userFacts.ts` (akcje użytkownika), bo to jedyne miejsce, które sięga do bazy w imieniu
// INNEGO modułu — bez sesji, po `userId`.

import { prisma } from "@/platform/db/prisma";
import { USER_FACT_CATEGORY_LABELS, USER_FACT_CONFIDENCE_LABELS, parseUserFactCategory, parseUserFactConfidence } from "@/lib/userFacts";
import { filtrMoichRekordow } from "@/platform/workspaces/zapis";

/** Ile faktów maksymalnie doklejamy — prompt ma być kontekstem, nie życiorysem. */
const MAX_FACTS = 20;
/** Ile odrzuconych wymieniamy jako „tego o mnie nie zakładaj". */
const MAX_REJECTED = 8;

/**
 * Buduje blok „O UŻYTKOWNIKU" do wklejenia w prompt.
 *
 * Pewność trafia tam jako SŁOWO („przypuszczenie", „potwierdzone"), a nie liczba — model ma
 * traktować domysł ostrożniej niż fakt potwierdzony, a procenty i tak by dla niego nic nie znaczyły.
 *
 * Odrzucone fakty wymieniamy osobno: bez tego wnioskowanie i prompty wracałyby do tego samego
 * błędnego założenia, mimo że użytkownik już powiedział „nie o mnie".
 *
 * Brak faktów → PUSTY STRING, nigdy błąd. To wołają moduły, którym wiedza o użytkowniku jest tylko
 * przyprawą — nowy użytkownik nie może przez nią stracić działającej funkcji.
 */
export async function buildUserContext(userId: string): Promise<string> {
  let rows;
  try {
    rows = await prisma.userFact.findMany({
      where: { ...(await filtrMoichRekordow(userId)) },
      orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      take: MAX_FACTS + MAX_REJECTED,
      select: { category: true, text: true, confidence: true, status: true },
    });
  } catch {
    // Wiedza o użytkowniku jest dodatkiem — jej awaria nie może wywalić generowania treści.
    return "";
  }

  const active = rows.filter((r) => r.status === "active").slice(0, MAX_FACTS);
  const rejected = rows.filter((r) => r.status === "rejected").slice(0, MAX_REJECTED);
  if (active.length === 0 && rejected.length === 0) return "";

  const parts: string[] = [];
  if (active.length > 0) {
    const lines = active.map((r) => {
      const cat = USER_FACT_CATEGORY_LABELS[parseUserFactCategory(r.category)];
      const conf = USER_FACT_CONFIDENCE_LABELS[parseUserFactConfidence(r.confidence)];
      return `- [${cat}] ${r.text} (${conf})`;
    });
    parts.push(`O UŻYTKOWNIKU (uwzględnij, ale nie cytuj wprost):\n${lines.join("\n")}`);
  }
  if (rejected.length > 0) {
    parts.push(
      `TEGO O UŻYTKOWNIKU NIE ZAKŁADAJ (sam temu zaprzeczył):\n${rejected
        .map((r) => `- ${r.text}`)
        .join("\n")}`
    );
  }
  return `\n\n${parts.join("\n\n")}`;
}

/**
 * Odcisk wiedzy o użytkowniku — do `hashInputs` w pamięci treści.
 *
 * Bez tego zmiana faktów nie oznaczałaby treści jako nieaktualnej: użytkownik potwierdziłby
 * „nie jeżdżę na rowerze", a zapamiętane propozycje dalej pokazywałyby wycieczki rowerowe, bez
 * śladu, że coś się zmieniło.
 */
export async function userContextStamp(userId: string): Promise<string> {
  try {
    const rows = await prisma.userFact.findMany({
      where: { ...(await filtrMoichRekordow(userId)) },
      orderBy: { id: "asc" },
      select: { id: true, status: true, confidence: true },
    });
    return rows.map((r) => `${r.id}:${r.status}:${r.confidence}`).join(",");
  } catch {
    return "";
  }
}
