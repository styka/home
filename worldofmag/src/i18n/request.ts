import { getRequestConfig } from "next-intl/server";
import { JEZYK_DOMYSLNY, STREFA_DOMYSLNA } from "@/platform/i18n/jezyki";

/**
 * 089 (zadanie 34) — KONFIGURACJA `next-intl` BEZ ROUTINGU JĘZYKOWEGO.
 *
 * Aplikacja nie ma i nie będzie miała ścieżek `/pl/...`. Powód: język należy do **przestrzeni**
 * (rozdz. 8.2), a nie do adresu — ten sam zasób ma wyglądać tak samo dla każdego, kto go widzi.
 * Prefiks w URL-u związałby język z sesją przeglądarki i rozjechałby się z tym, co zapisano
 * w przestrzeni; do tego unieważniłby wszystkie istniejące zakładki i odnośniki.
 *
 * Język ustala `ustalJezykZadania()` (`platform/i18n/kontekst.ts`) — czyta go z przestrzeni
 * użytkownika, a przy braku sesji zwraca domyślny. Ta funkcja jest tu wołana LENIWIE, bo
 * `getRequestConfig` bywa wykonywane także tam, gdzie sesji nie ma (strona logowania).
 */
export default getRequestConfig(async () => {
  const { ustalJezykZadania } = await import("@/platform/i18n/kontekst");
  const { locale, timezone } = await ustalJezykZadania().catch(() => ({
    locale: JEZYK_DOMYSLNY,
    timezone: STREFA_DOMYSLNA,
  }));
  return {
    locale,
    timeZone: timezone,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Data „teraz" ustalona po stronie serwera — inaczej komponenty serwerowe i klienckie liczą
    // upływ czasu z dwóch różnych zegarów i React zgłasza rozjazd hydracji.
    now: new Date(),
  };
});
