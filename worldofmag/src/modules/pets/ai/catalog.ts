/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
import { PET_ACTIONS_PROMPT } from "./petActions";

const blokPodstawowy = `ZWIERZĘTA (module "pets") — dodatkowe (główne akcje w sekcji ZWIERZĘTA poniżej):
- update_pet { name?, breed? } (searchQuery = imię)
- set_pet_status { status:"ACTIVE"|"SOLD"|"DECEASED"|"ARCHIVED" } (searchQuery = imię)
- delete_pet {} (searchQuery = imię) — DESTRUKCYJNE`;

/**
 * 049 — JEDNA ŚWIADOMA RÓŻNICA W UKŁADZIE PROMPTU.
 *
 * `PET_ACTIONS_PROMPT` (największy pojedynczy blok katalogu w całym systemie) był wstrzykiwany
 * PO katalogu nawigacji, a nie razem z pozostałymi katalogami akcji. Po przejściu na składanie
 * z deklaracji moduł wnosi jeden blok akcji, więc oba kawałki są sklejone i lądują tam, gdzie
 * katalogi wszystkich innych modułów. **Treść jest identyczna co do znaku — zmienia się wyłącznie
 * miejsce w prompcie.** Odnotowane, bo „zero zmian" ma znaczyć zero, a nie „prawie zero".
 */
export const actionCatalog = `${blokPodstawowy}\n\n${PET_ACTIONS_PROMPT}`;
