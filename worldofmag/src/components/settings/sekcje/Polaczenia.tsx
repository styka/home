import { getTranslations } from "next-intl/server";
import { getDriveStatus } from "@/actions/drive";
import { DriveSettings } from "@/components/settings/DriveSettings";
import { IcalFeedCard } from "@/modules/calendar/ui/IcalFeedCard";
import { Podsekcja } from "@/components/settings/sekcje/Podsekcja";

/**
 * 109: sekcja „Połączenia" — Dysk Google i subskrypcja kalendarza. Oba bloki opisują to samo:
 * dane Omnii widziane przez zewnętrzną aplikację.
 *
 * `notice` to komunikat po powrocie z OAuth Dysku — trasa `/settings/[sekcja]` przekazuje go dalej,
 * bo to tutaj wraca `api/drive/callback`.
 */
export async function Polaczenia({ notice }: { notice?: string }) {
  const t = await getTranslations("app.settings.sekcje");
  const driveStatus = await getDriveStatus();

  return (
    <>
      <Podsekcja tytul={t("dyskGoogle")}>
        <DriveSettings status={driveStatus} notice={notice} />
      </Podsekcja>
      <Podsekcja tytul={t("kalendarzSubskrypcja")}>
        <IcalFeedCard />
      </Podsekcja>
    </>
  );
}
