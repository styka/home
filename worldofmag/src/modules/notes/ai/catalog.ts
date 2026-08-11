/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `NOTATKI (module "notes"):
- create_note { title, content?, groupName? } — groupName = nazwa grupy/folderu notatek, gdy użytkownik prosi o notatkę „w grupie X" (grupa musi istnieć; gdy jej nie ma, najpierw create_note_group).
  • TYTUŁ vs TREŚĆ: gdy użytkownik NIE rozdziela wyraźnie tytułu od treści, a podał tylko JEDEN tekst — potraktuj ten tekst jako ZAWARTOŚĆ notatki (content) przepisaną wiernie, a title WYGENERUJ samodzielnie jako krótką, zwięzłą etykietę (kilka słów) na jego podstawie. NIE wrzucaj całego tekstu jako tytułu. Wyjątek: jeśli to wyraźnie sam krótki tytuł — użyj go jako title i pomiń content.
- append_to_note { content, noteId? } (searchQuery fallback)
- update_note { title?, content?, groupName?, noteId? } (searchQuery fallback) — groupName przenosi notatkę do wskazanej grupy.
- delete_note { noteId? } (searchQuery fallback) — DESTRUKCYJNE
- toggle_pin { noteId? } (searchQuery = tytuł) — przypnij/odepnij notatkę.
- set_note_tags { tags:[string], removeTags?:[string], replace?, noteId? } (searchQuery = tytuł notatki) — DODAJE tagi do notatki (removeTags zdejmuje; replace:true zastępuje). Użyj dla „otaguj/oznacz tagiem notatkę".
- create_note_group { name, description?, color? } — grupa/folder notatek.
- update_note_group { name?, description?, color?, groupId? } (searchQuery = nazwa grupy)
- delete_note_group { groupId? } (searchQuery = nazwa) — DESTRUKCYJNE`;
