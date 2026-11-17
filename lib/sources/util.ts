import type { Finding, IdentifierType } from "../types";

export function mkFinding(
  sourceId: string,
  partial: Omit<Finding, "sourceId" | "collectedAt" | "confidence"> &
    Partial<Pick<Finding, "confidence" | "collectedAt">>
): Finding {
  return {
    sourceId,
    collectedAt: new Date().toISOString(),
    confidence: partial.confidence ?? 0.9,
    ...partial,
  };
}

export function entityFinding(
  sourceId: string,
  key: string,
  label: string,
  value: string,
  entityType: IdentifierType,
  confidence = 0.8,
  sourceUrl?: string
): Finding {
  return {
    sourceId,
    key,
    label,
    value,
    entityType,
    confidence,
    sourceUrl,
    collectedAt: new Date().toISOString(),
  };
}
