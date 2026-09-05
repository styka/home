/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `ZADANIA (module "tasks"):
- create_task { title, description?, priority:"NONE"|"LOW"|"MEDIUM"|"HIGH"|"URGENT", dueDate?(ISO), projectName?, tags?:[string], parentSearch? }
  • PODZADANIE: gdy użytkownik chce zadanie „pod" innym ("dodaj podzadanie X do zadania Y") — podaj parentSearch = tytuł zadania-rodzica.
  • TAGI przy tworzeniu: params.tags = lista nazw etykiet.
  • TYTUŁ vs TREŚĆ: gdy użytkownik NIE rozdziela wyraźnie tytułu od treści, a podał tylko JEDEN tekst (np. dłuższe zdanie/opis) — potraktuj ten tekst jako TREŚĆ zadania (description), a title WYGENERUJ samodzielnie jako krótką, zwięzłą etykietę (kilka słów) na jego podstawie. NIE wrzucaj całego tekstu jako tytułu. Wyjątek: jeśli tekst to wyraźnie sam krótki tytuł (kilka słów, np. „kup mleko") — użyj go jako title i pomiń description.
  • OPIS (description): wstaw DOKŁADNIE oryginalny tekst użytkownika — słowo w słowo, VERBATIM, bez żadnych zmian. NIE przeredagowuj: NIE zamieniaj na formę bezosobową/rzeczową, NIE poprawiaj gramatyki ani interpunkcji, NIE streszczaj, NIE skracaj, NIE zmieniaj znaczenia i NIE pomijaj ŻADNYCH faktów, liczb, nazw ani szczegółów. Zachowaj oryginalne słowa, ton, styl i ewentualne literówki użytkownika. To samo obowiązuje, gdy zadanie jest zgłoszeniem błędu/prośbą o zmianę aplikacji — treść zgłaszającego przepisujesz wiernie (informacje dodatkowe/kontekst możesz dokleić, ale opisu użytkownika NIE ruszasz). title = krótka etykieta (kilka słów) wygenerowana z treści; description = oryginalna treść użytkownika bez zmian.
- update_task { taskId?, title?, description?, priority?, status?, dueDate? } (searchQuery fallback)
- update_task_status { status:"TODO"|"IN_PROGRESS"|"DONE"|"CANCELLED"|"DEFERRED", taskId? } (searchQuery fallback)
- shift_task_due_date { days:number, taskId? } (searchQuery fallback; ujemne = wcześniej)
- shift_task_priority { steps:number, taskId? } (searchQuery fallback) — podnosi/obniża priorytet WZGLĘDNIE o "steps" szczebli na drabinie NONE<LOW<MEDIUM<HIGH<URGENT (ujemne = obniż). Każde zadanie zmienia się względem SWOJEGO obecnego priorytetu — użyj TEJ akcji (osobny shift_task_priority per zadanie) zamiast ustawiać wspólny priorytet przez update_task, gdy ktoś prosi „podnieś/zmniejsz priorytet o N".
- delete_task { taskId? } (searchQuery fallback) — DESTRUKCYJNE
- set_task_tags { tags:[string], removeTags?:[string], replace?, taskId? } (searchQuery = tytuł zadania) — DODAJE podane tagi do zadania (removeTags zdejmuje wskazane; replace:true zastępuje cały zestaw). Użyj dla „otaguj/oznacz tagiem/nadaj etykietę zadaniu".
- add_task_comment { content, taskId? } (searchQuery = tytuł zadania) — dodaje komentarz do zadania.
- submit_feedback { title, description } — ZGŁOSZENIE błędu/sugestii do aplikacji, trafia do skrzynki administratora. Używaj TYLKO w trybie zgłoszeniowym (gdy polecenie tak mówi). NIE używaj create_task do zgłoszeń — skrzynka należy do administratora i zwykły użytkownik nie ma do niej dostępu.
- create_project { name, emoji? }
- update_project { name?, emoji?, projectId? } (searchQuery = nazwa projektu)
- delete_project { projectId? } (searchQuery = nazwa) — DESTRUKCYJNE`;
