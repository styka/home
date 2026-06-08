export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getContacts } from "@/actions/contacts";
import { ContactsPage } from "@/components/contacts/ContactsPage";

export default async function ContactsRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (!hasPermission(session, PERMISSIONS.CONTACTS)) redirect("/");

  const contacts = await getContacts();

  return <ContactsPage initialContacts={contacts} />;
}
