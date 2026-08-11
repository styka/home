/**
 * 049: katalog akcji ZAPISU tego modułu — tekst wstrzykiwany do promptu systemowego agenta.
 *
 * Trzymany przy module, bo to moduł wie, co potrafi. Rozbicie na „tekst" i „egzekutor" nie jest
 * dublowaniem: prompt opisuje akcję modelowi, egzekutor ją wykonuje, a `check:actions` porównuje
 * jedno z drugim i wywala build, gdy się rozjadą.
 */
export const actionCatalog = `ZDROWIE (module "health"):
- create_health_event { title, kind:"VISIT"|"TEST", scheduledAt(ISO), doctorName?, specialty?, facility?, notes? } — wizyta lub badanie.
- update_health_event { eventId?, title?, scheduledAt?, status?, notes? } (searchQuery = tytuł)
- set_health_status { status:"PLANNED"|"DONE"|"CANCELLED", eventId? } (searchQuery fallback)
- delete_health_event { eventId? } (searchQuery fallback) — DESTRUKCYJNE
- create_medication { name, kind:"MEDICATION"|"CARE", dosage?, freqType:"DAILY"|"WEEKLY"|"HOURLY", interval?, daysOfWeek?(np. [1,3,5]; 0=nd..6=sb), timesOfDay?(np. ["08:00","20:00"]), hourlyStart?, hourlyEnd?, startDate?(ISO), endDate?(ISO), instructions?, reason? } — harmonogram leku (kind MEDICATION) lub czynności pielęgnacyjnej (kind CARE, np. zmiana opatrunku).
- log_dose { medicationId?, slot?(HH:MM), date?(YYYY-MM-DD) } (searchQuery = nazwa leku) — odhacza dawkę/czynność (domyślnie dziś).
- unlog_dose { medicationId?, slot?, date? } (searchQuery = nazwa leku) — cofa odhaczenie dawki (domyślnie dziś).
- update_medication { name?, dosage?, instructions?, reason?, active?, medicationId? } (searchQuery = nazwa) — edycja harmonogramu.
- delete_medication { medicationId? } (searchQuery = nazwa) — DESTRUKCYJNE`;
