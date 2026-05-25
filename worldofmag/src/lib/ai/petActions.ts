// Katalog akcji AI dla modułu Zwierzęta. Wstrzykiwany do promptu interpretacji
// (interpret/route.ts) i obsługiwany w dispatcherze (execute/route.ts).
// Trzymany osobno, by prompt pozostał czytelny mimo wielu akcji.

export const PET_ACTIONS_PROMPT = `ZWIERZĘTA (module: "pets"):
- add_pet: params { name: string, species?: string, breed?: string, sex?: string }
  Dodaje nowe zwierzę. species to klucz: dog|cat|snake|lizard|turtle|fish|bird|rodent|rabbit|other.
  Mapuj polskie nazwy: pies→dog, kot→cat, wąż→snake, jaszczurka/gekon→lizard, żółw→turtle, ryba/rybka→fish, ptak/papuga→bird, chomik/szczur/mysz/świnka→rodent, królik→rabbit. sex: male|female|unknown.
- log_weight: params { weightKg?: number, weightGrams?: number, lengthCm?: number }, searchQuery: string
  Zapisuje pomiar wagi/długości zwierzęcia. searchQuery to imię zwierzęcia. Podaj wagę w weightKg LUB weightGrams.
- schedule_treatment: params { kind?: "MEDICATION"|"VACCINE"|"DEWORMER"|"PARASITE"|"SUPPLEMENT", name: string, dueDate?: string, everyDays?: number, dosage?: string }, searchQuery: string
  Planuje lek/szczepienie/odrobaczanie. searchQuery to imię zwierzęcia. dueDate w ISO 8601. everyDays = cykliczność w dniach (np. "co 3 miesiące" → 90, "co tydzień" → 7).
- log_treatment_done: params {}, searchQuery: string
  Odhacza wykonanie zaplanowanego leku/zabiegu. searchQuery to nazwa leku/zabiegu.
- schedule_care_task: params { category?: "FEEDING"|"CLEANING"|"GROOMING"|"WALK"|"WATER_CHANGE"|"UVB_REPLACEMENT"|"WEIGHING"|"CUSTOM", title: string, dueDate?: string, everyDays?: number }, searchQuery: string
  Planuje rutynę opieki (karmienie, czyszczenie, spacer…). searchQuery to imię zwierzęcia.
- log_feeding: params { foodType?: string, preyType?: string, amount?: string, outcome?: "FED"|"REFUSED"|"REGURGITATED" }, searchQuery: string
  Zapisuje karmienie. searchQuery to imię zwierzęcia. Dla gadów użyj preyType (np. "mysz") i outcome.
- record_vet_visit: params { date?: string, reason?: string, vetName?: string, cost?: number }, searchQuery: string
  Zapisuje wizytę weterynaryjną. searchQuery to imię zwierzęcia. date w ISO 8601.
- log_health_note: params { type?: "CONDITION"|"ALLERGY"|"SYMPTOM"|"INJURY"|"NOTE"|"MILESTONE", title: string, description?: string }, searchQuery: string
  Dodaje wpis do dziennika zdrowia. searchQuery to imię zwierzęcia.`;

export const PET_ACTION_EXAMPLES = `Polecenie: "dodaj psa Reksio, golden retriever"
→ [{ "id":"a1", "module":"pets", "type":"add_pet", "description":"Dodaj psa Reksio (golden retriever)", "params":{ "name":"Reksio", "species":"dog", "breed":"golden retriever" } }]

Polecenie: "zważ Reksia 12 kg"
→ [{ "id":"a1", "module":"pets", "type":"log_weight", "description":"Zapisz wagę Reksia: 12 kg", "params":{ "weightKg":12 }, "searchQuery":"Reksio" }]

Polecenie: "zaplanuj odrobaczanie Reksia za 3 miesiące i powtarzaj co 3 miesiące"
→ [{ "id":"a1", "module":"pets", "type":"schedule_treatment", "description":"Odrobaczanie Reksia co 3 miesiące", "params":{ "kind":"DEWORMER", "name":"Odrobaczanie", "everyDays":90 }, "searchQuery":"Reksio" }]`;
