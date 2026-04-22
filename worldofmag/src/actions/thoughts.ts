"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface AttachmentInput {
  type: string;
  url: string;
  driveFileId?: string | null;
  filename: string;
  mimeType: string;
  size?: number | null;
}

export async function createThought(content: string, attachments: AttachmentInput[] = []) {
  const thought = await prisma.thought.create({
    data: {
      content,
      attachments: {
        create: attachments.map((a) => ({
          type: a.type,
          url: a.url,
          driveFileId: a.driveFileId ?? null,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size ?? null,
        })),
      },
    },
    include: { attachments: true },
  });
  revalidatePath("/thoughts");
  return thought;
}

export async function deleteThought(id: string) {
  await prisma.thought.delete({ where: { id } });
  revalidatePath("/thoughts");
}

export async function getThoughts() {
  return prisma.thought.findMany({
    orderBy: { createdAt: "desc" },
    include: { attachments: true },
  });
}
