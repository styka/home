// Katalog akcji AI dla modułu Zwierzęta. Wstrzykiwany do promptu agenta
// (agent/route.ts) i obsługiwany w dispatcherze (execute/route.ts).
// Trzymany osobno, by prompt pozostał czytelny mimo wielu akcji.

export const PET_ACTIONS_PROMPT = `ZWIERZĘTA (module: "pets"):
- add_pet: params { name: string, species?: string, breed?: string, sex?: string, birthDate?: string, birthApprox?: boolean, acquiredAt?: string, acquiredFrom?: string, microchipId?: string, identifier?: string, color?: string, notes?: string }
  Dodaje nowe zwierzę. species to klucz: dog|cat|snake|lizard|turtle|fish|bird|rodent|rabbit|other.
  Mapuj polskie nazwy: pies→dog, kot→cat, wąż→snake, jaszczurka/gekon→lizard, żółw→turtle, ryba/rybka→fish, ptak/papuga→bird, chomik/szczur/mysz/świnka→rodent, królik→rabbit. sex: male|female|unknown.
  Wypełnij OD RAZU wszystko, co wynika z polecenia — nie zakładaj „gołego" zwierzęcia, żeby potem je poprawiać: birthDate/acquiredAt w ISO 8601 (birthApprox:true, gdy data jest szacowana, np. „ok. 2021"), acquiredFrom = skąd pochodzi (hodowla, schronisko, osoba), microchipId = numer mikroczipa, identifier = obrączka/tag, color = umaszczenie, notes = pozostałe istotne informacje jednym akapitem.
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
  Dodaje wpis do dziennika zdrowia. searchQuery to imię zwierzęcia.
- add_enclosure: params { name: string, type?: "TERRARIUM"|"AQUARIUM"|"PALUDARIUM"|"CAGE"|"AVIARY"|"TANK", volumeL?: number, assignTo?: string }
  Tworzy zbiornik (terrarium/akwarium). assignTo = imię zwierzęcia do przypisania (opcjonalnie).
- update_enclosure: params { newName?, type?, location?, notes? }, searchQuery = nazwa zbiornika. Edytuje zbiornik.
- delete_enclosure: params {}, searchQuery = nazwa zbiornika. DESTRUKCYJNE.
- assign_pet_to_enclosure: params { enclosureName? }, searchQuery = imię zwierzęcia. Przypisuje zwierzę do zbiornika (pusty enclosureName = odpięcie).
- log_environment: params { tempWarmC?: number, tempCoolC?: number, humidityPct?: number, uvbIndex?: number, waterTempC?: number, ph?: number, ammoniaPpm?: number, nitritePpm?: number, nitratePpm?: number, salinityPpt?: number, gh?: number, kh?: number }, searchQuery: string
  Zapisuje pomiar parametrów środowiska dla zbiornika przypisanego do zwierzęcia. searchQuery to imię zwierzęcia. Terrarium: temp/wilgotność/UVB. Akwarium: pH/amoniak/azotyny/azotany/temp. wody.
- record_sale: params { buyerName?: string, price?: number, buyerContact?: string }, searchQuery: string
  Zapisuje sprzedaż zwierzęcia i oznacza je jako sprzedane. searchQuery to imię zwierzęcia.
- add_breeding_pair: params { name?: string, partner?: string }, searchQuery: string
  Tworzy parę hodowlaną. searchQuery to imię pierwszego zwierzęcia, partner to imię drugiego.

PRZENOSZENIE DANYCH Z INNEGO MODUŁU (np. „załóż zwierzę na podstawie zadań z projektu X"):
1. Najpierw przeczytaj KOMPLET danych źródłowych (patrz uwaga o offset przy narzędziach odczytu) wraz z treścią opisów — dopiero potem buduj akcje.
2. Zbuduj JEDEN plan: add_pet z pełnym profilem + osobne akcje na to, co moduł potrafi przechować (schedule_treatment dla leków/szczepień/odrobaczania, schedule_care_task dla rutyn typu mycie/czesanie/czyszczenie uszu, record_vet_visit dla wizyt, log_health_note dla rozpoznań i dolegliwości, log_weight dla pomiarów).
3. W polu opisu odpowiedzi ZAWSZE wypisz osobno, CZEGO NIE DAŁO SIĘ PRZENIEŚĆ i dlaczego — konkretnie, z podaniem informacji źródłowej i brakującego miejsca w module (np. „kontakt do petsittera — moduł nie ma pola na kontakty do opiekunów"). Nie pomijaj tego i nie zastępuj ogólnikiem: użytkownik prosi o tę listę po to, żeby zgłosić brak do rozwoju aplikacji.
4. NIGDY nie zmieniaj ani nie kasuj danych źródłowych (zadań, notatek) przy takim przenoszeniu — chyba że użytkownik wyraźnie o to poprosi.`;

export const PET_ACTION_EXAMPLES = `Polecenie: "dodaj psa Reksio, golden retriever"
→ [{ "id":"a1", "module":"pets", "type":"add_pet", "description":"Dodaj psa Reksio (golden retriever)", "params":{ "name":"Reksio", "species":"dog", "breed":"golden retriever" } }]

Polecenie: "zważ Reksia 12 kg"
→ [{ "id":"a1", "module":"pets", "type":"log_weight", "description":"Zapisz wagę Reksia: 12 kg", "params":{ "weightKg":12 }, "searchQuery":"Reksio" }]

Polecenie: "zaplanuj odrobaczanie Reksia za 3 miesiące i powtarzaj co 3 miesiące"
→ [{ "id":"a1", "module":"pets", "type":"schedule_treatment", "description":"Odrobaczanie Reksia co 3 miesiące", "params":{ "kind":"DEWORMER", "name":"Odrobaczanie", "everyDays":90 }, "searchQuery":"Reksio" }]

Polecenie: "zapisz parametry wody dla Nemo: ph 7.2, azotany 20, amoniak 0"
→ [{ "id":"a1", "module":"pets", "type":"log_environment", "description":"Parametry wody dla Nemo", "params":{ "ph":7.2, "nitratePpm":20, "ammoniaPpm":0 }, "searchQuery":"Nemo" }]`;
