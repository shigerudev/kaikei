/**
 * Stages ① + ② (owner: Jose): store the original file, then parse it into raw rows.
 * Originals are never mutated (Principle 3).
 */
import { createHash } from "node:crypto";
import { notImplemented } from "@/lib/not-implemented";

export function sha256(bytes: ArrayBuffer | Uint8Array): string {
  return createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
}

export type StoredFile =
  | { status: "new"; fileId: string }
  /** Same SHA-256 already in this workspace → "This file was already imported." */
  | { status: "already_imported"; fileId: string; importId: string | null };

/**
 * Upload the original to Vercel Blob and insert `source_files` (UNIQUE(workspace_id, sha256)).
 * TODO(Jose)
 */
export async function storeOriginal(input: {
  workspaceId: string;
  kind: "csv_budget" | "csv_actual" | "pdf";
  filename: string;
  bytes: ArrayBuffer;
}): Promise<StoredFile> {
  void input;
  return notImplemented("ingest.storeOriginal", "Jose");
}

/**
 * Parse CSV → `source_rows(file_id, row_number, raw)` (papaparse, header row = row 1).
 * Returns headers + a few sample rows for the mapping proposal.
 * TODO(Jose)
 */
export async function parseCsvToRows(fileId: string): Promise<{
  headers: string[];
  sampleRows: Record<string, string>[];
  rowCount: number;
}> {
  void fileId;
  return notImplemented("ingest.parseCsvToRows", "Jose");
}
