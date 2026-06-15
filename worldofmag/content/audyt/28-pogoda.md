# Rozdział 28 — Pogoda (Weather)

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/weather.ts`; modele `WeatherLocation`, `WeatherWatcher`.
- **Źródło:** `src/lib/weather/openMeteo.ts` (Open-Meteo, **bez klucza, darmowe**).
- **Funkcje:** prognoza, **porady „co robić” od LLM**, watchery (presety + własne progi alarmowe).

## Mocne strony

- **Tanie i niezależne** (Open-Meteo bez klucza) — niski koszt utrzymania.
- **Porady LLM + watchery** — wartość ponad surową prognozą.

## Głos Zespołu A — Strażnicy

**Piotr (SRE):** „Zależność od jednego dostawcy (Open-Meteo) — mieć fallback/cache, by awaria nie psuła
modułu. Porady LLM — cache’ować per lokalizacja/dzień (ten sam dzień = ta sama porada, zero powtórnych tokenów).”

## Głos Zespołu B — Pionierzy

**Hubert (AI/ML):** „Pogoda to **świetny kontekst dla całego systemu**: »zaplanuj tydzień pod pogodę«
(spięcie z zadaniami/kalendarzem), »czy podlać ogród« (przyszłe rolnictwo, V5), »zabierz parasol«.
Niech pogoda zasila inne moduły, nie żyje osobno.”

**Ola (UX):** „Widżet pogody na pulpicie z poradą jednolinijkową — miły, lekki akcent.”

## Punkty sporne

- **Samodzielny moduł vs warstwa kontekstu.** **Konsensus:** zostaje modułem, ale **udostępnić pogodę
  jako kontekst** dla zadań/kalendarza/rolnictwa.

## Głos użytkowników

**Krzysztof (52):** „Alarm o mrozie/burzy przed pracą w terenie — przydatne.”

## Konsensus i zalecenia

- **Z-330** *(P2 · S)* — **Cache porad LLM per lokalizacja/dzień** — zero powtórnych tokenów.
- **Z-331** *(P2 · S)* — **Fallback/cache źródła pogody** — odporność na awarię dostawcy.
- **Z-332** *(P2 · M)* — **Pogoda jako kontekst** dla zadań/kalendarza (i przyszłego rolnictwa V5).
- **Z-333** *(P2 · S)* — **Web-push dla watcherów** (alarmy pogodowe) — spójne z Rozdz. 34.

## Dobre vs złe praktyki

**Dobre:** tanie, niezależne źródło; porady LLM; watchery.
**Złe / do poprawy:** brak cache porad (powtarzalny koszt LLM); pogoda żyje osobno zamiast zasilać moduły.
