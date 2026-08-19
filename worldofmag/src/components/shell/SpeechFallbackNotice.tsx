"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { setSpeechFallbackNotice } from "@/lib/tts";
import { useToast } from "@/components/ui/Toast";

/**
 * 080 (Z4): jednorazowa informacja „czytam głosem systemowym".
 *
 * Zgłoszenie właściciela nie było tylko o ciszę — było też o to, że nie wiadomo, co się dzieje.
 * Zejście na głos zapasowy musi się UDAĆ (to robi zatrzask w `lib/tts`) i musi być WIDOCZNE:
 * inny głos bez wyjaśnienia wygląda na kolejną usterkę, nie na ratunek.
 *
 * Mieszka w powłoce, a nie przy asystencie, bo dotyczy każdego lektora w aplikacji — także tego
 * w Wiadomościach. Komunikat pojawia się RAZ na sesję strony (pilnuje tego zatrzask), więc nie
 * ma jak zamienić się w natrętne przypomnienie przy każdym zdaniu.
 */
export function SpeechFallbackNotice() {
  const t = useTranslations("components.shell.SpeechFallbackNotice");
  const { showToast } = useToast();

  useEffect(() => {
    setSpeechFallbackNotice((reason) => {
      const powod =
        reason === "auth" ? t("powodKlucz")
          : reason === "model" ? t("powodModel")
          : reason === "quota" ? t("powodLimit")
          : null;
      showToast(powod ? `${t("zeszlismyNaGlosSystemowy")} ${powod}` : t("zeszlismyNaGlosSystemowy"), "info");
    });
    return () => setSpeechFallbackNotice(null);
  }, [showToast, t]);

  return null;
}
