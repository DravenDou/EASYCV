/**
 * Pure YAML transformation utilities used by CV form components.
 *
 * Why pure functions?
 * - Testable without mounting React components.
 * - No side effects — always take text in, return text out.
 * - Shared between the visual editor and the raw YAML editor.
 */
import { parse, stringify } from 'yaml';

import { getTemplateById } from '@/constants/templates';
import type {
  EntryTemplateId,
  ExperienceEntryForm,
  PersonalFieldKey,
  PreviewProfile,
  SocialNetworkKey,
} from '@/lib/types';

// ─── Primitive helpers ────────────────────────────────────────────────────────

export function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stringValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export function highlightsToText(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.map((item) => stringValue(item)).filter(Boolean).join('\n');
}

export function textToHighlights(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

export function cleanYamlScalar(value: string): string {
  const trimmed = value.trim();
  const hasDouble = trimmed.startsWith('"') && trimmed.endsWith('"');
  const hasSingle = trimmed.startsWith("'") && trimmed.endsWith("'");
  if ((hasDouble || hasSingle) && trimmed.length >= 2) return trimmed.slice(1, -1);
  return trimmed;
}

export function serializeYamlScalar(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '""';
  if (/[:#,[\]{}]|^\s|\s$/.test(trimmed)) return `"${trimmed.replaceAll('"', '\\"')}"`;
  return trimmed;
}

export function stringifyYamlData(data: unknown): string {
  return stringify(data, { collectionStyle: 'block', lineWidth: 0, minContentWidth: 0 });
}

// ─── Parse / section helpers ──────────────────────────────────────────────────

export function parseYamlRecord(yamlText: string): Record<string, unknown> | null {
  try {
    const data: unknown = parse(yamlText);
    return isRecordLike(data) ? data : null;
  } catch {
    return null;
  }
}

export function getCvSections(data: Record<string, unknown>): Record<string, unknown> | null {
  const cv = data.cv;
  if (!isRecordLike(cv)) return null;
  const sections = cv.sections;
  return isRecordLike(sections) ? sections : null;
}

export function ensureCvSections(data: Record<string, unknown>): Record<string, unknown> {
  if (!isRecordLike(data.cv)) data.cv = {};
  const cv = data.cv as Record<string, unknown>;
  if (!isRecordLike(cv.sections)) cv.sections = {};
  return cv.sections as Record<string, unknown>;
}

export function isExperienceSectionTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  return t === 'experience' || t === 'experiencia';
}

// ─── Entry inference ──────────────────────────────────────────────────────────

export function inferTemplateIdFromEntry(entry: unknown): EntryTemplateId | null {
  if (typeof entry === 'string') return 'text';
  if (!isRecordLike(entry)) return null;
  if ('company' in entry || 'position' in entry) return 'experience';
  if ('institution' in entry || 'degree' in entry || 'area' in entry) return 'education';
  if ('title' in entry || 'authors' in entry || 'doi' in entry) return 'publication';
  if ('bullet' in entry) return 'bullet';
  if ('number' in entry) return 'numbered';
  if ('reversed_number' in entry) return 'reversedNumbered';
  if ('label' in entry || 'details' in entry) return 'oneLine';
  if ('name' in entry) return 'normal';
  return null;
}

export function inferSectionTemplateId(sectionValue: unknown): EntryTemplateId | null {
  if (!Array.isArray(sectionValue)) return null;
  for (const entry of sectionValue) {
    const id = inferTemplateIdFromEntry(entry);
    if (id) return id;
  }
  return null;
}

export function isSectionCompatibleWithTemplate(
  sectionValue: unknown,
  templateId: EntryTemplateId,
): boolean {
  if (!Array.isArray(sectionValue) || sectionValue.length === 0) return true;
  return inferSectionTemplateId(sectionValue) === templateId;
}

// ─── Structured entry builder ─────────────────────────────────────────────────

export function buildStructuredEntry(templateId: EntryTemplateId): unknown {
  const template = getTemplateById(templateId);
  const normalized = template
    .buildEntry()
    .split('\n')
    .map((line) => line.replace(/^ {6}/, ''))
    .join('\n');
  const parsed = parse(`entries:\n${normalized.replace(/^/gm, '  ')}`);
  if (isRecordLike(parsed) && Array.isArray(parsed.entries)) return parsed.entries[0] ?? '';
  return '';
}

export function resolveEntryDestinationSection(
  yamlText: string,
  selectedSection: string,
  newSectionTitle: string,
  templateId: EntryTemplateId,
): string {
  const custom = newSectionTitle.trim();
  if (custom) return custom;
  const data = parseYamlRecord(yamlText);
  const sections = data ? getCvSections(data) : null;
  const sectionValue = sections?.[selectedSection];
  if (selectedSection && isSectionCompatibleWithTemplate(sectionValue, templateId)) {
    return selectedSection;
  }
  return getTemplateById(templateId).sectionTitle;
}

// ─── Personal field read/write ────────────────────────────────────────────────

export function extractCvValue(yamlText: string, field: PersonalFieldKey): string {
  const re = new RegExp(`^\\s{2}${field}:[^\\S\\r\\n]*(.*)$`, 'm');
  const match = yamlText.match(re);
  return match?.[1] ? cleanYamlScalar(match[1]) : '';
}

export function updateCvValue(yamlText: string, field: PersonalFieldKey, value: string): string {
  const serialized = serializeYamlScalar(value);
  const re = new RegExp(`^(\\s{2}${field}:[^\\S\\r\\n]*).*$`, 'm');
  if (re.test(yamlText)) {
    return yamlText.replace(re, (_m, prefix: string) => `${prefix}${serialized}`);
  }
  return yamlText.replace(/^cv:\s*$/m, `cv:\n  ${field}: ${serialized}`);
}

// ─── Social network read/write ────────────────────────────────────────────────

export function extractSocialUsername(yamlText: string, network: SocialNetworkKey): string {
  const lines = yamlText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s{4}-\s+network:[^\S\r\n]*(.*)$/);
    if (!m || cleanYamlScalar(m[1]) !== network) continue;
    const ul = lines.slice(i + 1, i + 5).find((l) => /^\s{6}username:[^\S\r\n]*/.test(l));
    const um = ul?.match(/^\s{6}username:[^\S\r\n]*(.*)$/);
    return um?.[1] ? cleanYamlScalar(um[1]) : '';
  }
  return '';
}

