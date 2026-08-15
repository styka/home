/**
 * 069 (zadanie 19, rozdz. 10.1) — KORYTARZ TRASY.
 *
 * Wyprowadzone z `actions/truck.ts`. Reguła decyduje, **które roboty drogowe leżą na tyle blisko
 * trasy, żeby je omijać** — a że liczba omijanych punktów jest ograniczona, jej porządek wprost
 * przekłada się na wyznaczoną trasę.
 */

/**
 * Kwadrat odległości punktu od najbliższego wierzchołka linii trasy, w stopniach².
 *
 * **Kwadrat, a nie odległość** — pierwiastek jest tu zbędny, bo wynik służy wyłącznie do
 * porządkowania („który bliżej"), a monotoniczność zachowuje. **Stopnie, a nie metry** — dla
 * porównania punktów w obrębie jednej trasy przybliżenie płaskie wystarcza; przeliczenie na metry
 * niczego by w kolejności nie zmieniło.
 *
 * Pusta linia daje `Infinity`, czyli „nieskończenie daleko" — punkt bez trasy do porównania trafia
 * na koniec porządku, zamiast wskoczyć na początek jako zero.
 */
export function nearestVertexDist2(lat: number, lng: number, line: [number, number][]): number {
  let best = Infinity;
  for (const [vLng, vLat] of line) {
    const d = (vLat - lat) ** 2 + (vLng - lng) ** 2;
    if (d < best) best = d;
  }
  return best;
}
