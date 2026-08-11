/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `WIADOMOŚCI (module "news"):
- create_news_topic { title, semanticFilter? } — nowy monitorowany temat.
- delete_news_topic { topicId? } (searchQuery = tytuł) — DESTRUKCYJNE
- update_news_topic { title?, semanticFilter?, topicId? } (searchQuery = tytuł)
- refresh_news {} — uruchamia odświeżenie CAŁEGO modułu (kanały są wspólne dla tematów); przebieg leci w tle
- create_news_source { name, rssUrl, homepageUrl?, descriptor? } — dodaje źródło RSS; descriptor to krótki opis własnymi słowami (np. „pop-science", „lewica").
- update_news_source { newName?, rssUrl?, homepageUrl?, descriptor?, enabled?, sourceId? } (searchQuery = nazwa źródła)
- delete_news_source { sourceId? } (searchQuery = nazwa źródła) — DESTRUKCYJNE`;
