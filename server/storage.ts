// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import { ENV } from './_core/env';
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function hasRemoteStorageConfig(): boolean {
  return Boolean((ENV.forgeApiUrl ?? "").trim() && (ENV.forgeApiKey ?? "").trim());
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function getLocalStorageRoot(): string {
  return path.resolve(process.cwd(), "local-storage");
}

function toLocalStoragePath(relKey: string): string {
  const root = getLocalStorageRoot();
  const normalized = normalizeKey(relKey).replace(/\.\./g, "");
  const resolved = path.resolve(root, normalized);
  if (!(resolved === root || resolved.startsWith(`${root}${path.sep}`))) {
    throw new Error("Invalid local storage path");
  }
  return resolved;
}

export function resolveLocalStorageReference(fileKey?: string | null, fileUrl?: string | null): string | null {
  if (typeof fileKey === "string" && fileKey.startsWith("local:")) {
    return normalizeKey(fileKey.slice("local:".length));
  }
  if (typeof fileUrl === "string" && fileUrl.startsWith("local-file://")) {
    return normalizeKey(fileUrl.slice("local-file://".length));
  }
  return null;
}

export async function storageReadLocal(relKey: string): Promise<Buffer> {
  const targetPath = toLocalStoragePath(relKey);
  return await readFile(targetPath);
}

export async function storageDeleteByReference(fileKey?: string | null, fileUrl?: string | null): Promise<void> {
  const localRef = resolveLocalStorageReference(fileKey, fileUrl);
  if (!localRef) {
    // Remote deletion is intentionally skipped here because not all storage backends expose a delete API.
    return;
  }
  try {
    const targetPath = toLocalStoragePath(localRef);
    await unlink(targetPath);
  } catch (error: any) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (!hasRemoteStorageConfig()) {
    const key = normalizeKey(relKey);
    const targetPath = toLocalStoragePath(key);
    await mkdir(path.dirname(targetPath), { recursive: true });
    const bytes = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    await writeFile(targetPath, bytes);
    return {
      key: `local:${key}`,
      url: `local-file://${key}`,
    };
  }

  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}
