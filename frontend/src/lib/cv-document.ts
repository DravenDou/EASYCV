import { parse, stringify } from 'yaml';

import type { CvDocument, CvFieldPath } from '@/lib/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneDocument(document: CvDocument): CvDocument {
  return JSON.parse(JSON.stringify(document)) as CvDocument;
}

function pathSegment(value: unknown, segment: string): unknown {
  if (Array.isArray(value)) return value[Number(segment)];
  if (isRecord(value)) return value[segment];
  return undefined;
}

function setPathSegment(target: unknown, segment: string, value: string): void {
  if (Array.isArray(target)) {
    target[Number(segment)] = value;
    return;
  }
  if (isRecord(target)) {
    target[segment] = value;
  }
}

export function yamlToCvDocument(yamlText: string): CvDocument | null {
  try {
    const data: unknown = parse(yamlText);
    return isRecord(data) ? (data as CvDocument) : null;
  } catch {
    return null;
  }
}

export function cvDocumentToYaml(document: CvDocument): string {
  return stringify(document, { collectionStyle: 'block', lineWidth: 0, minContentWidth: 0 });
}

export function updateCvDocumentAtPath(
  document: CvDocument,
  path: CvFieldPath,
  value: string,
): CvDocument {
  if (path.length === 0) return document;
  const nextDocument = cloneDocument(document);
  let current: unknown = nextDocument;
  for (const segment of path.slice(0, -1)) {
    current = pathSegment(current, segment);
    if (current === undefined) return document;
  }
  setPathSegment(current, path[path.length - 1], value);
  return nextDocument;
}

export function updateYamlAtPath(
  yamlText: string,
  path: CvFieldPath,
  value: string,
): string {
  const document = yamlToCvDocument(yamlText);
  if (!document) return yamlText;
  return cvDocumentToYaml(updateCvDocumentAtPath(document, path, value));
}
