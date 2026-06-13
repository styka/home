// Thin Google Drive REST v3 client over fetch (no heavy SDK dependency).
// All operations act on the connected user's Drive using the `drive.file` scope,
// so the app only ever touches files/folders it created itself.

import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "@/lib/drive/oauth";
import type { DriveConnection } from "@prisma/client";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const ROOT_FOLDER_NAME = "Omnia";

// Human-friendly per-module folder names (Polish, matching the app's language).
export const MODULE_FOLDERS: Record<string, string> = {
  magazynowanie: "Magazyn",
  kitchen: "Kuchnia",
  pets: "Zwierzęta",
  notes: "Notatki",
  shopping: "Zakupy",
  tasks: "Zadania",
  warsztaty: "Warsztaty",
  health: "Zdrowie",
  flota: "Flota",
  other: "Inne",
};

function moduleFolderName(module: string): string {
  return MODULE_FOLDERS[module] ?? MODULE_FOLDERS.other;
}

/** Return a valid (non-expired) access token for a user, refreshing if needed.
 * Returns null if the user has not connected Drive. */
export async function getValidConnection(
  userId: string,
): Promise<{ conn: DriveConnection; accessToken: string } | null> {
  const conn = await prisma.driveConnection.findUnique({ where: { userId } });
  if (!conn || !conn.refreshToken) return null;

  const stillValid =
    conn.accessToken &&
    conn.accessTokenExpiresAt &&
    conn.accessTokenExpiresAt.getTime() > Date.now();

  if (stillValid) return { conn, accessToken: conn.accessToken! };

  const tokens = await refreshAccessToken(conn.refreshToken);
  const updated = await prisma.driveConnection.update({
    where: { userId },
    data: {
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.expiresAt,
    },
  });
  return { conn: updated, accessToken: tokens.accessToken };
}

async function driveFetch(
  accessToken: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
  });
}

/** Create a folder, optionally under a parent, and return its id. */
async function createFolder(
  accessToken: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const res = await driveFetch(accessToken, `${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Drive createFolder failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Ensure the root "Omnia" folder exists; returns its id (persisted on the connection). */
export async function ensureRootFolder(userId: string, accessToken: string): Promise<string> {
  const conn = await prisma.driveConnection.findUnique({ where: { userId } });
  if (conn?.rootFolderId) return conn.rootFolderId;
  const id = await createFolder(accessToken, ROOT_FOLDER_NAME);
  await prisma.driveConnection.update({ where: { userId }, data: { rootFolderId: id } });
  return id;
}

/** Ensure the per-module subfolder exists under the root; returns its id (cached in folderMap). */
async function ensureModuleFolder(
  userId: string,
  accessToken: string,
  module: string,
): Promise<string> {
  const conn = await prisma.driveConnection.findUnique({ where: { userId } });
  if (!conn) throw new Error("Drive not connected");
  const map = JSON.parse(conn.folderMap || "{}") as Record<string, string>;
  if (map[module]) return map[module];

  const rootId = conn.rootFolderId ?? (await ensureRootFolder(userId, accessToken));
  const folderId = await createFolder(accessToken, moduleFolderName(module), rootId);
  map[module] = folderId;
  await prisma.driveConnection.update({
    where: { userId },
    data: { folderMap: JSON.stringify(map) },
  });
  return folderId;
}

export interface UploadResult {
  driveFileId: string;
  url: string;
}

/** Upload a file into the user's per-module folder, register it, and return a
 * proxy URL the app can embed (`/api/drive/file/<id>`). */
export async function uploadFile(
  userId: string,
  module: string,
  file: { buffer: Buffer; name: string; mime: string },
): Promise<UploadResult> {
  const valid = await getValidConnection(userId);
  if (!valid) throw new Error("Drive not connected");
  const { accessToken } = valid;

  const folderId = await ensureModuleFolder(userId, accessToken, module);

  const metadata = { name: file.name, parents: [folderId] };
  const boundary = "omnia-" + Math.random().toString(36).slice(2);
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\nContent-Type: ${file.mime}\r\n\r\n`,
    ),
    file.buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await driveFetch(
    accessToken,
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string };

  await prisma.driveFile.create({
    data: {
      userId,
      driveFileId: data.id,
      module,
      originalName: file.name,
      mimeType: file.mime,
      size: file.buffer.length,
    },
  });

  return { driveFileId: data.id, url: `/api/drive/file/${data.id}` };
}

/** Stream a previously uploaded file's bytes. Looks up the owner from the
 * registry so it can use the right token. */
export async function streamFile(
  driveFileId: string,
): Promise<{ body: ArrayBuffer; mime: string } | null> {
  const record = await prisma.driveFile.findUnique({ where: { driveFileId } });
  if (!record) return null;
  const valid = await getValidConnection(record.userId);
  if (!valid) return null;

  const res = await driveFetch(
    valid.accessToken,
    `${DRIVE_API}/files/${driveFileId}?alt=media`,
  );
  if (!res.ok) return null;
  return { body: await res.arrayBuffer(), mime: record.mimeType };
}

/** Delete a file from Drive and the registry. */
export async function deleteFile(userId: string, driveFileId: string): Promise<void> {
  const valid = await getValidConnection(userId);
  if (valid) {
    await driveFetch(valid.accessToken, `${DRIVE_API}/files/${driveFileId}`, {
      method: "DELETE",
    });
  }
  await prisma.driveFile.deleteMany({ where: { driveFileId, userId } });
}