function findNextCvFieldLine(lines: string[], startIndex: number): number {
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (/^\s{2}[A-Za-z_][\w-]*:[^\S\r\n]*/.test(lines[i])) return i;
  }
  return lines.length;
}

export function updateSocialUsername(
  yamlText: string,
  network: SocialNetworkKey,
  value: string,
): string {
  const lines = yamlText.split('\n');
  const serialized = serializeYamlScalar(value);
  const socialIdx = lines.findIndex((l) => /^\s{2}social_networks:\s*$/.test(l));

  if (socialIdx === -1) {
    const sectionIdx = lines.findIndex((l) => /^\s{2}sections:\s*$/.test(l));
    const insertIdx =
      sectionIdx === -1 ? lines.findIndex((l) => /^cv:\s*$/.test(l)) + 1 : sectionIdx;
    lines.splice(
      Math.max(insertIdx, 1),
      0,
      '  social_networks:',
      `    - network: "${network}"`,
      `      username: ${serialized}`,
    );
    return lines.join('\n');
  }

  const endIdx = findNextCvFieldLine(lines, socialIdx);
  for (let i = socialIdx + 1; i < endIdx; i++) {
    const m = lines[i].match(/^\s{4}-\s+network:[^\S\r\n]*(.*)$/);
    if (!m || cleanYamlScalar(m[1]) !== network) continue;
    for (let ui = i + 1; ui < Math.min(i + 5, endIdx); ui++) {
      if (/^\s{6}username:[^\S\r\n]*/.test(lines[ui])) {
        lines[ui] = `      username: ${serialized}`;
        return lines.join('\n');
      }
    }
    lines.splice(i + 1, 0, `      username: ${serialized}`);
    return lines.join('\n');
  }

  lines.splice(endIdx, 0, `    - network: "${network}"`, `      username: ${serialized}`);
  return lines.join('\n');
}

// ─── Section titles extraction ────────────────────────────────────────────────

