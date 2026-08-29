import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../env.js";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB decoded - a viewport JPEG capture, generously bounded

let ensured = false;
async function ensureDir(): Promise<void> {
  if (ensured) return;
  await mkdir(env.SCREENSHOT_DIR, { recursive: true });
  ensured = true;
}

/** Accepts a `data:image/...;base64,...` URL and stores the decoded bytes. Returns the filename. */
export async function saveScreenshot(dataUrl: string): Promise<string> {
  const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("unsupported screenshot format");
  const [, ext, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_BYTES) throw new Error("screenshot too large");

  await ensureDir();
  const filename = `${randomUUID()}.${ext === "jpeg" ? "jpg" : ext}`;
  await writeFile(path.join(env.SCREENSHOT_DIR, filename), buffer);
  return filename;
}

export async function readScreenshot(filename: string): Promise<Buffer> {
  await ensureDir();
  return readFile(path.join(env.SCREENSHOT_DIR, safeName(filename)));
}

export async function deleteScreenshot(filename: string): Promise<void> {
  await ensureDir();
  await unlink(path.join(env.SCREENSHOT_DIR, safeName(filename))).catch(() => undefined);
}

function safeName(filename: string): string {
  if (filename.includes("/") || filename.includes("..")) {
    throw new Error("invalid screenshot filename");
  }
  return filename;
}
