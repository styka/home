import { rozglos } from "@/platform/events/bus";

/**
 * 107 — POWIADOMIENIE OTWARTYCH KART O ZMIANIE W ROZMOWIE.
 *
 * Idziemy **istniejącą szyną** (`platform/events/bus`), a nie przez outbox zdarzeń domenowych.
 * Outbox istnieje po to, żeby reakcja na zdarzenie przeżyła awarię — tu reakcją jest „odśwież
 * się”, więc trwałość niczego nie kupuje, a kosztowałaby wpis producenta w manifeście, deklarację
 * idempotencji subskrybenta i dodatkowe opóźnienie obiegu workera (C-53).
 *
 * Rozgłaszamy na kanały **osobowe** (`user:<id>`), bo rozmowa prywatna nie leży w żadnej
 * przestrzeni. Trasa strumienia liczy kanały z sesji i tego nie zmieniamy — kto nie jest
 * uczestnikiem, nie ma kanału, na którym mógłby ten sygnał usłyszeć.
 *
 * OGRANICZENIE, które trzeba znać: szyna działa w JEDNYM procesie. Przy dwóch instancjach karta
 * dostanie sygnał tylko ze swojej. Siatką bezpieczeństwa jest to samo, co dla reszty aplikacji —
 * awaryjne odpytywanie w `DataFreshness` i odświeżenie przy powrocie do karty. Sygnał może się
 * zgubić; wiadomość nie, bo treść zawsze pochodzi z serwera.
 */
export function sygnalRozmowy(rozmowaId: string, uczestnicyIds: string[]): void {
  if (uczestnicyIds.length === 0) return;
  rozglos(
    uczestnicyIds.map((id) => `user:${id}`),
    { type: "czat.rozmowa", rozmowaId },
  );
}
