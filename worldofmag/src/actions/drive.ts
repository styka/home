"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";

export interface DriveStatus {
  connected: boolean;
  email: string | null;
  rootFolderId: string | null;
  fileCount: number;
}

/** Current user's Drive connection status (for the Settings panel). */
export async function getDriveStatus(): Promise<DriveStatus> {
  const user = await requireAuth();
  const conn = await prisma.driveConnection.findUnique({ where: { userId: user.id } });
  if (!conn) {
    return { connected: false, email: null, rootFolderId: null, fileCount: 0 };
  }
  const fileCount = await prisma.driveFile.count({ where: { userId: user.id } });
  return {
    connected: Boolean(conn.refreshToken),
    email: conn.email,
    rootFolderId: conn.rootFolderId,
    fileCount,
  };
}

/** Disconnect Drive: removes the stored tokens/connection. Uploaded files stay
 * in the user's Drive (we never delete their data on disconnect). */
export async function disconnectDrive(): Promise<void> {
  const user = await requireAuth();
  await prisma.driveConnection.deleteMany({ where: { userId: user.id } });
  revalidatePath("/settings");
}
