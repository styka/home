import { KitchenLayout } from "@/components/kitchen/KitchenLayout";

export default function KitchenAppLayout({ children }: { children: React.ReactNode }) {
  return <KitchenLayout>{children}</KitchenLayout>;
}
