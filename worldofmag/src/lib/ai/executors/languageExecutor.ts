// Z-010: handler akcji asystenta dla modułu Języki (talie + fiszki SRS).
// Scala oba dawne bloki `module === "languages"` z execute/route.ts.
import { prisma } from "@/lib/prisma";
import { createDeck, updateDeck, deleteDeck, addWord, updateWord, deleteWord, bulkAddWords } from "@/actions/languageDecks";
import { asStr, resolveDeckId, ownerOrArr } from "@/lib/ai/executors/shared";
import type { AIAction } from "@/lib/ai/aiAction";

export async function executeLanguageAction(action: AIAction, userId: string): Promise<string> {
  const { type, params, searchQuery } = action;

  if (type === "create_deck") {
    const name = asStr(params.name);
    if (!name) throw new Error("Podaj nazwę talii");
    const deck = await createDeck({
      name,
      nativeLang: asStr(params.nativeLang) ?? "polski",
      targetLang: asStr(params.targetLang) ?? "angielski",
    });
    return `Utworzono talię „${deck.name}"`;
  }
  if (type === "add_word") {
    const term = asStr(params.term);
    const translation = asStr(params.translation);
    if (!term || !translation) throw new Error("Podaj słówko i tłumaczenie");
    const deckId = await resolveDeckId(userId, params, asStr(params.deckName));
    const card = await addWord(deckId, { term, translation, example: asStr(params.example) ?? null });
    return `Dodano fiszkę „${card.term}" → „${card.translation}"`;
  }
  if (type === "delete_word") {
    const id = asStr(params.wordId);
    if (!id) throw new Error("Wskaż fiszkę do usunięcia");
    await deleteWord(id);
    return `Usunięto fiszkę`;
  }
  if (type === "update_deck") {
    const id = await resolveDeckId(userId, params, asStr(params.deckName) ?? searchQuery);
    await updateDeck(id, { name: asStr(params.name), nativeLang: asStr(params.nativeLang), targetLang: asStr(params.targetLang) });
    return `Zaktualizowano talię`;
  }
  if (type === "delete_deck") {
    const id = await resolveDeckId(userId, params, asStr(params.deckName) ?? searchQuery);
    await deleteDeck(id);
    return `Usunięto talię`;
  }
  if (type === "update_word") {
    let id = asStr(params.wordId);
    if (!id) {
      const teamOr = await ownerOrArr(userId);
      const q = searchQuery ?? asStr(params.term) ?? "";
      const card = await prisma.vocabulary.findFirst({ where: { term: { contains: q, mode: "insensitive" }, deck: { OR: teamOr } }, select: { id: true } });
      if (!card) throw new Error(`Nie znaleziono fiszki: "${q}"`);
      id = card.id;
    }
    await updateWord(id, { term: asStr(params.term), translation: asStr(params.translation), example: asStr(params.example) });
    return `Zaktualizowano fiszkę`;
  }

  if (type === "bulk_add_words") {
    const deckId = await resolveDeckId(userId, params, asStr(params.deckName) ?? searchQuery);
    const raw = Array.isArray(params.words) ? params.words : [];
    const words = raw
      .map((w) => w as { term?: unknown; translation?: unknown; example?: unknown })
      .map((w) => ({ term: asStr(w.term) ?? "", translation: asStr(w.translation) ?? "", example: asStr(w.example) ?? null }))
      .filter((w) => w.term && w.translation);
    if (words.length === 0) throw new Error("Podaj listę słówek (words: [{term, translation}])");
    const count = await bulkAddWords(deckId, words);
    return `Dodano ${count} ${count === 1 ? "słówko" : "słówek"} do talii`;
  }

  throw new Error(`Nieznany typ akcji języków: ${type}`);
}
