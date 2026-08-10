// Z-213/361: `actions/services.ts` to teraz BARREL re-eksportujący akcje modułu
// Usługi z plików per-obszar (`actions/parts/*.ts`). Zachowuje stabilny
// publiczny import `@/actions/services` dla istniejących konsumentów; nowy kod może
// importować wprost z konkretnego pliku obszaru.
//
// WAŻNE: ten plik NIE ma dyrektywy "use server" — to zwykły barrel. Same Server
// Actions żyją w plikach obszarów (każdy z "use server"). Plik "use server" NIE
// może re-eksportować akcji (build: „Only async functions… in use server file"),
// dlatego barrel jest nie-akcyjny. Typy/helpery: @/lib/services i @/lib/services/helpers.
export * from "./parts/providers";
export * from "./parts/listings";
export * from "./parts/requests";
export * from "./parts/messaging";
export * from "./parts/scheduling";
export * from "./parts/payments";
export * from "./parts/favorites";
export * from "./parts/stats";
export * from "./parts/images";
export * from "./parts/promo";
export * from "./parts/disputes";
