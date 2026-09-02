// 116 — ABSTRAKCJA GENERATORA OBRAZÓW dla skórek zaawansowanych.
//
// Workflow docelowy: LLM w definicji skórki zamawia grafiki (`assets[].prompt`,
// `status: "missing"`), a generator zamienia zamówienie w plik, który ląduje
// w `SkinAsset` i podmienia referencję na `ready`.
//
// Dziś ŻADEN dostawca nie jest podłączony — `resolveGeneratorObrazow()` zwraca null,
// a handler skórek zostawia sloty `missing` z czytelnym komunikatem. Podłączenie
// dostawcy to: implementacja tego interfejsu + rozpoznanie go w rezolwerze (wzorem
// dostawców mowy w `lib/tts/adapters.ts` — konfiguracja przez `/admin/llm`, C-40,
// klucz szyfrowany w `Config`, C-41). Format definicji skórki NIE zmienia się wtedy
// wcale — to jest cały sens tej abstrakcji.

export type ZamowienieObrazu = {
  /** Opis grafiki w języku naturalnym (z `assets[].prompt` definicji skórki). */
  opis: string;
  /** Rodzaj assetu — dostawca może dobrać proporcje/rozmiar (tło vs tekstura). */
  rodzaj: "background" | "texture" | "pattern" | "logo" | "decoration";
};

export type WygenerowanyObraz = {
  data: Buffer;
  /** Musi mieścić się w whiteliście magazynu (image/png | image/jpeg | image/webp). */
  mimeType: string;
};

export interface GeneratorObrazow {
  generuj(zamowienie: ZamowienieObrazu): Promise<WygenerowanyObraz | null>;
}

/** Zwraca skonfigurowany generator obrazów albo null („brak dostawcy").
 *  Konsument MUSI obsłużyć null — brak generatora to stan normalny, nie błąd. */
export function resolveGeneratorObrazow(): GeneratorObrazow | null {
  return null;
}
