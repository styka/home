export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getContacts } from "@/modules/contacts/actions/contacts";
import { ContactsPage } from "@/modules/contacts/ui/ContactsPage";

export default async function ContactsRootPage({ searchParams }: { searchParams?: { q?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.CONTACTS)) redirect("/");

  const contacts = await getContacts();

  return <ContactsPage initialContacts={contacts} viewParams={searchParams ?? {}} />;
}