export function extractSectionTitles(yamlText: string): string[] {
  const lines = yamlText.split('\n');
  const si = lines.findIndex((l) => /^\s{2}sections:\s*$/.test(l));
  if (si === -1) return [];

  const titles = new Set<string>();
  for (let i = si + 1; i < lines.length; i++) {
    if (/^\S/.test(lines[i]) || /^\s{2}[A-Za-z_][\w-]*:[^\S\r\n]*/.test(lines[i])) break;
    const m = lines[i].match(/^\s{4}(.+):\s*$/);
    if (m) {
      const title = cleanYamlScalar(m[1]);
      if (title && !['highlights', 'summary', 'authors'].includes(title)) titles.add(title);
    }
  }
  return Array.from(titles);
}

// ─── Insert entry ─────────────────────────────────────────────────────────────

function findDocumentBlockInsertIndex(lines: string[]): number {
  const i = lines.findIndex((l, idx) => idx > 0 && /^(design|locale|settings):\s*$/.test(l));
  return i === -1 ? lines.length : i;
}

function ensureSectionsBlock(yamlText: string): string {
  if (/^\s{2}sections:\s*$/m.test(yamlText)) return yamlText;
  const lines = yamlText.trimEnd().split('\n');
  const insertIdx = findDocumentBlockInsertIndex(lines);
  lines.splice(insertIdx, 0, '  sections:');
  return lines.join('\n');
}

function sectionLineIndex(lines: string[], title: string): number {
  return lines.findIndex((l) => {
    const m = l.match(/^\s{4}(.+):\s*$/);
    return Boolean(m && cleanYamlScalar(m[1]) === title);
  });
}

function sectionEndLineIndex(lines: string[], startIdx: number): number {
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (
      /^\s{4}\S.*:\s*$/.test(lines[i]) ||
      /^\S/.test(lines[i]) ||
      /^\s{2}\S.*:\s*$/.test(lines[i])
    ) return i;
  }
  return lines.length;
}

export function insertEntryTemplate(
  yamlText: string,
  sectionTitle: string,
  templateId: EntryTemplateId,
): string {
  const template = getTemplateById(templateId);
  const safeTitle = sectionTitle.trim() || template.sectionTitle;
  const data = parseYamlRecord(yamlText);

  if (data) {
    const sections = ensureCvSections(data);
    const sectionValue = sections[safeTitle];
    const entry = buildStructuredEntry(templateId);
    if (Array.isArray(sectionValue)) {
      sectionValue.push(entry);
    } else {
      sections[safeTitle] = [entry];
    }
    return stringifyYamlData(data);
  }

  const prepared = ensureSectionsBlock(yamlText);
  const lines = prepared.trimEnd().split('\n');
  const existingIdx = sectionLineIndex(lines, safeTitle);

  if (existingIdx === -1) {
    const insertIdx = findDocumentBlockInsertIndex(lines);
    lines.splice(insertIdx, 0, `    ${serializeYamlScalar(safeTitle)}:`, ...template.buildEntry().split('\n'));
    return `${lines.join('\n')}\n`;
  }

  lines.splice(sectionEndLineIndex(lines, existingIdx), 0, ...template.buildEntry().split('\n'));
  return `${lines.join('\n')}\n`;
}

// ─── Experience entries ───────────────────────────────────────────────────────

export function extractExperienceEntries(yamlText: string): ExperienceEntryForm[] {
  const data = parseYamlRecord(yamlText);
  if (!data) return [];
  const sections = getCvSections(data);
  if (!sections) return [];

  const entries: ExperienceEntryForm[] = [];
  Object.entries(sections).forEach(([sectionTitle, sectionValue]) => {
    if (!isExperienceSectionTitle(sectionTitle) || !Array.isArray(sectionValue)) return;
    sectionValue.forEach((entry, index) => {
      if (!isRecordLike(entry)) return;
      entries.push({
        sectionTitle,
        index,
        company: stringValue(entry.company),
        position: stringValue(entry.position),
        location: stringValue(entry.location),
        start_date: stringValue(entry.start_date),
        end_date: stringValue(entry.end_date),
        highlightsText: highlightsToText(entry.highlights),
      });
    });
  });
  return entries;
}

