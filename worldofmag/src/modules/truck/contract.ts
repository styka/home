/**
 * Kontrakt modułu **Truck** (trasowanie pojazdów ciężkich).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/truck/*` poza `contract`.
 *
 * Dziś kontrakt eksportuje **wyłącznie typy**, bo Truck nie ma zewnętrznego konsumenta: nie ma go
 * ani w kalendarzu, ani w narzędziach asystenta, ani w żadnym innym module. To nie jest niedoróbka
 * — kontrakt istnieje jako **granica**, nie jako spis życzeń. Gdy ktoś realnie będzie potrzebował
 * danych Trucka, dopisze tutaj dokładnie tę jedną funkcję, zamiast wchodzić do `actions/`.
 *
 * Typy są celowo **strukturalne, nie prismowe**: konsument nie ma poznawać kształtu tabeli, żeby
 * zmiana kolumny w `VehicleProfile` nie była automatycznie zmianą publicznego kontraktu.
 */

/** Profil pojazdu użytkownika — ograniczenia brane pod uwagę przy trasowaniu (tony / metry). */
export type TruckVehicleProfile = {
  weight: number;
  height: number;
  length: number;
  width: number;
  axleload: number;
};

/** Zaplanowana trasa. `approximate` jest zawsze prawdziwe — ORS liczy po danych OSM. */
export type TruckPlan = {
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  distanceKm: number;
  durationMin: number;
  roadworksAvoided: number;
  googleMapsUrl: string;
  waypoints: { lat: number; lng: number }[];
  roadworks: { lat: number; lng: number; label: string; mapsPinUrl: string }[];
  approximate: true;
};

/** Nieudane planowanie zwraca komunikat po polsku, a nie wyjątek — trasa bywa po prostu nie do przejścia. */
export type TruckPlanError = { error: string };
