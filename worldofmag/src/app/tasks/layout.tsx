import tasksModule from "@/modules/tasks/module";
import { wymagajDostepuDoModulu } from "@/lib/gatingTrasy";
import type { ReactNode } from "react";

export default async function TasksLayout({ children }: { children: ReactNode }) {
  // 098: kontrola uprawnienia stoi na TRASIE, nie tylko w nawigacji — adres wpisany
  // z ręki omija menu. W layoucie, więc obejmuje też podtrasy.
  await wymagajDostepuDoModulu(tasksModule.permission);

  return <>{children}</>;
}