export function updateExperienceEntry(
  yamlText: string,
  sectionTitle: string,
  entryIndex: number,
  updates: Partial<Omit<ExperienceEntryForm, 'sectionTitle' | 'index'>>,
): string {
  const data = parseYamlRecord(yamlText);
  if (!data) return yamlText;
  const sections = getCvSections(data);
  if (!sections) return yamlText;
  const sv = sections[sectionTitle];
  if (!Array.isArray(sv) || !isRecordLike(sv[entryIndex])) return yamlText;
  const entry = sv[entryIndex];
  if (updates.company !== undefined) entry.company = updates.company;
  if (updates.position !== undefined) entry.position = updates.position;
  if (updates.location !== undefined) entry.location = updates.location;
  if (updates.start_date !== undefined) entry.start_date = updates.start_date;
  if (updates.end_date !== undefined) entry.end_date = updates.end_date;
  if (updates.highlightsText !== undefined) entry.highlights = textToHighlights(updates.highlightsText);
  return stringifyYamlData(data);
}

export function updateSectionEntryField(
  yamlText: string,
  sectionTitle: string,
  entryIndex: number,
  fieldKey: string,
  value: string,
): string {
  const data = parseYamlRecord(yamlText);
  if (!data) return yamlText;
  const sections = getCvSections(data);
  if (!sections) return yamlText;
  const sv = sections[sectionTitle];
  if (!Array.isArray(sv)) return yamlText;

  if (fieldKey === '$text') {
    sv[entryIndex] = value;
    return stringifyYamlData(data);
  }

  const entry = sv[entryIndex];
  if (!isRecordLike(entry)) return yamlText;

  if (fieldKey === 'highlightsText') {
    entry.highlights = textToHighlights(value);
  } else if (fieldKey === 'authorsText') {
    entry.authors = textToHighlights(value);
  } else {
    entry[fieldKey] = value;
  }
  return stringifyYamlData(data);
}

// ─── Preview profile ──────────────────────────────────────────────────────────

function extractFirstPosition(yamlText: string): string {
  const m = yamlText.match(/^\s{8}position:[^\S\r\n]*(.*)$/m);
  return m?.[1] ? cleanYamlScalar(m[1]) : 'Candidata profesional';
}

export function buildPreviewProfile(yamlText: string): PreviewProfile {
  return {
    name: extractCvValue(yamlText, 'name') || 'Ana García',
    location: extractCvValue(yamlText, 'location') || 'Ubicación',
    email: extractCvValue(yamlText, 'email') || 'correo@dominio.com',
    phone: extractCvValue(yamlText, 'phone') || '+00 000 000 000',
    website: extractCvValue(yamlText, 'website') || 'portfolio.example.com',
    position: extractFirstPosition(yamlText),
  };
}

// ─── Artifact href ────────────────────────────────────────────────────────────

export function artifactHref(artifact: { encoding: string; media_type: string; content: string }): string {
  if (artifact.encoding === 'base64') return `data:${artifact.media_type};base64,${artifact.content}`;
  return `data:${artifact.media_type};charset=utf-8,${encodeURIComponent(artifact.content)}`;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export type ChipTone = 'default' | 'accent' | 'success' | 'warning' | 'danger';
import type { RenderStatus, ValidationStatus } from '@/lib/types';

export function chipColorForValidation(status: ValidationStatus): ChipTone {
  switch (status) {
    case 'valid': return 'success';
    case 'invalid': return 'warning';
    case 'error': return 'danger';
    case 'validating': return 'accent';
    default: return 'default';
  }
}

export function chipColorForRender(status: RenderStatus): ChipTone {
  switch (status) {
    case 'ready': return 'success';
    case 'rendering': return 'accent';
    case 'error': return 'danger';
    default: return 'default';
  }
}

export function statusLabelForValidation(status: ValidationStatus): string {
  switch (status) {
    case 'valid': return 'YAML válido';
    case 'invalid': return 'Revisar YAML';
    case 'validating': return 'Validando';
    case 'error': return 'Error de validación';
    default: return 'Sin validar';
  }
}

export function statusLabelForRender(status: RenderStatus): string {
  switch (status) {
    case 'ready': return 'Vista lista';
    case 'rendering': return 'Renderizando';
    case 'error': return 'Error al renderizar';
    default: return 'Sin render';
  }
}
