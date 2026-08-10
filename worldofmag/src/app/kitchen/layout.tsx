import { KitchenLayout } from "@/modules/kitchen/ui/KitchenLayout";

export default function KitchenAppLayout({ children }: { children: React.ReactNode }) {
  return <KitchenLayout>{children}</KitchenLayout>;
}
