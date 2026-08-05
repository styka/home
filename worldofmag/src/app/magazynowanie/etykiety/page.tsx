export const dynamic = "force-dynamic";

import { getStorageItems } from "@/modules/magazynowanie/actions/storage";
import { QrLabels } from "@/modules/magazynowanie/ui/QrLabels";

export default async function EtykietyPage() {
  const items = await getStorageItems();

  const seen = new Set<string>();
  const locations: Array<{ key: string; warehouse: string; location: string }> = [];
  for (const i of items) {
    const wh = i.warehouse?.trim() ?? "";
    const loc = i.location?.trim() ?? "";
    if (!wh && !loc) continue;
    const key = `${wh}|${loc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    locations.push({ key, warehouse: wh, location: loc });
  }
  locations.sort((a, b) => `${a.warehouse}${a.location}`.localeCompare(`${b.warehouse}${b.location}`));

  return <QrLabels locations={locations} />;
}
