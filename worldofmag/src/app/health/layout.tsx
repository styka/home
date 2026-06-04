import { HealthNav } from "@/components/health/HealthNav";

export default function HealthAppLayout({ children }: { children: React.ReactNode }) {
  return <HealthNav>{children}</HealthNav>;
}
