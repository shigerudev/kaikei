/**
 * Stage ③a–③c column mapping (owner: Hugo). Produces K2.
 * Order: deterministic header heuristics first → LLM fallback ONLY for unresolved fields
 * (cut-list item 3: heuristics-only must still work).
 */
import { z } from "zod";
import { suggest } from "@/lib/ai/suggest";
import {
  MappingField,
  MappingProposal,
  type MappingProposal as MappingProposalType,
} from "@/lib/types";
import { CATEGORY_ALIASES, fieldForHeader, normalizeHeader } from "./synonyms";

export type MappingInput = {
  workspaceId: string;
  importId: string;
  headers: string[];
  sampleRows: Record<string, string>[];
};

const LlmFieldFill = z.object({
  assignments: z.array(
    z.object({
      column: z.string(),
      field: MappingField,
      confidence: z.number().min(0).max(1),
    }),
  ),
});

function samplesFor(header: string, rows: Record<string, string>[]): string[] {
  return rows
    .map((r) => r[header])
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .slice(0, 3);
}

function guessImportType(
  headers: string[],
  mapped: Partial<Record<MappingField, string>>,
): MappingProposalType["type"] {
  const hasDate = Boolean(mapped.date);
  const hasPeriod = Boolean(mapped.period);
  // period-only + no dates → budget (SCOPE Phase 1)
  if (hasPeriod && !hasDate) return "budget";
  const joined = headers.map(normalizeHeader).join(" ");
  if (/\bpresupuesto|budget\b/.test(joined)) return "budget";
  return "actual";
}

/**
 * ES/EN header synonyms. Also guesses Budget vs Actual.
 */
export function proposeByHeuristics(input: MappingInput): MappingProposalType {
  const fields: MappingProposalType["fields"] = {};
  const claimed = new Map<MappingField, string[]>();

  for (const header of input.headers) {
    const field = fieldForHeader(header);
    if (!field) continue;
    const list = claimed.get(field) ?? [];
    list.push(header);
    claimed.set(field, list);
  }

  const ambiguous: MappingProposalType["ambiguous"] = [];

  for (const [field, columns] of claimed) {
    if (columns.length === 1) {
      const column = columns[0]!;
      fields[field] = {
        column,
        confidence: 0.95,
        samples: samplesFor(column, input.sampleRows),
      };
    } else {
      ambiguous.push({ field, candidates: columns });
    }
  }

  const type = guessImportType(
    input.headers,
    Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v!.column]),
    ) as Partial<Record<MappingField, string>>,
  );

  return MappingProposal.parse({ type, fields, ambiguous });
}

/**
 * LLM fallback through `suggest()` for fields the heuristics left unresolved.
 * Returns the heuristic proposal unchanged when AI is off or the suggestion is rejected.
 */
export async function proposeMapping(
  input: MappingInput,
): Promise<MappingProposalType> {
  const base = proposeByHeuristics(input);
  const assignedColumns = new Set(
    Object.values(base.fields).map((f) => f!.column),
  );
  const unresolved = input.headers.filter((h) => !assignedColumns.has(h));
  const takenFields = new Set(Object.keys(base.fields) as MappingField[]);

  if (unresolved.length === 0) return base;

  const suggestion = await suggest({
    workspaceId: input.workspaceId,
    capability: "column_mapping",
    targetRef: `import:${input.importId}`,
    promptVersion: "mapping.v1",
    system:
      "Map unresolved CSV headers to canonical fields. Only use columns and fields listed. Prefer leaving a header unmapped over inventing a field.",
    data: {
      headers: input.headers,
      unresolved,
      availableFields: MappingField.options.filter((f) => !takenFields.has(f)),
      samples: Object.fromEntries(
        unresolved.map((h) => [h, samplesFor(h, input.sampleRows)]),
      ),
    },
    schema: LlmFieldFill,
    checkReal: (proposed) => {
      for (const a of proposed.assignments) {
        if (!unresolved.includes(a.column)) {
          return `unknown column ${a.column}`;
        }
        if (takenFields.has(a.field)) {
          return `field already mapped ${a.field}`;
        }
        if (!MappingField.options.includes(a.field)) {
          return `invalid field ${a.field}`;
        }
      }
      return null;
    },
  });

  if (!suggestion) return base;

  const next = structuredClone(base);
  for (const a of suggestion.proposed.assignments) {
    if (next.fields[a.field]) continue;
    next.fields[a.field] = {
      column: a.column,
      confidence: Math.min(a.confidence, 0.7),
      samples: samplesFor(a.column, input.sampleRows),
    };
    // LLM-sourced → force owner review via ambiguous if confidence low
    if (a.confidence < 0.85) {
      next.ambiguous.push({
        field: a.field,
        candidates: [a.column],
      });
    }
  }
  return MappingProposal.parse(next);
}

/** Map raw category text to a workspace category via aliases ("entregas" ↔ Deliveries). */
export async function resolveCategory(
  workspaceId: string,
  raw: string,
): Promise<{ categoryId: string | null; confidence: number; name: string | null }> {
  void workspaceId;
  const key = normalizeHeader(raw);
  const name = CATEGORY_ALIASES[key] ?? null;
  if (name) return { categoryId: null, confidence: 0.95, name };
  return { categoryId: null, confidence: 0, name: null };
}
