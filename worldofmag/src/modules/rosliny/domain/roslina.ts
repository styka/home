import type { JednostkaLicznosci, StatusRosliny } from "../lib/typy";
import { STATUSY_ZAKONCZONE } from "../lib/typy";

/**
 * 113 — PRZEPISANIE WIERSZA ROŚLINY NA KSZTAŁT, KTÓRY DOSTAJE PRZEGLĄDARKA.
 *
 * Mieszka tutaj, a nie w pliku akcji, bo plik z `"use server"` nie eksportuje funkcji
 * synchronicznych — reguła w nim zawarta jest niesprawdzalna (ta sama lekcja, co w module YouTube).
 *
 * **Reguła, którą ta funkcja niesie, jest jedna, ale łatwo ją zepsuć: gatunek ze słownika ma
 * pierwszeństwo, ale nazwa wpisana z ręki NIE ZNIKA.** Dla użytkownika, który wpisał „jakaś paproć
 * od babci", ten tekst jest jedyną nazwą, jaką ma. Zwracanie `null`, gdy nie ma dopasowania
 * w słowniku, kasowałoby informację, którą sam podał.
 */

export interface WierszRosliny {
  id: string;
  spaceId: string;
  placeId: string | null;
  speciesId: string | null;
  name: string;
  customSpecies: string | null;
  quantity: number;
  quantityUnit: string;
  stage: string | null;
  status: string;
  statusReason: string | null;
  sownAt: Date | null;
  acquiredAt: Date | null;
  parentId: string | null;
  photoUrl: string | null;
  notes: string | null;
  place: { name: string } | null;
  species: { namePl: string; family: string | null } | null;
}

export interface RoslinaDTO {
  id: string;
  spaceId: string;
  placeId: string | null;
  placeName: string | null;
  speciesId: string | null;
  gatunek: string | null;
  rodzina: string | null;
  name: string;
  quantity: number;
  quantityUnit: JednostkaLicznosci;
  stage: string | null;
  status: StatusRosliny;
  statusReason: string | null;
  sownAt: string | null;
  acquiredAt: string | null;
  parentId: string | null;
  photoUrl: string | null;
  notes: string | null;
}

export function roslinaNaDTO(r: WierszRosliny): RoslinaDTO {
  return {
    id: r.id,
    spaceId: r.spaceId,
    placeId: r.placeId,
    placeName: r.place?.name ?? null,
    gatunek: r.species?.namePl ?? r.customSpecies ?? null,
    rodzina: r.species?.family ?? null,
    speciesId: r.speciesId,
    name: r.name,
    quantity: r.quantity,
    quantityUnit: r.quantityUnit as JednostkaLicznosci,
    stage: r.stage,
    status: r.status as StatusRosliny,
    statusReason: r.statusReason,
    sownAt: r.sownAt?.toISOString() ?? null,
    acquiredAt: r.acquiredAt?.toISOString() ?? null,
    parentId: r.parentId,
    photoUrl: r.photoUrl,
    notes: r.notes,
  };
}

/**
 * Czy zmiana stanu na `status` wymaga podania powodu.
 *
 * **Tylko `DEAD`** — i to jest różnica merytoryczna, nie formalna. „Sprzedana" i „zebrana" mówią
 * same za siebie; „padła" bez powodu nie mówi nic, a rejestr porażek jest jedyną funkcją w tym
 * module, która POPRAWIA użytkownika, zamiast tylko go obsługiwać. To z tych powodów powstają
 * wnioski w rodzaju „trzy razy przelałeś sukulenty".
 */
export function powodWymagany(status: StatusRosliny): boolean {
  return status === "DEAD";
}

/** Czy stan oznacza byt zakończony — znika z listy aktywnych, zostaje w historii miejsca. */
export function statusZakonczony(status: StatusRosliny): boolean {
  return STATUSY_ZAKONCZONE.includes(status);
}

/**
 * Sprawdza komplet danych zmiany stanu. Zwraca komunikat błędu albo `null`, gdy jest w porządku.
 *
 * Zwracamy KOMUNIKAT, a nie `boolean`: użytkownik ma się dowiedzieć, czego brakuje i po co, a nie
 * tylko że „nie wolno".
 */
export function bladZmianyStanu(status: StatusRosliny, reason: string | null | undefined): string | null {
  if (powodWymagany(status) && !reason?.trim()) {
    return "Podaj przyczynę — bez niej wpis nie powie nic, gdy wrócisz do niego za rok";
  }
  return null;
}
