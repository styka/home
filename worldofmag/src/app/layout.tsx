import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { auth } from "@/platform/auth/session";
import { getPendingInvitationsCount } from "@/actions/invitations";
import { readMenuPrefs } from "@/actions/menuPrefs";
import { readFavoriteViews } from "@/actions/favoriteViews";
import { readActiveSkin } from "@/actions/skins";
import { defaultMenuPrefs } from "@/lib/modules";
import { tokensToStyle, type SkinTokens } from "@/lib/skins";
import { getUsdPlnRate } from "@/lib/usdPlnRate";
import { ensureEventWorker } from "@/lib/eventSubscribers";
import { APP_TITLE, ICON_VERSION } from "@/lib/appName";

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  /**
   * 036: klawiatura ekranowa ma ZMNIEJSZAĆ układ strony, a nie przesuwać widoczny obszar.
   *
   * Domyślnie (`resizes-visual`) po wysunięciu klawiatury układ strony zostaje tej samej wysokości,
   * a przeglądarka PRZESUWA widoczny obszar, żeby odsłonić pole tekstowe. Element `position: fixed`
   * liczy się względem układu, więc nagłówek asystenta wyjeżdża wtedy poza ekran i musimy go ścigać
   * korektą z `visualViewport` — a ta z natury spóźnia się o kilka klatek (stąd widoczne drgnięcie).
   *
   * Przy `resizes-content` kurczy się sam układ: `100dvh` maleje, pole tekstowe nigdy nie jest pod
   * klawiaturą, więc przeglądarka nie ma po co niczego przesuwać. Nagłówek stoi nieruchomo, a nasza
   * korekta staje się zerowa (`offsetTop` = 0) — zostaje wyłącznie jako zabezpieczenie dla
   * przeglądarek, które tej wskazówki nie znają (wtedy jest po prostu ignorowana, bez szkody).
   */
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: APP_TITLE,
  description: "Personal management system",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_TITLE,
  },
  // Favicon (zakładka) i ikona iOS są generowane konwencją plikową:
  // src/app/icon.tsx oraz src/app/apple-icon.tsx (przezroczyste tło, kolor wg środowiska).
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 071 (zadanie 22): obieg dostarczania zdarzeń domenowych. Idempotentne — guard singletona
  // w workerze sprawia, że kolejne renderowania nic nie robią.
  //
  // **Dlaczego tutaj, a nie w `instrumentation.ts`.** Ten drugi jest bundlowany także dla runtime
  // EDGE, a łańcuch subskrybentów sięga kodu node-only — dokładnie ten problem sprawił, że worker
  // kolejki zadań też startuje leniwie (Z-131). **I dlaczego nie u producenta zdarzenia:** moduł
  // nie sięga po korzeń kompozycji (lekcja z 049), a `ensureEventWorker` nim jest.
  ensureEventWorker();

  const session = await auth();
  const invitationCount = session?.user?.id
    ? await getPendingInvitationsCount().catch(() => 0)
    : 0;

  const userRoles: string[] = session?.user?.roles ?? [];
  const userPermissions: string[] = session?.user?.permissions ?? [];
  const isAdmin = userPermissions.includes("module.admin");
  const menuPrefs = session?.user?.id
    ? await readMenuPrefs(session.user.id).catch(() => defaultMenuPrefs())
    : defaultMenuPrefs();

  // 042: ulubione widoki żyją w POWŁOCE (pasek boczny, pasek górny, skróty), więc czytamy je
  // tutaj — raz na render layoutu — zamiast w każdej stronie z osobna.
  const favoriteViews = session?.user?.id
    ? await readFavoriteViews(session.user.id).catch(() => [])
    : [];

  // Aktywna skórka: tokeny aplikowane inline na <html> (nadpisują :root z globals.css,
  // bez migotania bo renderowane po stronie serwera). data-skin-scheme steruje m.in.
  // widocznością natywnych ikon pól date/time.
  const skin = session?.user?.id
    ? await readActiveSkin(session.user.id).catch(() => ({ skinId: null, tokens: {}, colorScheme: "dark" as const }))
    : { skinId: null, tokens: {}, colorScheme: "dark" as const };

  // 029: przelicznik USD→PLN — do wskaźnika kosztu asystenta (kwoty USD z równowartością PLN).
  const usdPlnRate = await getUsdPlnRate();
  // 085: czy przełącznik TRYBU ADMINISTRATORA ma się w ogóle pojawić. Liczone PO STRONIE SERWERA —
  // uprawnienie nie może być decyzją klienta.
  //
  // Świadomie samo `isAdmin`, BEZ systemowego wyłącznika kosztów (`ai_cost_badge_enabled`), który
  // stał tu do 083. Przełącznik przestał dotyczyć wyłącznie kosztów: gdyby zgaszenie kosztów gasiło
  // i jego, administrator straciłby możliwość ukrycia pozostałych dodatków. O tym, czy dane
  // o koszcie w ogóle wychodzą na drut, nadal decyduje serwer w `visibleUsage`.
  const trybAdminaDostepny = isAdmin;

  // 045: `data-chrome-frame` powiela token `--chrome-frame` jako atrybut, bo CSS nie potrafi
  // warunkować `display` wartością zmiennej, a odczyt tokenu w `useEffect` dawałby mignięcie
  // ramek po hydratacji. Atrybut renderuje się na serwerze, więc dekoracja skórki pojawia się
  // od pierwszej klatki albo wcale.
  const chromeFrame = (skin.tokens as SkinTokens)["--chrome-frame"] ?? "none";

  // 089 (zadanie 34): język i strefa czasowa PRZESTRZENI. `lang` na <html> było zaszyte na "en",
  // co jest błędem dostępności w polskojęzycznej aplikacji: czytnik ekranu czytał polskie teksty
  // angielską wymową. Teraz wynika z ustawień, tak jak reszta warstwy językowej.
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className="dark"
      data-skin-scheme={skin.colorScheme}
      data-chrome-frame={chromeFrame}
      // 100: dominująca ręka jako atrybut na <html>. Rzeczy, które są wyłącznie kwestią KOLEJNOŚCI
      // w rzędzie (chrom konta w panelu bocznym), lustrzą się wtedy czystym CSS-em i bez migotania —
      // ten sam powód, dla którego tokeny skórki są tu nakładane serwerowo. Tam, gdzie potrzebny
      // jest JS (rozkład pozycji paska, strona pływających przycisków), rękę niesie `menuPrefs`,
      // które powłoka i tak dostaje.
      data-reka={menuPrefs.handedness}
      style={tokensToStyle(skin.tokens)}
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_TITLE} />
        {/* iOS cache'uje apple-touch-icon po SAMEJ ścieżce (ignoruje ?query), więc
            podajemy go pod wersjonowaną ścieżką /apple-touch-icon/<ICON_VERSION>.
            Podbij ICON_VERSION w appName.ts przy każdej zmianie wyglądu logo. */}
        <link rel="apple-touch-icon" href={`/apple-touch-icon/${ICON_VERSION}`} />
      </head>
      <body>
        {/* Komunikaty na klienta idą w całości: aplikacja ma jeden słownik i kilkadziesiąt
            kilobajtów tekstu, więc dzielenie go per trasa kosztowałoby więcej uwagi, niż oszczędza
            transferu. Gdy słownik urośnie, dzieli się go przez `messages={pick(...)}` w układzie. */}
        <NextIntlClientProvider>
          <AppShell invitationCount={invitationCount} isAdmin={isAdmin} userRoles={userRoles} userPermissions={userPermissions} menuPrefs={menuPrefs} usdPlnRate={usdPlnRate} favoriteViews={favoriteViews} trybAdminaDostepny={trybAdminaDostepny}>{children}</AppShell>
        </NextIntlClientProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
