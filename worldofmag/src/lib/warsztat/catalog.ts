// Katalog typów warsztatów + podpowiedzi wyposażenia (reference data, tylko do
// odczytu — jak `categorize.ts`). Trzymane statycznie w TS: zero migracji/seedu,
// łatwa rozbudowa. Nazwy są POLSKIE. `tier` steruje grupowaniem na checkliście.

export type EquipmentKind = "tool" | "machine" | "consumable" | "safety" | "material";
export type EquipmentTier = "essential" | "recommended" | "advanced";

export interface WorkshopType {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export interface EquipmentSuggestion {
  key: string; // unikalny w obrębie typu — łączy podpowiedź z dodaną pozycją (WorkshopItem.suggestionKey)
  name: string;
  kind: EquipmentKind;
  category: string;
  tier: EquipmentTier;
  note?: string;
}

export const TIER_LABELS: Record<EquipmentTier, string> = {
  essential: "Podstawowe",
  recommended: "Zalecane",
  advanced: "Zaawansowane / Pro",
};

export const KIND_LABELS: Record<EquipmentKind, string> = {
  tool: "Narzędzia",
  machine: "Maszyny",
  consumable: "Materiały eksploatacyjne",
  safety: "BHP / ochrona",
  material: "Materiały",
};

export const CONDITION_LABELS: Record<string, string> = {
  new: "Nowe",
  good: "Dobre",
  worn: "Zużyte",
  broken: "Uszkodzone",
};

export const WORKSHOP_TYPES: WorkshopType[] = [
  { id: "ogolny", label: "Ogólny / DIY (garaż)", emoji: "🧰", description: "Uniwersalny warsztat domowy: drobne naprawy, majsterkowanie, montaż." },
  { id: "stolarski", label: "Stolarski / drewno", emoji: "🪵", description: "Obróbka drewna: cięcie, szlifowanie, łączenie, wykończenie." },
  { id: "samochodowy", label: "Samochodowy / mechanika", emoji: "🚗", description: "Serwis i naprawa pojazdów: mechanika, oleje, hamulce, diagnostyka." },
  { id: "malarski", label: "Pracownia malarska", emoji: "🎨", description: "Malarstwo i rysunek: sztalugi, farby, podobrazia, wykończenie prac." },
  { id: "elektroniczny", label: "Elektroniczny", emoji: "🔌", description: "Elektronika i lutowanie: pomiary, prototypy, naprawa układów." },
  { id: "slusarski", label: "Ślusarski / metal", emoji: "🔩", description: "Obróbka metalu: spawanie, szlifowanie, gięcie, gwintowanie." },
  { id: "ceramiczny", label: "Ceramiczny / garncarski", emoji: "🏺", description: "Ceramika: toczenie, modelowanie, szkliwienie, wypał." },
  { id: "krawiecki", label: "Krawiecki / tekstylia", emoji: "🧵", description: "Szycie i tekstylia: krojenie, szycie maszynowe, wykończenia." },
  { id: "jubilerski", label: "Jubilerski / biżuteria", emoji: "💍", description: "Drobna metaloplastyka: lutowanie, polerowanie, oprawa kamieni." },
];

// Podpowiedzi wyposażenia per typ. Kuratorskie, ale celowo zwięzłe — użytkownik
// może doklikać własne pozycje. `essential` = niezbędne minimum, `recommended` =
// warto mieć, `advanced` = sprzęt półprofesjonalny / dla zespołu.
export const EQUIPMENT_SUGGESTIONS: Record<string, EquipmentSuggestion[]> = {
  ogolny: [
    { key: "mlotek", name: "Młotek", kind: "tool", category: "Ręczne", tier: "essential" },
    { key: "wkretak-zestaw", name: "Zestaw wkrętaków", kind: "tool", category: "Ręczne", tier: "essential" },
    { key: "klucze-plasko", name: "Klucze płasko-oczkowe", kind: "tool", category: "Ręczne", tier: "essential" },
    { key: "szczypce", name: "Szczypce / kombinerki", kind: "tool", category: "Ręczne", tier: "essential" },
    { key: "miara", name: "Miara zwijana", kind: "tool", category: "Pomiar", tier: "essential" },
    { key: "poziomica", name: "Poziomica", kind: "tool", category: "Pomiar", tier: "recommended" },
    { key: "wiertarka", name: "Wiertarko-wkrętarka", kind: "machine", category: "Elektronarzędzia", tier: "recommended" },
    { key: "wierta-zestaw", name: "Zestaw wierteł i bitów", kind: "consumable", category: "Osprzęt", tier: "recommended" },
    { key: "rekawice", name: "Rękawice robocze", kind: "safety", category: "BHP", tier: "essential" },
    { key: "okulary", name: "Okulary ochronne", kind: "safety", category: "BHP", tier: "essential" },
    { key: "stol-warsztatowy", name: "Stół warsztatowy z imadłem", kind: "machine", category: "Stanowisko", tier: "advanced" },
    { key: "szafka-narzedzi", name: "Szafka / wózek narzędziowy", kind: "tool", category: "Stanowisko", tier: "advanced" },
  ],
  stolarski: [
    { key: "pila-reczna", name: "Piła ręczna / grzbietnica", kind: "tool", category: "Cięcie", tier: "essential" },
    { key: "dluta", name: "Zestaw dłut", kind: "tool", category: "Ręczne", tier: "essential" },
    { key: "strug", name: "Strug ręczny", kind: "tool", category: "Ręczne", tier: "essential" },
    { key: "scisk", name: "Ściski stolarskie", kind: "tool", category: "Mocowanie", tier: "essential" },
    { key: "katownik", name: "Kątownik stolarski", kind: "tool", category: "Pomiar", tier: "essential" },
    { key: "papier-scierny", name: "Papier ścierny (różne gradacje)", kind: "consumable", category: "Wykończenie", tier: "essential" },
    { key: "wyrzynarka", name: "Wyrzynarka", kind: "machine", category: "Elektronarzędzia", tier: "recommended" },
    { key: "szlifierka-oscyl", name: "Szlifierka oscylacyjna", kind: "machine", category: "Elektronarzędzia", tier: "recommended" },
    { key: "frezarka", name: "Frezarka górnowrzecionowa", kind: "machine", category: "Elektronarzędzia", tier: "recommended" },
    { key: "klej-stolarski", name: "Klej do drewna", kind: "consumable", category: "Wykończenie", tier: "recommended" },
    { key: "maska-pyl", name: "Maska przeciwpyłowa", kind: "safety", category: "BHP", tier: "essential" },
    { key: "pilarka-stolowa", name: "Pilarka stołowa", kind: "machine", category: "Maszyny", tier: "advanced" },
    { key: "tokarka-drewno", name: "Tokarka do drewna", kind: "machine", category: "Maszyny", tier: "advanced" },
    { key: "odciag-trocin", name: "Odciąg trocin", kind: "machine", category: "Maszyny", tier: "advanced" },
  ],
  samochodowy: [
    { key: "klucze-nasadowe", name: "Zestaw kluczy nasadowych", kind: "tool", category: "Ręczne", tier: "essential" },
    { key: "klucz-dynamo", name: "Klucz dynamometryczny", kind: "tool", category: "Pomiar", tier: "essential" },
    { key: "podnosnik", name: "Podnośnik hydrauliczny", kind: "tool", category: "Podnoszenie", tier: "essential" },
    { key: "stojaki", name: "Stojaki / kobyłki", kind: "safety", category: "Podnoszenie", tier: "essential" },
    { key: "lampa-warsztat", name: "Lampa warsztatowa", kind: "tool", category: "Stanowisko", tier: "essential" },
    { key: "miska-olej", name: "Miska do spuszczania oleju", kind: "consumable", category: "Płyny", tier: "recommended" },
    { key: "scigacz", name: "Ściągacz / wybijaki", kind: "tool", category: "Ręczne", tier: "recommended" },
    { key: "multimetr-auto", name: "Multimetr samochodowy", kind: "tool", category: "Diagnostyka", tier: "recommended" },
    { key: "obd", name: "Czytnik OBD-II", kind: "tool", category: "Diagnostyka", tier: "recommended" },
    { key: "kompresor", name: "Kompresor + narzędzia pneumatyczne", kind: "machine", category: "Maszyny", tier: "advanced" },
    { key: "klucz-udar", name: "Klucz udarowy", kind: "machine", category: "Elektronarzędzia", tier: "advanced" },
    { key: "rekawice-nitryl", name: "Rękawice nitrylowe", kind: "safety", category: "BHP", tier: "essential" },
  ],
  malarski: [
    { key: "sztaluga", name: "Sztaluga", kind: "tool", category: "Stanowisko", tier: "essential" },
    { key: "pedzle", name: "Zestaw pędzli", kind: "tool", category: "Narzędzia", tier: "essential" },
    { key: "paleta", name: "Paleta malarska", kind: "tool", category: "Narzędzia", tier: "essential" },
    { key: "farby", name: "Farby (akryl / olej)", kind: "material", category: "Media", tier: "essential" },
    { key: "podobrazia", name: "Podobrazia / płótna", kind: "material", category: "Podłoża", tier: "essential" },
    { key: "rozcienczalnik", name: "Rozcieńczalnik / medium", kind: "consumable", category: "Media", tier: "recommended" },
    { key: "szpachelki", name: "Szpachelki malarskie", kind: "tool", category: "Narzędzia", tier: "recommended" },
    { key: "werniks", name: "Werniks zabezpieczający", kind: "consumable", category: "Wykończenie", tier: "recommended" },
    { key: "lampa-dzienna", name: "Lampa światła dziennego", kind: "tool", category: "Oświetlenie", tier: "recommended" },
    { key: "wentylacja", name: "Wentylacja / wyciąg oparów", kind: "safety", category: "BHP", tier: "advanced" },
    { key: "prasa-passe", name: "Antyrama / prasa do oprawy", kind: "machine", category: "Wykończenie", tier: "advanced" },
  ],
  elektroniczny: [
    { key: "lutownica", name: "Lutownica / stacja lutownicza", kind: "tool", category: "Lutowanie", tier: "essential" },
    { key: "cyna", name: "Cyna i topnik", kind: "consumable", category: "Lutowanie", tier: "essential" },
    { key: "multimetr", name: "Multimetr", kind: "tool", category: "Pomiar", tier: "essential" },
    { key: "szczypce-precyzja", name: "Szczypce precyzyjne / pinceta", kind: "tool", category: "Ręczne", tier: "essential" },
    { key: "plytka-stykowa", name: "Płytka stykowa (breadboard)", kind: "material", category: "Prototyp", tier: "essential" },
    { key: "rozlutownica", name: "Rozlutownica / plecionka", kind: "tool", category: "Lutowanie", tier: "recommended" },
    { key: "zasilacz-lab", name: "Zasilacz laboratoryjny", kind: "machine", category: "Pomiar", tier: "recommended" },
    { key: "lupa", name: "Lupa z podświetleniem", kind: "tool", category: "Stanowisko", tier: "recommended" },
    { key: "oscyloskop", name: "Oscyloskop", kind: "machine", category: "Pomiar", tier: "advanced" },
    { key: "stacja-hotair", name: "Stacja na gorące powietrze (SMD)", kind: "machine", category: "Lutowanie", tier: "advanced" },
    { key: "mata-esd", name: "Mata i opaska ESD", kind: "safety", category: "BHP", tier: "recommended" },
  ],
  slusarski: [
    { key: "szlifierka-kat", name: "Szlifierka kątowa", kind: "machine", category: "Elektronarzędzia", tier: "essential" },
    { key: "pilniki", name: "Zestaw pilników", kind: "tool", category: "Ręczne", tier: "essential" },
    { key: "imadlo", name: "Imadło ślusarskie", kind: "tool", category: "Mocowanie", tier: "essential" },
    { key: "suwmiarka", name: "Suwmiarka", kind: "tool", category: "Pomiar", tier: "essential" },
    { key: "gwintowniki", name: "Gwintowniki i narzynki", kind: "tool", category: "Gwintowanie", tier: "recommended" },
    { key: "wiertarka-stol", name: "Wiertarka stołowa", kind: "machine", category: "Maszyny", tier: "recommended" },
    { key: "spawarka", name: "Spawarka (MIG/MMA)", kind: "machine", category: "Spawanie", tier: "recommended" },
    { key: "tarcze", name: "Tarcze tnące / ścierne", kind: "consumable", category: "Osprzęt", tier: "recommended" },
    { key: "przylbica", name: "Przyłbica spawalnicza", kind: "safety", category: "BHP", tier: "essential" },
    { key: "rekawice-spaw", name: "Rękawice spawalnicze", kind: "safety", category: "BHP", tier: "essential" },
    { key: "tokarka-metal", name: "Tokarka do metalu", kind: "machine", category: "Maszyny", tier: "advanced" },
  ],
  ceramiczny: [
    { key: "kolo-garncar", name: "Koło garncarskie", kind: "machine", category: "Maszyny", tier: "essential" },
    { key: "narzedzia-model", name: "Narzędzia do modelowania", kind: "tool", category: "Ręczne", tier: "essential" },
    { key: "glina", name: "Glina", kind: "material", category: "Media", tier: "essential" },
    { key: "druty-tnace", name: "Drut do cięcia / żyłka", kind: "tool", category: "Ręczne", tier: "essential" },
    { key: "gabki", name: "Gąbki i pędzle", kind: "tool", category: "Wykończenie", tier: "recommended" },
    { key: "szkliwa", name: "Szkliwa", kind: "material", category: "Wykończenie", tier: "recommended" },
    { key: "piec-ceramiczny", name: "Piec ceramiczny", kind: "machine", category: "Wypał", tier: "advanced" },
    { key: "wyciskarka", name: "Wyciskarka / praska do gliny", kind: "machine", category: "Maszyny", tier: "advanced" },
    { key: "fartuch", name: "Fartuch i maska", kind: "safety", category: "BHP", tier: "recommended" },
  ],
  krawiecki: [
    { key: "maszyna-szyjaca", name: "Maszyna do szycia", kind: "machine", category: "Maszyny", tier: "essential" },
    { key: "nozyczki-krawieckie", name: "Nożyczki krawieckie", kind: "tool", category: "Krojenie", tier: "essential" },
    { key: "szpilki", name: "Szpilki i igły", kind: "consumable", category: "Drobne", tier: "essential" },
    { key: "centymetr", name: "Centymetr krawiecki", kind: "tool", category: "Pomiar", tier: "essential" },
    { key: "nici", name: "Nici (różne kolory)", kind: "consumable", category: "Drobne", tier: "essential" },
    { key: "kreda", name: "Kreda krawiecka", kind: "consumable", category: "Drobne", tier: "recommended" },
    { key: "zelazko", name: "Żelazko / generator pary", kind: "machine", category: "Wykończenie", tier: "recommended" },
    { key: "manekin", name: "Manekin krawiecki", kind: "tool", category: "Stanowisko", tier: "recommended" },
    { key: "owerlok", name: "Owerlok", kind: "machine", category: "Maszyny", tier: "advanced" },
    { key: "stol-krojczy", name: "Stół krojczy", kind: "tool", category: "Stanowisko", tier: "advanced" },
  ],
  jubilerski: [
    { key: "palnik", name: "Mikropalnik", kind: "tool", category: "Lutowanie", tier: "essential" },
    { key: "pilniki-jub", name: "Pilniki igiełkowe", kind: "tool", category: "Ręczne", tier: "essential" },
    { key: "pilka-wloskowa", name: "Piłka włosowa (jubilerska)", kind: "tool", category: "Cięcie", tier: "essential" },
    { key: "szczypce-jub", name: "Szczypce jubilerskie", kind: "tool", category: "Ręczne", tier: "essential" },
    { key: "lut-srebro", name: "Lut i topnik (srebro/złoto)", kind: "consumable", category: "Lutowanie", tier: "recommended" },
    { key: "polerka", name: "Polerka / szlifierka prosta", kind: "machine", category: "Wykończenie", tier: "recommended" },
    { key: "waga-jub", name: "Waga jubilerska (0,01 g)", kind: "tool", category: "Pomiar", tier: "recommended" },
    { key: "walcarka", name: "Walcarka", kind: "machine", category: "Maszyny", tier: "advanced" },
    { key: "okulary-jub", name: "Okulary / lupa nagłowna", kind: "safety", category: "BHP", tier: "recommended" },
  ],
};

export function getWorkshopType(id: string): WorkshopType {
  return WORKSHOP_TYPES.find((t) => t.id === id) ?? WORKSHOP_TYPES[0];
}

export function getSuggestions(typeId: string): EquipmentSuggestion[] {
  return EQUIPMENT_SUGGESTIONS[typeId] ?? EQUIPMENT_SUGGESTIONS.ogolny;
}

export const WORKSHOP_TYPE_IDS = WORKSHOP_TYPES.map((t) => t.id);
