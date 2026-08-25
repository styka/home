/**
 * 102: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `YOUTUBE (module "youtube"):
- add_youtube_channel { adresKanalu } — dodaje obserwowany kanał; „adresKanalu" to odnośnik do kanału, jego identyfikator albo uchwyt (@nazwa)
- refresh_youtube {} — sprawdza nowe filmy na WSZYSTKICH obserwowanych kanałach; przebieg leci w tle
- mark_youtube_watched { videoId? } (searchQuery = tytuł filmu) — oznacza film jako obejrzany`;
