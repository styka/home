import kitchenModule from "@/modules/kitchen/module";
import { wymagajDostepuDoModulu } from "@/lib/gatingTrasy";
import { KitchenLayout } from "@/modules/kitchen/ui/KitchenLayout";

export default async function KitchenAppLayout({ children }: { children: React.ReactNode }) {
  // 098: kontrola uprawnienia stoi na TRASIE, nie tylko w nawigacji — adres wpisany
  // z ręki omija menu. W layoucie, więc obejmuje też podtrasy.
  await wymagajDostepuDoModulu(kitchenModule.permission);

  return <KitchenLayout>{children}</KitchenLayout>;
}
