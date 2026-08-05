import { HealthNav } from "@/modules/health/ui/HealthNav";

export default function HealthAppLayout({ children }: { children: React.ReactNode }) {
  return <HealthNav>{children}</HealthNav>;
}
