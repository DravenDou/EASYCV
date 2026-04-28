'use client';

import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { lintGutter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { parse, stringify } from 'yaml';

import {
  Button,
  Chip,
  Input,
  Label,
  ScrollShadow,
  Switch,
  Tabs,
  TextArea,
  TextField,
  Tooltip,
} from '@heroui/react';
import {
  Award,
  BookOpen,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  GraduationCap,
  Hash,
  ImageIcon,
  ListPlus,
  Loader2,
  Mail,
  MapPin,
  Moon,
  Palette,
  Phone,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  TerminalSquare,
  Type,
  UserRound,
  Users,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';

import {
  RenderCvApiError,
  createRendercvClient,
  type RenderFormats,
  type RenderRequestOptions,
  type RenderResponsePayload,
  type RenderedArtifact,
} from '@/lib/rendercv-api';

const defaultApiBaseUrl =
  process.env.NEXT_PUBLIC_RENDERCV_API_BASE_URL ?? '/rendercv-api';

const renderFormats: RenderFormats = {
  include_pdf: true,
  include_png: true,
  include_html: true,
  include_markdown: true,
  include_typst: true,
};

const spanishLocaleYaml = `locale:
  language: spanish
`;

const fallbackYaml = `cv:
  name: "Ana García"
  location: "Madrid, España"
  email: "ana.garcia@email.com"
  phone: "+34 600 000 000"
  website: "https://portfolio.example.com"
  social_networks:
    - network: "LinkedIn"
      username: "janedoe"
    - network: "GitHub"
      username: "janedoe"
  sections:
    Resumen:
      - Ingeniera de software con experiencia construyendo productos web, automatizando flujos de trabajo y manteniendo documentación técnica clara.
    Experiencia:
      - company: Atlas Labs
        position: Ingeniera de producto
        location: Remoto
        start_date: 2024-01
        end_date: present
        highlights:
          - Diseñé una interfaz para editar CVs en YAML y generar PDFs listos para enviar.
          - Conecté validación en vivo, previsualización HTML y exportación de artefactos.
          - Organicé plantillas y ajustes para mantener contenido, diseño e idioma separados.
    Proyectos:
      - name: CV como código
        highlights:
          - Flujo versionable con YAML, Typst y salida PDF consistente.
          - Variantes rápidas para postulaciones, becas y perfiles académicos.
`;

type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid' | 'error';
type RenderStatus = 'idle' | 'rendering' | 'ready' | 'error';
type ChipTone = 'default' | 'accent' | 'success' | 'warning' | 'danger';
type PersonalFieldKey = 'name' | 'headline' | 'location' | 'email' | 'phone' | 'website';
type TemplateStatus = 'Activo' | 'Borrador' | 'Nuevo';
type SocialNetworkKey = 'LinkedIn' | 'GitHub';
type EntryTemplateId =
  | 'text'
  | 'experience'
  | 'education'
  | 'normal'
  | 'publication'
  | 'bullet'
  | 'numbered'
  | 'reversedNumbered'
  | 'oneLine';
type ThemeId =
  | 'classic'
  | 'moderncv'
  | 'sb2nov'
  | 'engineeringresumes'
  | 'engineeringclassic'
  | 'harvard'
  | 'ink'
  | 'opal'
  | 'ember';

type WorkspacePanelProps = {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

type ToolButtonProps = {
  label: string;
  icon: LucideIcon;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger';
  isDisabled?: boolean;
  onPress?: () => void;
};

type TemplateCard = {
  id: ThemeId;
  name: string;
  status: TemplateStatus;
  accentClassName: string;
  description: string;
};

type PersonalField = {
  key: PersonalFieldKey;
  label: string;
  placeholder: string;
  icon: LucideIcon;
  type?: string;
};

type SocialField = {
  network: SocialNetworkKey;
  label: string;
  placeholder: string;
  icon: LucideIcon;
};

type ExperienceEntryForm = {
  sectionTitle: string;
  index: number;
  company: string;
  position: string;
  location: string;
  start_date: string;
  end_date: string;
  highlightsText: string;
};

type EntryTemplate = {
  id: EntryTemplateId;
  label: string;
  sectionTitle: string;
  description: string;
  icon: LucideIcon;
  buildEntry: () => string;
};

type PreviewProfile = {
  name: string;
  location: string;
  email: string;
  phone: string;
  website: string;
  position: string;
};

const personalFields: PersonalField[] = [
  {
    key: 'name',
    label: 'Nombre',
    placeholder: 'Tu nombre completo',
    icon: UserRound,
  },
  {
    key: 'headline',
    label: 'Titular',
    placeholder: 'Rol principal o propuesta profesional',
    icon: Sparkles,
  },
  {
    key: 'location',
    label: 'Ubicación',
    placeholder: 'Ciudad, país',
    icon: MapPin,
  },
  {
    key: 'email',
    label: 'Correo',
    placeholder: 'correo@dominio.com',
    icon: Mail,
    type: 'email',
  },
  {
    key: 'phone',
    label: 'Teléfono',
    placeholder: '+00 000 000 000',
    icon: Phone,
    type: 'tel',
  },
  {
    key: 'website',
    label: 'Sitio web',
    placeholder: 'https://',
    icon: ExternalLink,
    type: 'url',
  },
];

const socialFields: SocialField[] = [
  {
    network: 'LinkedIn',
    label: 'LinkedIn',
    placeholder: 'usuario-linkedin',
    icon: Users,
  },
  {
    network: 'GitHub',
    label: 'GitHub',
    placeholder: 'usuario-github',
    icon: Code2,
  },
];

const entryTemplates: EntryTemplate[] = [
  {
    id: 'text',
    label: 'Texto',
    sectionTitle: 'Resumen',
    description: 'Párrafo o viñeta simple para resumen, perfil o introducción.',
    icon: Type,
    buildEntry: () =>
      '      - Resume tu perfil, especialidad y el valor que aportas en 2 o 3 líneas.',
  },
  {
    id: 'experience',
    label: 'Experiencia',
    sectionTitle: 'Experiencia',
    description: 'Empresa, cargo, fechas, ubicación y logros medibles.',
    icon: BriefcaseBusiness,
    buildEntry: () => `      - company: Empresa
        position: Cargo
        location: Ciudad o remoto
        start_date: 2024-01
        end_date: present
        highlights:
          - Describe un logro medible o una responsabilidad clave.
          - Incluye tecnología, impacto o alcance cuando sea relevante.`,
  },
  {
    id: 'education',
    label: 'Educación',
    sectionTitle: 'Educación',
    description: 'Institución, área, título, fechas y detalles académicos.',
    icon: GraduationCap,
    buildEntry: () => `      - institution: Universidad o institución
        area: Área de estudio
        degree: Título
        location: Ciudad
        start_date: 2020-01
        end_date: 2024-12
        highlights:
          - Curso, distinción o proyecto académico relevante.`,
  },
  {
    id: 'normal',
    label: 'Proyectos',
    sectionTitle: 'Proyectos',
    description: 'Proyecto, evento, premio o elemento con nombre y logros.',
    icon: BookOpen,
    buildEntry: () => `      - name: Nombre del proyecto
        location: Remoto
        date: 2025
        highlights:
          - Explica el problema, tu rol y el resultado.
          - Menciona stack, métricas o usuarios si aplica.`,
  },
  {
    id: 'publication',
    label: 'Publicaciones',
    sectionTitle: 'Publicaciones',
    description: 'Título, autores, revista/conferencia, fecha y DOI.',
    icon: FileText,
    buildEntry: () => `      - title: Título de la publicación
        authors:
          - "*Tu Nombre*"
          - Coautor
        journal: Revista o conferencia
        date: 2025-01
        doi: 10.0000/example`,
  },
  {
    id: 'bullet',
    label: 'Reconocimientos',
    sectionTitle: 'Reconocimientos',
    description: 'Premios, certificaciones o reconocimientos breves.',
    icon: Award,
    buildEntry: () => '      - bullet: Premio, certificación o reconocimiento relevante.',
  },
  {
    id: 'numbered',
    label: 'Logros',
    sectionTitle: 'Logros',
    description: 'Resultados ordenados por prioridad o secuencia.',
    icon: Hash,
    buildEntry: () => '      - number: Logro o resultado ordenado por prioridad.',
  },
  {
    id: 'reversedNumbered',
    label: 'Charlas',
    sectionTitle: 'Charlas',
    description: 'Ponencias, charlas o actividades recientes.',
    icon: ListPlus,
    buildEntry: () => '      - reversed_number: Charla, ponencia o actividad reciente.',
  },
  {
    id: 'oneLine',
    label: 'Habilidades',
    sectionTitle: 'Habilidades',
    description: 'Categorías con detalles breves en una sola línea.',
    icon: ListPlus,
    buildEntry: () => `      - label: Lenguajes
        details: Python, TypeScript, SQL`,
  },
];

const templateCards: TemplateCard[] = [
  {
    id: 'classic',
    name: 'Classic',
    status: 'Activo',
    accentClassName: 'bg-accent',
    description: 'Tipografía sobria para perfiles académicos y técnicos.',
  },
  {
    id: 'moderncv',
    name: 'ModernCV',
    status: 'Activo',
    accentClassName: 'bg-warning',
    description: 'Cabecera visual y estructura moderna de dos columnas.',
  },
  {
    id: 'sb2nov',
    name: 'SB2Nov',
    status: 'Activo',
    accentClassName: 'bg-success',
    description: 'Formato compacto optimizado para ATS y reclutadores.',
  },
  {
    id: 'engineeringresumes',
    name: 'Engineering Resumes',
    status: 'Activo',
    accentClassName: 'bg-success',
    description: 'Estilo técnico directo con alta densidad de contenido.',
  },
  {
    id: 'engineeringclassic',
    name: 'Engineering Classic',
    status: 'Activo',
    accentClassName: 'bg-success',
    description: 'Variante clásica enfocada en ingeniería y proyectos.',
  },
  {
    id: 'harvard',
    name: 'Harvard',
    status: 'Activo',
    accentClassName: 'bg-danger',
    description: 'Diseño formal para carrera académica y publicaciones.',
  },
  {
    id: 'ink',
    name: 'Ink',
    status: 'Nuevo',
    accentClassName: 'bg-foreground',
    description: 'Composición limpia con énfasis editorial.',
  },
  {
    id: 'opal',
    name: 'Opal',
    status: 'Nuevo',
    accentClassName: 'bg-accent',
    description: 'Presentación suave con detalles contemporáneos.',
  },
  {
    id: 'ember',
    name: 'Ember',
    status: 'Nuevo',
    accentClassName: 'bg-warning',
    description: 'Contraste cálido para perfiles con narrativa visual.',
  },
];

function buildDesignYaml(themeId: ThemeId): string {
  return `design:
  theme: ${themeId}
`;
}

function buildRenderOptions(themeId: ThemeId): RenderRequestOptions {
  return {
    designYaml: buildDesignYaml(themeId),
    localeYaml: spanishLocaleYaml,
  };
}

function themeById(themeId: ThemeId): TemplateCard {
  return templateCards.find((template) => template.id === themeId) ?? templateCards[0];
}

function chipColorForValidation(status: ValidationStatus): ChipTone {
  switch (status) {
    case 'valid':
      return 'success';
    case 'invalid':
      return 'warning';
    case 'error':
      return 'danger';
    case 'validating':
      return 'accent';
    case 'idle':
    default:
      return 'default';
  }
}

function chipColorForRender(status: RenderStatus): ChipTone {
  switch (status) {
    case 'ready':
      return 'success';
    case 'rendering':
      return 'accent';
    case 'error':
      return 'danger';
    case 'idle':
    default:
      return 'default';
  }
}

function statusLabelForValidation(status: ValidationStatus): string {
  switch (status) {
    case 'valid':
      return 'YAML válido';
    case 'invalid':
      return 'Revisar YAML';
    case 'validating':
      return 'Validando';
    case 'error':
      return 'Error de validación';
    case 'idle':
    default:
      return 'Sin validar';
  }
}

function statusLabelForRender(status: RenderStatus): string {
  switch (status) {
    case 'ready':
      return 'Vista lista';
    case 'rendering':
      return 'Renderizando';
    case 'error':
      return 'Error al renderizar';
    case 'idle':
    default:
      return 'Sin render';
  }
}

function artifactHref(artifact: RenderedArtifact): string {
  if (artifact.encoding === 'base64') {
    return `data:${artifact.media_type};base64,${artifact.content}`;
  }

  return `data:${artifact.media_type};charset=utf-8,${encodeURIComponent(artifact.content)}`;
}

function cleanYamlScalar(value: string): string {
  const trimmedValue = value.trim();
  const hasDoubleQuotes = trimmedValue.startsWith('"') && trimmedValue.endsWith('"');
  const hasSingleQuotes = trimmedValue.startsWith("'") && trimmedValue.endsWith("'");

  if ((hasDoubleQuotes || hasSingleQuotes) && trimmedValue.length >= 2) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue;
}

function serializeYamlScalar(value: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return '""';
  }

  if (/[:#,[\]{}]|^\s|\s$/.test(trimmedValue)) {
    return `"${trimmedValue.replaceAll('"', '\\"')}"`;
  }

  return trimmedValue;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringifyYamlData(data: unknown): string {
  return stringify(data, {
    collectionStyle: 'block',
    lineWidth: 0,
    minContentWidth: 0,
  });
}

function getTemplateById(templateId: EntryTemplateId): EntryTemplate {
  return entryTemplates.find((entryTemplate) => entryTemplate.id === templateId) ?? entryTemplates[0];
}

function parseYamlRecord(yamlText: string): Record<string, unknown> | null {
  try {
    const data: unknown = parse(yamlText);
    return isRecordLike(data) ? data : null;
  } catch {
    return null;
  }
}

function getCvSections(data: Record<string, unknown>): Record<string, unknown> | null {
  const cv = data.cv;
  if (!isRecordLike(cv)) {
    return null;
  }

  const sections = cv.sections;
  return isRecordLike(sections) ? sections : null;
}

function ensureCvSections(data: Record<string, unknown>): Record<string, unknown> {
  if (!isRecordLike(data.cv)) {
    data.cv = {};
  }

  const cv = data.cv as Record<string, unknown>;
  if (!isRecordLike(cv.sections)) {
    cv.sections = {};
  }

  return cv.sections as Record<string, unknown>;
}

function isExperienceSectionTitle(title: string): boolean {
  const normalizedTitle = title.trim().toLowerCase();
  return normalizedTitle === 'experience' || normalizedTitle === 'experiencia';
}

function stringValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function highlightsToText(value: unknown): string {
  if (!Array.isArray(value)) {
    return '';
  }

  return value.map((item) => stringValue(item)).filter(Boolean).join('\n');
}

function textToHighlights(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildStructuredEntry(template: EntryTemplate): unknown {
  const normalizedEntryYaml = template
    .buildEntry()
    .split('\n')
    .map((line) => line.replace(/^ {6}/, ''))
    .join('\n');
  const parsedEntryBlock = parse(`entries:\n${normalizedEntryYaml.replace(/^/gm, '  ')}`);

  if (isRecordLike(parsedEntryBlock) && Array.isArray(parsedEntryBlock.entries)) {
    return parsedEntryBlock.entries[0] ?? '';
  }

  return '';
}

function inferTemplateIdFromEntry(entry: unknown): EntryTemplateId | null {
  if (typeof entry === 'string') {
    return 'text';
  }

  if (!isRecordLike(entry)) {
    return null;
  }

  if ('company' in entry || 'position' in entry) {
    return 'experience';
  }
  if ('institution' in entry || 'degree' in entry || 'area' in entry) {
    return 'education';
  }
  if ('title' in entry || 'authors' in entry || 'doi' in entry) {
    return 'publication';
  }
  if ('bullet' in entry) {
    return 'bullet';
  }
  if ('number' in entry) {
    return 'numbered';
  }
  if ('reversed_number' in entry) {
    return 'reversedNumbered';
  }
  if ('label' in entry || 'details' in entry) {
    return 'oneLine';
  }
  if ('name' in entry) {
    return 'normal';
  }

  return null;
}

function inferSectionTemplateId(sectionValue: unknown): EntryTemplateId | null {
  if (!Array.isArray(sectionValue)) {
    return null;
  }

  for (const entry of sectionValue) {
    const inferredTemplateId = inferTemplateIdFromEntry(entry);
    if (inferredTemplateId) {
      return inferredTemplateId;
    }
  }

  return null;
}

function isSectionCompatibleWithTemplate(sectionValue: unknown, templateId: EntryTemplateId): boolean {
  if (!Array.isArray(sectionValue) || sectionValue.length === 0) {
    return true;
  }

  return inferSectionTemplateId(sectionValue) === templateId;
}

function resolveEntryDestinationSection(
  yamlText: string,
  selectedSection: string,
  newSectionTitle: string,
  template: EntryTemplate,
): string {
  const customSectionTitle = newSectionTitle.trim();
  if (customSectionTitle) {
    return customSectionTitle;
  }

  const data = parseYamlRecord(yamlText);
  const sections = data ? getCvSections(data) : null;
  const selectedSectionValue = sections?.[selectedSection];

  if (selectedSection && isSectionCompatibleWithTemplate(selectedSectionValue, template.id)) {
    return selectedSection;
  }

  return template.sectionTitle;
}

function extractExperienceEntries(yamlText: string): ExperienceEntryForm[] {
  const data = parseYamlRecord(yamlText);
  if (!data) {
    return [];
  }

  const sections = getCvSections(data);
  if (!sections) {
    return [];
  }

  const entries: ExperienceEntryForm[] = [];
  Object.entries(sections).forEach(([sectionTitle, sectionValue]) => {
    if (!isExperienceSectionTitle(sectionTitle) || !Array.isArray(sectionValue)) {
      return;
    }

    sectionValue.forEach((entry, index) => {
      if (!isRecordLike(entry)) {
        return;
      }

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

function updateExperienceEntry(
  yamlText: string,
  sectionTitle: string,
  entryIndex: number,
  updates: Partial<Omit<ExperienceEntryForm, 'sectionTitle' | 'index'>>,
): string {
  const data = parseYamlRecord(yamlText);
  if (!data) {
    return yamlText;
  }

  const sections = getCvSections(data);
  if (!sections) {
    return yamlText;
  }

  const sectionValue = sections[sectionTitle];
  if (!Array.isArray(sectionValue) || !isRecordLike(sectionValue[entryIndex])) {
    return yamlText;
  }

  const entry = sectionValue[entryIndex];
  if (updates.company !== undefined) {
    entry.company = updates.company;
  }
  if (updates.position !== undefined) {
    entry.position = updates.position;
  }
  if (updates.location !== undefined) {
    entry.location = updates.location;
  }
  if (updates.start_date !== undefined) {
    entry.start_date = updates.start_date;
  }
  if (updates.end_date !== undefined) {
    entry.end_date = updates.end_date;
  }
  if (updates.highlightsText !== undefined) {
    entry.highlights = textToHighlights(updates.highlightsText);
  }

  return stringifyYamlData(data);
}

function updateSectionEntryField(
  yamlText: string,
  sectionTitle: string,
  entryIndex: number,
  fieldKey: string,
  value: string,
): string {
  const data = parseYamlRecord(yamlText);
  if (!data) {
    return yamlText;
  }

  const sections = getCvSections(data);
  if (!sections) {
    return yamlText;
  }

  const sectionValue = sections[sectionTitle];
  if (!Array.isArray(sectionValue)) {
    return yamlText;
  }

  if (fieldKey === '$text') {
    sectionValue[entryIndex] = value;
    return stringifyYamlData(data);
  }

  const entry = sectionValue[entryIndex];
  if (!isRecordLike(entry)) {
    return yamlText;
  }

  if (fieldKey === 'highlightsText') {
    entry.highlights = textToHighlights(value);
  } else if (fieldKey === 'authorsText') {
    entry.authors = textToHighlights(value);
  } else {
    entry[fieldKey] = value;
  }

  return stringifyYamlData(data);
}

function extractCvValue(yamlText: string, field: PersonalFieldKey): string {
  const fieldExpression = new RegExp(`^\\s{2}${field}:[^\\S\\r\\n]*(.*)$`, 'm');
  const match = yamlText.match(fieldExpression);

  return match?.[1] ? cleanYamlScalar(match[1]) : '';
}

function updateCvValue(yamlText: string, field: PersonalFieldKey, value: string): string {
  const serializedValue = serializeYamlScalar(value);
  const fieldExpression = new RegExp(`^(\\s{2}${field}:[^\\S\\r\\n]*).*$`, 'm');

  if (fieldExpression.test(yamlText)) {
    return yamlText.replace(fieldExpression, (matchText: string, prefix: string) => {
      void matchText;
      return `${prefix}${serializedValue}`;
    });
  }

  return yamlText.replace(/^cv:\s*$/m, `cv:\n  ${field}: ${serializedValue}`);
}

function extractSocialUsername(yamlText: string, network: SocialNetworkKey): string {
  const lines = yamlText.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const networkMatch = lines[index].match(/^\s{4}-\s+network:[^\S\r\n]*(.*)$/);
    if (!networkMatch || cleanYamlScalar(networkMatch[1]) !== network) {
      continue;
    }

    const usernameLine = lines
      .slice(index + 1, index + 5)
      .find((line) => /^\s{6}username:[^\S\r\n]*/.test(line));
    const usernameMatch = usernameLine?.match(/^\s{6}username:[^\S\r\n]*(.*)$/);
    return usernameMatch?.[1] ? cleanYamlScalar(usernameMatch[1]) : '';
  }

  return '';
}

function findNextCvFieldLine(lines: string[], startIndex: number): number {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (/^\s{2}[A-Za-z_][\w-]*:[^\S\r\n]*/.test(lines[index])) {
      return index;
    }
  }

  return lines.length;
}

function updateSocialUsername(
  yamlText: string,
  network: SocialNetworkKey,
  value: string,
): string {
  const lines = yamlText.split('\n');
  const serializedValue = serializeYamlScalar(value);
  const socialIndex = lines.findIndex((line) => /^\s{2}social_networks:\s*$/.test(line));

  if (socialIndex === -1) {
    const sectionIndex = lines.findIndex((line) => /^\s{2}sections:\s*$/.test(line));
    const insertIndex = sectionIndex === -1 ? lines.findIndex((line) => /^cv:\s*$/.test(line)) + 1 : sectionIndex;

    lines.splice(
      Math.max(insertIndex, 1),
      0,
      '  social_networks:',
      `    - network: "${network}"`,
      `      username: ${serializedValue}`,
    );
    return lines.join('\n');
  }

  const endIndex = findNextCvFieldLine(lines, socialIndex);
  for (let index = socialIndex + 1; index < endIndex; index += 1) {
    const networkMatch = lines[index].match(/^\s{4}-\s+network:[^\S\r\n]*(.*)$/);
    if (!networkMatch || cleanYamlScalar(networkMatch[1]) !== network) {
      continue;
    }

    for (let usernameIndex = index + 1; usernameIndex < Math.min(index + 5, endIndex); usernameIndex += 1) {
      if (/^\s{6}username:[^\S\r\n]*/.test(lines[usernameIndex])) {
        lines[usernameIndex] = `      username: ${serializedValue}`;
        return lines.join('\n');
      }
    }

    lines.splice(index + 1, 0, `      username: ${serializedValue}`);
    return lines.join('\n');
  }

  lines.splice(endIndex, 0, `    - network: "${network}"`, `      username: ${serializedValue}`);
  return lines.join('\n');
}

function extractSectionTitles(yamlText: string): string[] {
  const lines = yamlText.split('\n');
  const sectionsIndex = lines.findIndex((line) => /^\s{2}sections:\s*$/.test(line));
  if (sectionsIndex === -1) {
    return [];
  }

  const titles = new Set<string>();
  for (let index = sectionsIndex + 1; index < lines.length; index += 1) {
    if (/^\S/.test(lines[index]) || /^\s{2}[A-Za-z_][\w-]*:[^\S\r\n]*/.test(lines[index])) {
      break;
    }

    const match = lines[index].match(/^\s{4}(.+):\s*$/);
    if (match) {
      const title = cleanYamlScalar(match[1]);
      if (title && !['highlights', 'summary', 'authors'].includes(title)) {
        titles.add(title);
      }
    }
  }

  return Array.from(titles);
}

function findDocumentBlockInsertIndex(lines: string[]): number {
  const topLevelIndex = lines.findIndex((line, index) => index > 0 && /^(design|locale|settings):\s*$/.test(line));
  return topLevelIndex === -1 ? lines.length : topLevelIndex;
}

function ensureSectionsBlock(yamlText: string): string {
  if (/^\s{2}sections:\s*$/m.test(yamlText)) {
    return yamlText;
  }

  const lines = yamlText.trimEnd().split('\n');
  const insertIndex = findDocumentBlockInsertIndex(lines);
  lines.splice(insertIndex, 0, '  sections:');
  return lines.join('\n');
}

function sectionLineIndex(lines: string[], sectionTitle: string): number {
  return lines.findIndex((line) => {
    const match = line.match(/^\s{4}(.+):\s*$/);
    return Boolean(match && cleanYamlScalar(match[1]) === sectionTitle);
  });
}

function sectionEndLineIndex(lines: string[], startIndex: number): number {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (/^\s{4}\S.*:\s*$/.test(lines[index]) || /^\S/.test(lines[index]) || /^\s{2}\S.*:\s*$/.test(lines[index])) {
      return index;
    }
  }

  return lines.length;
}

function insertEntryTemplate(
  yamlText: string,
  sectionTitle: string,
  templateId: EntryTemplateId,
): string {
  const template = getTemplateById(templateId);
  const safeSectionTitle = sectionTitle.trim() || template.sectionTitle;
  const data = parseYamlRecord(yamlText);

  if (data) {
    const sections = ensureCvSections(data);
    const sectionValue = sections[safeSectionTitle];
    const nextEntry = buildStructuredEntry(template);

    if (Array.isArray(sectionValue)) {
      sectionValue.push(nextEntry);
    } else {
      sections[safeSectionTitle] = [nextEntry];
    }

    return stringifyYamlData(data);
  }

  const preparedYaml = ensureSectionsBlock(yamlText);
  const lines = preparedYaml.trimEnd().split('\n');
  const existingSectionIndex = sectionLineIndex(lines, safeSectionTitle);

  if (existingSectionIndex === -1) {
    const insertIndex = findDocumentBlockInsertIndex(lines);
    lines.splice(
      insertIndex,
      0,
      `    ${serializeYamlScalar(safeSectionTitle)}:`,
      ...template.buildEntry().split('\n'),
    );
    return `${lines.join('\n')}\n`;
  }

  lines.splice(sectionEndLineIndex(lines, existingSectionIndex), 0, ...template.buildEntry().split('\n'));
  return `${lines.join('\n')}\n`;
}

function extractFirstPosition(yamlText: string): string {
  const match = yamlText.match(/^\s{8}position:[^\S\r\n]*(.*)$/m);

  return match?.[1] ? cleanYamlScalar(match[1]) : 'Candidata profesional';
}

function buildPreviewProfile(yamlText: string): PreviewProfile {
  return {
    name: extractCvValue(yamlText, 'name') || 'Ana García',
    location: extractCvValue(yamlText, 'location') || 'Ubicación',
    email: extractCvValue(yamlText, 'email') || 'correo@dominio.com',
    phone: extractCvValue(yamlText, 'phone') || '+00 000 000 000',
    website: extractCvValue(yamlText, 'website') || 'portfolio.example.com',
    position: extractFirstPosition(yamlText),
  };
}

function formatNumber(value: number): string {
  return value.toLocaleString('es-ES');
}

function downloadArtifact(artifact: RenderedArtifact): void {
  const link = document.createElement('a');
  link.href = artifactHref(artifact);
  link.download = artifact.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadArtifacts(artifacts: RenderedArtifact[]): void {
  artifacts.forEach((artifact) => {
    downloadArtifact(artifact);
  });
}

function WorkspacePanel({
  title,
  eyebrow,
  actions,
  children,
  className = '',
}: WorkspacePanelProps) {
  return (
    <section
      className={`animate-panel-in flex min-w-0 flex-col rounded-[20px] border border-border bg-surface shadow-surface ${className}`}
    >
      <header className="flex min-h-14 flex-col justify-between gap-3 border-b border-separator px-4 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-semibold text-muted">{eyebrow}</p> : null}
          <h2 className="mt-1 truncate text-base font-semibold text-foreground">{title}</h2>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

function ToolButton({ label, icon: Icon, variant = 'tertiary', isDisabled, onPress }: ToolButtonProps) {
  return (
    <Tooltip delay={0}>
      <Button
        aria-label={label}
        className="shrink-0"
        isDisabled={isDisabled}
        isIconOnly
        size="sm"
        variant={variant}
        onPress={onPress}
      >
        <Icon aria-hidden="true" className="size-4" />
      </Button>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

function DownloadButton({
  label,
  artifacts,
  compactLabel,
  icon: Icon,
}: {
  label: string;
  artifacts: RenderedArtifact[];
  compactLabel: string;
  icon: LucideIcon;
}) {
  return (
    <Tooltip delay={0}>
      <Button
        aria-label={label}
        isDisabled={artifacts.length === 0}
        size="sm"
        variant="outline"
        onPress={() => downloadArtifacts(artifacts)}
      >
        <Icon aria-hidden="true" className="size-4" />
        <span className="hidden xl:inline">{compactLabel}</span>
      </Button>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  const isDarkTheme = mounted ? resolvedTheme !== 'light' : true;
  const label = isDarkTheme ? 'Tema oscuro' : 'Tema claro';

  return (
    <Tooltip delay={0}>
      <Switch
        aria-label="Cambiar tema visual"
        isSelected={isDarkTheme}
        size="sm"
        onChange={(isSelected) => {
          setTheme(isSelected ? 'dark' : 'light');
        }}
      >
        {({ isSelected }) => (
          <Switch.Control
            className={`h-9 w-16 rounded-full border border-border-tertiary transition-colors ${
              isSelected ? 'bg-accent' : 'bg-surface-tertiary'
            }`}
          >
            <Switch.Thumb
              className={`size-8 rounded-full transition-[margin,transform] ${
                isSelected ? 'ms-7 bg-accent-foreground' : 'ms-0.5 bg-foreground'
              }`}
            >
              <Switch.Icon>
                {isSelected ? (
                  <Moon aria-hidden="true" className="size-4 text-accent" />
                ) : (
                  <Sun aria-hidden="true" className="size-4 text-background" />
                )}
              </Switch.Icon>
            </Switch.Thumb>
          </Switch.Control>
        )}
      </Switch>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

function Sidebar({ sampleStatus, onLoadSample }: { sampleStatus: string; onLoadSample: () => void }) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-separator bg-background-secondary lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-separator px-5">
        <div className="grid size-9 place-items-center rounded-[12px] border border-accent/25 bg-accent-soft text-accent">
          <FileText aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">CV Studio</p>
          <p className="truncate text-xs text-muted">Editor web</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4">
        <div className="rounded-[20px] border border-border bg-surface px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Archivo actual</p>
          <p className="mt-2 truncate text-sm font-semibold text-foreground">cv.yaml</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{sampleStatus}</p>
        </div>
      </div>

      <div className="border-t border-separator p-4">
        <Button fullWidth size="sm" variant="secondary" onPress={onLoadSample}>
          <RefreshCcw aria-hidden="true" className="size-4" />
          Cargar muestra
        </Button>
      </div>
    </aside>
  );
}

function TopBar({
  validationStatus,
  renderStatus,
  renderDisabled,
  artifacts,
  onLoadSample,
  onRender,
  onCopyYaml,
}: {
  validationStatus: ValidationStatus;
  renderStatus: RenderStatus;
  renderDisabled: boolean;
  artifacts: RenderedArtifact[];
  onLoadSample: () => void;
  onRender: () => void;
  onCopyYaml: () => void;
}) {
  const pdfArtifacts = artifacts.filter((artifact) => artifact.format === 'pdf');
  const htmlArtifacts = artifacts.filter((artifact) => artifact.format === 'html');
  const pngArtifactsForDownload = artifacts.filter((artifact) => artifact.format === 'png');
  const typstArtifacts = artifacts.filter((artifact) => artifact.format === 'typst');
  const markdownArtifacts = artifacts.filter((artifact) => artifact.format === 'markdown');

  return (
    <header className="sticky top-0 z-40 flex min-h-16 flex-col gap-2 border-b border-separator bg-background/95 px-3 py-2 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-0 lg:pl-4">
      <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
        <div className="grid size-10 shrink-0 place-items-center rounded-[14px] border border-accent/25 bg-accent-soft text-accent lg:hidden">
          <FileText aria-hidden="true" className="size-5" />
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Chip color={chipColorForValidation(validationStatus)} size="sm" variant="soft">
            {statusLabelForValidation(validationStatus)}
          </Chip>
          <Chip color={chipColorForRender(renderStatus)} size="sm" variant="soft">
            {statusLabelForRender(renderStatus)}
          </Chip>
        </div>
        <div className="min-w-0 sm:hidden">
          <p className="truncate text-sm font-semibold text-foreground">CV Studio</p>
          <p className="truncate text-xs text-muted">{statusLabelForRender(renderStatus)}</p>
        </div>
        <div className="sm:hidden">
          <ThemeToggle />
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 sm:justify-end sm:overflow-visible sm:pb-0">
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <div className="hidden items-center gap-1 md:flex">
          <ToolButton icon={Copy} label="Copiar YAML" onPress={onCopyYaml} />
        </div>
        <Button className="shrink-0" size="sm" variant="secondary" onPress={onLoadSample}>
          <FolderOpen aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Muestra</span>
        </Button>
        <Button
          className="shrink-0"
          isDisabled={renderDisabled}
          isPending={renderStatus === 'rendering'}
          size="sm"
          variant="primary"
          onPress={onRender}
        >
          {renderStatus === 'rendering' ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Sparkles aria-hidden="true" className="size-4" />
          )}
          <span>{renderStatus === 'rendering' ? 'Renderizando' : 'Renderizar'}</span>
        </Button>
        <div className="flex shrink-0 items-center gap-1">
          <DownloadButton artifacts={pdfArtifacts} compactLabel="PDF" icon={FileText} label="Descargar PDF" />
          <DownloadButton artifacts={htmlArtifacts} compactLabel="HTML" icon={Code2} label="Descargar HTML" />
          <DownloadButton artifacts={pngArtifactsForDownload} compactLabel="PNG" icon={ImageIcon} label="Descargar PNG" />
          <DownloadButton artifacts={typstArtifacts} compactLabel="Typst" icon={TerminalSquare} label="Descargar Typst" />
          <DownloadButton artifacts={markdownArtifacts} compactLabel="MD" icon={Type} label="Descargar Markdown" />
        </div>
      </div>
    </header>
  );
}

function PersonalInfoForm({
  yamlText,
  onFieldChange,
}: {
  yamlText: string;
  onFieldChange: (field: PersonalFieldKey, value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {personalFields.map((field) => {
        const Icon = field.icon;
        return (
          <TextField fullWidth key={field.key} name={field.key} type={field.type ?? 'text'}>
            <Label className="text-xs font-semibold text-muted">{field.label}</Label>
            <div className="relative">
              <Icon
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                className="pl-9"
                placeholder={field.placeholder}
                value={extractCvValue(yamlText, field.key)}
                variant="secondary"
                onChange={(event) => onFieldChange(field.key, event.target.value)}
              />
            </div>
          </TextField>
        );
      })}
    </div>
  );
}

function SocialNetworksForm({
  yamlText,
  onSocialFieldChange,
}: {
  yamlText: string;
  onSocialFieldChange: (network: SocialNetworkKey, value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {socialFields.map((field) => {
        const Icon = field.icon;
        return (
          <TextField fullWidth key={field.network} name={field.network}>
            <Label className="text-xs font-semibold text-muted">{field.label}</Label>
            <div className="relative">
              <Icon
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                className="pl-9"
                placeholder={field.placeholder}
                value={extractSocialUsername(yamlText, field.network)}
                variant="secondary"
                onChange={(event) => onSocialFieldChange(field.network, event.target.value)}
              />
            </div>
          </TextField>
        );
      })}
    </div>
  );
}

function ExperienceEntriesForm({
  yamlText,
  onExperienceEntryChange,
  onInsertEntry,
}: {
  yamlText: string;
  onExperienceEntryChange: (
    sectionTitle: string,
    index: number,
    updates: Partial<Omit<ExperienceEntryForm, 'sectionTitle' | 'index'>>,
  ) => void;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
}) {
  const experienceEntries = extractExperienceEntries(yamlText);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground" id="experience-info-heading">
            Experiencia
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Edita empresas, cargos, fechas y logros sin tocar el YAML manualmente.
          </p>
        </div>
        <Button size="sm" variant="secondary" onPress={() => onInsertEntry('Experiencia', 'experience')}>
          <Plus aria-hidden="true" className="size-4" />
          Agregar
        </Button>
      </div>

      {experienceEntries.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-border bg-surface-secondary p-4">
          <p className="text-sm font-semibold text-foreground">No hay entradas de experiencia.</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Agrega una entrada para empezar a editarla desde el formulario.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {experienceEntries.map((entry) => (
            <div
              className="rounded-[20px] border border-border bg-surface-secondary p-4"
              key={`${entry.sectionTitle}-${entry.index}`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {entry.company || 'Nueva experiencia'}
                  </p>
                  <p className="truncate text-xs text-muted">{entry.position || 'Cargo por definir'}</p>
                </div>
                <Chip color="default" size="sm" variant="soft">
                  #{entry.index + 1}
                </Chip>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextField fullWidth name={`company-${entry.index}`}>
                  <Label className="text-xs font-semibold text-muted">Empresa</Label>
                  <Input
                    value={entry.company}
                    variant="secondary"
                    onChange={(event) =>
                      onExperienceEntryChange(entry.sectionTitle, entry.index, {
                        company: event.target.value,
                      })
                    }
                  />
                </TextField>
                <TextField fullWidth name={`position-${entry.index}`}>
                  <Label className="text-xs font-semibold text-muted">Cargo</Label>
                  <Input
                    value={entry.position}
                    variant="secondary"
                    onChange={(event) =>
                      onExperienceEntryChange(entry.sectionTitle, entry.index, {
                        position: event.target.value,
                      })
                    }
                  />
                </TextField>
                <TextField fullWidth name={`location-${entry.index}`}>
                  <Label className="text-xs font-semibold text-muted">Ubicación</Label>
                  <Input
                    value={entry.location}
                    variant="secondary"
                    onChange={(event) =>
                      onExperienceEntryChange(entry.sectionTitle, entry.index, {
                        location: event.target.value,
                      })
                    }
                  />
                </TextField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField fullWidth name={`start-date-${entry.index}`}>
                    <Label className="text-xs font-semibold text-muted">Inicio</Label>
                    <Input
                      placeholder="2024-01"
                      value={entry.start_date}
                      variant="secondary"
                      onChange={(event) =>
                        onExperienceEntryChange(entry.sectionTitle, entry.index, {
                          start_date: event.target.value,
                        })
                      }
                    />
                  </TextField>
                  <TextField fullWidth name={`end-date-${entry.index}`}>
                    <Label className="text-xs font-semibold text-muted">Fin</Label>
                    <Input
                      placeholder="present"
                      value={entry.end_date}
                      variant="secondary"
                      onChange={(event) =>
                        onExperienceEntryChange(entry.sectionTitle, entry.index, {
                          end_date: event.target.value,
                        })
                      }
                    />
                  </TextField>
                </div>
              </div>

              <TextField fullWidth className="mt-4" name={`highlights-${entry.index}`}>
                <Label className="text-xs font-semibold text-muted">Logros</Label>
                <TextArea
                  className="min-h-28 resize-y font-mono text-[13px] leading-5"
                  rows={5}
                  value={entry.highlightsText}
                  variant="secondary"
                  onChange={(event) =>
                    onExperienceEntryChange(entry.sectionTitle, entry.index, {
                      highlightsText: event.target.value,
                    })
                  }
                />
              </TextField>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function YamlEditor({
  yamlText,
  yamlLineCount,
  onYamlChange,
  onInsertEntry,
}: {
  yamlText: string;
  yamlLineCount: number;
  onYamlChange: (value: string) => void;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const extensions = useMemo(() => [yaml(), lintGutter()], []);
  const editorTheme = !mounted || resolvedTheme !== 'light' ? oneDark : 'light';

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  const editorHeight = 'min(560px, 62dvh)';

  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-field-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator px-3 py-2">
        <div className="flex items-center gap-2">
          <TerminalSquare aria-hidden="true" className="size-4 text-accent" />
          <span className="text-xs font-semibold text-foreground">cv.yaml</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="default" size="sm" variant="soft">
            {formatNumber(yamlLineCount)} líneas
          </Chip>
          <Chip color="default" size="sm" variant="soft">
            {formatNumber(yamlText.length)} caracteres
          </Chip>
          <Button size="sm" variant="tertiary" onPress={() => onInsertEntry('Experiencia', 'experience')}>
            <BriefcaseBusiness aria-hidden="true" className="size-4" />
            Experiencia
          </Button>
          <Button size="sm" variant="tertiary" onPress={() => onInsertEntry('Educación', 'education')}>
            <GraduationCap aria-hidden="true" className="size-4" />
            Educación
          </Button>
          <Button size="sm" variant="tertiary" onPress={() => onInsertEntry('Proyectos', 'normal')}>
            <Plus aria-hidden="true" className="size-4" />
            Proyecto
          </Button>
        </div>
      </div>
      <div className="min-h-[420px] overflow-hidden sm:min-h-[560px]">
        <CodeMirror
          aria-label="YAML del CV"
          basicSetup={{
            autocompletion: true,
            bracketMatching: true,
            closeBrackets: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            lineNumbers: true,
            searchKeymap: true,
          }}
          className="cv-code-editor"
          extensions={extensions}
          height={editorHeight}
          placeholder="Pega aquí tu YAML del CV..."
          theme={editorTheme}
          value={yamlText}
          onChange={onYamlChange}
        />
      </div>
    </div>
  );
}

function SectionTextInput({
  label,
  name,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField fullWidth name={name}>
      <Label className="text-xs font-semibold text-muted">{label}</Label>
      <Input
        placeholder={placeholder}
        value={value}
        variant="secondary"
        onChange={(event) => onChange(event.target.value)}
      />
    </TextField>
  );
}

function SectionTextArea({
  label,
  name,
  value,
  placeholder,
  rows = 4,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <TextField fullWidth name={name}>
      <Label className="text-xs font-semibold text-muted">{label}</Label>
      <TextArea
        className="min-h-24 resize-y text-sm leading-6"
        placeholder={placeholder}
        rows={rows}
        value={value}
        variant="secondary"
        onChange={(event) => onChange(event.target.value)}
      />
    </TextField>
  );
}

function SectionEntryEditor({
  sectionTitle,
  entry,
  entryIndex,
  templateId,
  onEntryChange,
}: {
  sectionTitle: string;
  entry: unknown;
  entryIndex: number;
  templateId: EntryTemplateId;
  onEntryChange: (sectionTitle: string, entryIndex: number, fieldKey: string, value: string) => void;
}) {
  const updateField = (fieldKey: string, value: string): void => {
    onEntryChange(sectionTitle, entryIndex, fieldKey, value);
  };
  const entryRecord = isRecordLike(entry) ? entry : {};
  const fieldName = (fieldKey: string): string => `${sectionTitle}-${entryIndex}-${fieldKey}`;
  const input = (fieldKey: string, label: string, placeholder?: string): ReactNode => (
    <SectionTextInput
      key={fieldKey}
      label={label}
      name={fieldName(fieldKey)}
      placeholder={placeholder}
      value={stringValue(entryRecord[fieldKey])}
      onChange={(value) => updateField(fieldKey, value)}
    />
  );
  const highlightsInput = (
    <SectionTextArea
      label="Logros o detalles"
      name={fieldName('highlightsText')}
      placeholder="Una línea por logro o detalle"
      value={highlightsToText(entryRecord.highlights)}
      onChange={(value) => updateField('highlightsText', value)}
    />
  );

  if (templateId === 'text') {
    return (
      <SectionTextArea
        label="Texto"
        name={fieldName('text')}
        rows={5}
        value={stringValue(entry)}
        onChange={(value) => updateField('$text', value)}
      />
    );
  }

  if (templateId === 'experience') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {input('company', 'Empresa', 'Nombre de la empresa')}
        {input('position', 'Cargo', 'Cargo o rol')}
        {input('location', 'Ubicación', 'Ciudad o remoto')}
        <div className="grid gap-3 sm:grid-cols-2">
          {input('start_date', 'Inicio', '2024-01')}
          {input('end_date', 'Fin', 'present')}
        </div>
        <div className="md:col-span-2">{highlightsInput}</div>
      </div>
    );
  }

  if (templateId === 'education') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {input('institution', 'Institución', 'Universidad o institución')}
        {input('area', 'Área', 'Área de estudio')}
        {input('degree', 'Título', 'Título obtenido')}
        {input('location', 'Ubicación', 'Ciudad')}
        <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
          {input('start_date', 'Inicio', '2020-01')}
          {input('end_date', 'Fin', '2024-12')}
        </div>
        <div className="md:col-span-2">{highlightsInput}</div>
      </div>
    );
  }

  if (templateId === 'normal') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {input('name', 'Nombre', 'Nombre del proyecto')}
        {input('location', 'Ubicación', 'Remoto')}
        {input('date', 'Fecha', '2025')}
        <div className="md:col-span-2">{highlightsInput}</div>
      </div>
    );
  }

  if (templateId === 'publication') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {input('title', 'Título', 'Título de la publicación')}
        {input('journal', 'Revista o conferencia')}
        {input('date', 'Fecha', '2025-01')}
        {input('doi', 'DOI')}
        <div className="md:col-span-2">
          <SectionTextArea
            label="Autores"
            name={fieldName('authorsText')}
            placeholder="Un autor por línea"
            value={highlightsToText(entryRecord.authors)}
            onChange={(value) => updateField('authorsText', value)}
          />
        </div>
      </div>
    );
  }

  if (templateId === 'bullet') {
    return input('bullet', 'Viñeta', 'Premio, certificación o reconocimiento');
  }

  if (templateId === 'numbered') {
    return input('number', 'Elemento numerado', 'Logro o resultado');
  }

  if (templateId === 'reversedNumbered') {
    return input('reversed_number', 'Elemento inverso', 'Charla, ponencia o actividad');
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {input('label', 'Etiqueta', 'Lenguajes')}
      {input('details', 'Detalle', 'Python, TypeScript, SQL')}
    </div>
  );
}

function ActiveSectionEditor({
  yamlText,
  selectedSection,
  onInsertEntry,
  onEntryChange,
}: {
  yamlText: string;
  selectedSection: string;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
  onEntryChange: (sectionTitle: string, entryIndex: number, fieldKey: string, value: string) => void;
}) {
  const data = parseYamlRecord(yamlText);
  const sections = data ? getCvSections(data) : null;
  const sectionValue = selectedSection ? sections?.[selectedSection] : null;
  const entries = Array.isArray(sectionValue) ? sectionValue : [];
  const templateId = inferSectionTemplateId(entries) ?? 'text';
  const template = getTemplateById(templateId);
  const Icon = template.icon;

  if (!selectedSection) {
    return (
      <div className="rounded-[20px] border border-dashed border-border bg-surface-secondary p-4">
        <p className="text-sm font-semibold text-foreground">Ninguna sección seleccionada</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Selecciona una sección existente para editar sus entradas desde el formulario.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[20px] border border-border bg-surface-secondary p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted">Editar sección</p>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="min-w-0 text-base font-semibold text-foreground">{selectedSection}</h4>
            <Chip color="accent" size="sm" variant="soft">
              <Icon aria-hidden="true" className="size-3.5" />
              {template.label}
            </Chip>
            <Chip color="default" size="sm" variant="soft">
              {entries.length} entradas
            </Chip>
          </div>
        </div>
        <Button size="sm" variant="secondary" onPress={() => onInsertEntry(selectedSection, templateId)}>
          <Plus aria-hidden="true" className="size-4" />
          Agregar
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-border px-3 py-3 text-sm text-muted">
          Esta sección está vacía. Agrega una entrada para editarla aquí.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div className="rounded-[18px] border border-border bg-surface p-4" key={`${selectedSection}-${index}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Entrada {index + 1}</p>
                <Chip color="default" size="sm" variant="soft">
                  #{index + 1}
                </Chip>
              </div>
              <SectionEntryEditor
                entry={entry}
                entryIndex={index}
                sectionTitle={selectedSection}
                templateId={inferTemplateIdFromEntry(entry) ?? templateId}
                onEntryChange={onEntryChange}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionsBuilder({
  yamlText,
  onInsertEntry,
  onSectionEntryChange,
}: {
  yamlText: string;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
  onSectionEntryChange: (sectionTitle: string, entryIndex: number, fieldKey: string, value: string) => void;
}) {
  const sectionTitles = extractSectionTitles(yamlText);
  const [selectedSection, setSelectedSection] = useState(sectionTitles[0] ?? 'Experiencia');
  const data = parseYamlRecord(yamlText);
  const sections = data ? getCvSections(data) : null;
  const selectedSectionForInsert = sectionTitles.includes(selectedSection) ? selectedSection : '';
  const activeSectionLabel = selectedSectionForInsert || 'Destino automático';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground" id="sections-info-heading">
            Secciones y entradas
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Elige el destino y agrega bloques con una estructura lista para renderizar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="default" size="sm" variant="soft">
            {sectionTitles.length} secciones
          </Chip>
          <Chip color="default" size="sm" variant="soft">
            {activeSectionLabel}
          </Chip>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.15fr)]">
        <div className="min-w-0 space-y-3 rounded-[20px] border border-border bg-surface-secondary p-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted">Secciones existentes</p>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2 2xl:grid-cols-1">
              {sectionTitles.map((title, index) => (
                <button
                  aria-pressed={selectedSection === title}
                  className={`flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-full border px-4 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    selectedSection === title
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border bg-surface text-foreground hover:border-border-tertiary'
                  }`}
                  key={`${title}-${index}`}
                  type="button"
                  onClick={() => {
                    setSelectedSection((currentSection) => (currentSection === title ? '' : title));
                  }}
                >
                  <span className="min-w-0 truncate text-sm font-semibold">{title}</span>
                  {sections?.[title] ? (
                    <span className="shrink-0 rounded-full bg-default px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {getTemplateById(inferSectionTemplateId(sections[title]) ?? 'text').label}
                    </span>
                  ) : null}
                </button>
              ))}
              {sectionTitles.length === 0 ? (
                <p className="rounded-[16px] border border-dashed border-border px-3 py-3 text-sm text-muted">
                  Todavía no hay secciones. Usa un bloque de contenido para crear una.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <ActiveSectionEditor
          onEntryChange={onSectionEntryChange}
          onInsertEntry={onInsertEntry}
          selectedSection={selectedSectionForInsert}
          yamlText={yamlText}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Agregar contenido</h4>
            <p className="mt-1 text-sm leading-6 text-muted">
              Estos bloques crean secciones editables en el formulario y visibles en el PDF.
            </p>
          </div>
          <Chip color="default" size="sm" variant="soft">
            {entryTemplates.length} tipos
          </Chip>
        </div>
        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
          {entryTemplates.map((template) => {
            const Icon = template.icon;
            const destinationSection = resolveEntryDestinationSection(
              yamlText,
              selectedSectionForInsert,
              '',
              template,
            );
            const selectedSectionValue = selectedSectionForInsert ? sections?.[selectedSectionForInsert] : undefined;
            const usesAutomaticDestination =
              selectedSectionForInsert &&
              destinationSection !== selectedSectionForInsert &&
              !isSectionCompatibleWithTemplate(selectedSectionValue, template.id);
            return (
              <button
                aria-label={`Agregar ${template.label} en ${destinationSection}`}
                className="group flex min-h-[132px] min-w-0 flex-col items-start gap-3 rounded-[18px] border border-border bg-surface-secondary px-4 py-3 text-left transition-colors hover:border-accent/70 hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                key={template.id}
                type="button"
                onClick={() => {
                  onInsertEntry(destinationSection, template.id);
                  setSelectedSection(destinationSection);
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 text-base font-semibold leading-5 text-foreground">{template.label}</span>
                </span>
                <span className="block min-w-0 flex-1 text-sm leading-5 text-muted">{template.description}</span>
                <span className="block min-w-0 text-xs font-semibold leading-5 text-accent">
                  <span className="text-muted">Destino:</span> {destinationSection}
                </span>
                {usesAutomaticDestination ? (
                  <span className="block min-w-0 rounded-[12px] bg-warning/10 px-2.5 py-1.5 text-xs font-semibold leading-4 text-warning">
                    Se usa una sección compatible para evitar errores de render.
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EditorPanel({
  yamlText,
  yamlLineCount,
  selectedThemeId,
  onYamlChange,
  onPersonalFieldChange,
  onSocialFieldChange,
  onExperienceEntryChange,
  onSectionEntryChange,
  onInsertEntry,
  onThemeChange,
}: {
  yamlText: string;
  yamlLineCount: number;
  selectedThemeId: ThemeId;
  onYamlChange: (value: string) => void;
  onPersonalFieldChange: (field: PersonalFieldKey, value: string) => void;
  onSocialFieldChange: (network: SocialNetworkKey, value: string) => void;
  onExperienceEntryChange: (
    sectionTitle: string,
    index: number,
    updates: Partial<Omit<ExperienceEntryForm, 'sectionTitle' | 'index'>>,
  ) => void;
  onSectionEntryChange: (sectionTitle: string, entryIndex: number, fieldKey: string, value: string) => void;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
  onThemeChange: (theme: ThemeId) => void;
}) {
  const selectedTheme = themeById(selectedThemeId);

  return (
    <WorkspacePanel
      actions={
        <Chip color="accent" size="sm" variant="soft">
          {formatNumber(yamlLineCount)} líneas
        </Chip>
      }
      className="min-h-[640px] overflow-hidden xl:h-[calc(100vh-6rem)] xl:min-h-[680px]"
      eyebrow="Área principal"
      title="Contenido del CV"
    >
      <Tabs className="flex min-h-0 flex-1 flex-col" defaultSelectedKey="yaml" variant="secondary">
        <div className="border-b border-separator px-4 pt-3">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Vistas de edición">
              <Tabs.Tab id="yaml">
                <TerminalSquare aria-hidden="true" className="mr-2 size-4" />
                YAML
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="formulario">
                <ClipboardCheck aria-hidden="true" className="mr-2 size-4" />
                Formulario
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="diseno">
                <Palette aria-hidden="true" className="mr-2 size-4" />
                Diseño
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </div>

        <Tabs.Panel className="min-h-0 p-3 sm:p-4" id="yaml">
          <YamlEditor
            onInsertEntry={onInsertEntry}
            onYamlChange={onYamlChange}
            yamlLineCount={yamlLineCount}
            yamlText={yamlText}
          />
        </Tabs.Panel>

        <Tabs.Panel className="min-h-0 flex-1 overflow-hidden p-0" id="formulario">
          <ScrollShadow className="max-h-[720px] p-3 sm:p-4 xl:h-full xl:max-h-none" hideScrollBar>
            <div className="space-y-6 pb-4">
              <section aria-labelledby="personal-info-heading" className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground" id="personal-info-heading">
                    Información personal
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Datos visibles en la cabecera del CV.
                  </p>
                </div>
                <PersonalInfoForm yamlText={yamlText} onFieldChange={onPersonalFieldChange} />
              </section>

              <section aria-labelledby="social-info-heading" className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground" id="social-info-heading">
                    Redes profesionales
                  </h3>
                </div>
                <SocialNetworksForm yamlText={yamlText} onSocialFieldChange={onSocialFieldChange} />
              </section>

              <section aria-labelledby="experience-info-heading">
                <ExperienceEntriesForm
                  onExperienceEntryChange={onExperienceEntryChange}
                  onInsertEntry={onInsertEntry}
                  yamlText={yamlText}
                />
              </section>

              <section aria-labelledby="sections-info-heading">
                <SectionsBuilder
                  onInsertEntry={onInsertEntry}
                  onSectionEntryChange={onSectionEntryChange}
                  yamlText={yamlText}
                />
              </section>

              <div className="rounded-[20px] border border-border bg-surface-secondary p-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck aria-hidden="true" className="size-5 text-success" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Estructura compatible</p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      Contenido, diseño, idioma y salida en capas separadas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollShadow>
        </Tabs.Panel>

        <Tabs.Panel className="p-3 sm:p-4" id="diseno">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Tema visual</h3>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Temas reales del motor aplicados al backend.
                </p>
              </div>
              <Chip color="accent" size="sm" variant="soft">
                {selectedTheme.name}
              </Chip>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templateCards.map((template) => (
                <button
                  className={`rounded-[20px] border p-4 text-left transition duration-200 ${
                    selectedThemeId === template.id
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border bg-surface-secondary text-foreground hover:border-border-tertiary'
                  }`}
                  key={template.id}
                  type="button"
                  onClick={() => onThemeChange(template.id)}
                >
                  <span className={`mb-4 block h-1.5 w-12 rounded-full ${template.accentClassName}`} />
                  <span className="block text-sm font-semibold">{template.name}</span>
                  <span className="mt-2 block text-xs text-muted">{template.description}</span>
                  <span className="mt-3 inline-flex rounded-md bg-default px-2 py-1 text-[11px] font-semibold text-muted">
                    {template.status}
                  </span>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-border bg-surface-secondary p-4">
                <p className="text-sm font-semibold text-foreground">Idioma</p>
                <p className="mt-2 text-sm text-muted">Español</p>
              </div>
              <div className="rounded-[20px] border border-border bg-surface-secondary p-4">
                <p className="text-sm font-semibold text-foreground">Salida</p>
                <p className="mt-2 text-sm text-muted">PDF, HTML, PNG, Typst y Markdown</p>
              </div>
            </div>
          </div>
        </Tabs.Panel>
      </Tabs>
    </WorkspacePanel>
  );
}

function MockCvPreview({ profile }: { profile: PreviewProfile }) {
  return (
    <article className="mx-auto flex aspect-[1/1.414] w-full max-w-none flex-col bg-white px-10 py-11 text-slate-950 shadow-preview">
      <header className="border-b-2 border-slate-900 pb-5">
        <p className="text-[11px] font-semibold text-slate-500">CV generado desde el editor</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">{profile.name}</h1>
        <p className="mt-2 text-sm text-slate-600">{profile.position}</p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
          <span>{profile.location}</span>
          <span>{profile.email}</span>
          <span>{profile.phone}</span>
          <span>{profile.website}</span>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="border-b border-slate-300 pb-1 text-xs font-bold text-slate-900">
          Resumen
        </h2>
        <p className="mt-3 text-xs leading-5 text-slate-700">
          Profesional orientada a construir CVs consistentes, fáciles de versionar y listos
          para enviar en distintos procesos de selección.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="border-b border-slate-300 pb-1 text-xs font-bold text-slate-900">
          Experiencia
        </h2>
        <div className="mt-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950">Atlas Labs</h3>
              <p className="text-xs italic text-slate-600">{profile.position}</p>
            </div>
            <p className="text-right text-[11px] text-slate-500">2024 - Presente</p>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-700">
            <li>Contenido estructurado en YAML con validación de esquema.</li>
            <li>Salida tipográfica consistente en PDF, HTML y PNG.</li>
            <li>Flujo preparado para plantillas, idiomas y variantes de candidatura.</li>
          </ul>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="border-b border-slate-300 pb-1 text-xs font-bold text-slate-900">
          Habilidades
        </h2>
        <p className="mt-3 text-xs leading-5 text-slate-700">
          YAML, Typst, documentación técnica, automatización, edición de CVs y control de
          versiones.
        </p>
      </section>
    </article>
  );
}

function PreviewPanel({
  htmlArtifact,
  pngArtifacts,
  previewScale,
  profile,
  renderStatus,
  onPreviewScaleChange,
}: {
  htmlArtifact: RenderedArtifact | undefined;
  pngArtifacts: RenderedArtifact[];
  previewScale: number;
  profile: PreviewProfile;
  renderStatus: RenderStatus;
  onPreviewScaleChange: (value: number) => void;
}) {
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const safeSelectedPageIndex = pngArtifacts.length > 0 ? Math.min(selectedPageIndex, pngArtifacts.length - 1) : 0;
  const selectedPngArtifact = pngArtifacts[safeSelectedPageIndex];
  const hasMultiplePages = pngArtifacts.length > 1;
  const previewPageWidth = Math.round(520 * previewScale);
  const previewFrameHeight = Math.round(735 * previewScale);

  return (
    <WorkspacePanel
      actions={
        <>
          {hasMultiplePages ? (
            <>
              <ToolButton
                icon={ChevronLeft}
                isDisabled={safeSelectedPageIndex === 0}
                label="Página anterior"
                onPress={() => setSelectedPageIndex(Math.max(0, safeSelectedPageIndex - 1))}
              />
              <Chip color="default" size="sm" variant="soft">
                Página {safeSelectedPageIndex + 1}/{pngArtifacts.length}
              </Chip>
              <ToolButton
                icon={ChevronRight}
                isDisabled={safeSelectedPageIndex >= pngArtifacts.length - 1}
                label="Página siguiente"
                onPress={() => setSelectedPageIndex(Math.min(pngArtifacts.length - 1, safeSelectedPageIndex + 1))}
              />
            </>
          ) : null}
          <ToolButton
            icon={ZoomOut}
            isDisabled={previewScale <= 0.6}
            label="Alejar"
            onPress={() => onPreviewScaleChange(Math.max(0.6, Number((previewScale - 0.1).toFixed(2))))}
          />
          <Chip color="default" size="sm" variant="soft">
            {Math.round(previewScale * 100)}%
          </Chip>
          <ToolButton
            icon={ZoomIn}
            isDisabled={previewScale >= 1.6}
            label="Acercar"
            onPress={() => onPreviewScaleChange(Math.min(1.6, Number((previewScale + 0.1).toFixed(2))))}
          />
        </>
      }
      className="min-h-[560px] overflow-hidden xl:min-h-[680px]"
      eyebrow="Salida"
      title="Previsualización"
    >
      <div className="h-1 bg-default">
        <div
          className={`h-full transition-all duration-500 ${
            renderStatus === 'ready'
              ? 'w-full bg-success'
              : renderStatus === 'rendering'
                ? 'w-2/3 bg-accent'
                : renderStatus === 'error'
                  ? 'w-full bg-danger'
                  : 'w-1/4 bg-warning'
          }`}
        />
      </div>
      <ScrollShadow className="h-[540px] overflow-auto bg-preview p-3 sm:p-6 xl:h-[626px]">
        <div className="animate-preview-pop min-w-fit transition-[width] duration-200">
          {selectedPngArtifact ? (
            <div className="mx-auto" style={{ width: `${previewPageWidth}px` }}>
              <Image
                alt={`Página ${safeSelectedPageIndex + 1} del CV generado`}
                className="h-auto w-full max-w-none bg-white shadow-preview"
                height={1800}
                src={artifactHref(selectedPngArtifact)}
                unoptimized
                width={1400}
              />
            </div>
          ) : htmlArtifact ? (
            <div className="mx-auto" style={{ width: `${previewPageWidth}px` }}>
              <iframe
                className="bg-white shadow-preview"
                referrerPolicy="no-referrer"
                sandbox=""
                srcDoc={htmlArtifact.content}
                style={{ height: `${previewFrameHeight}px`, width: `${previewPageWidth}px` }}
                title="Previsualización HTML del CV"
              />
            </div>
          ) : (
            <div className="mx-auto" style={{ width: `${previewPageWidth}px` }}>
              <MockCvPreview profile={profile} />
            </div>
          )}
        </div>
      </ScrollShadow>
    </WorkspacePanel>
  );
}

export default function Home() {
  const [yamlText, setYamlText] = useState(fallbackYaml);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
  const [renderResult, setRenderResult] = useState<RenderResponsePayload | null>(null);
  const [renderStatus, setRenderStatus] = useState<RenderStatus>('idle');
  const [sampleStatus, setSampleStatus] = useState('Muestra inicial cargada');
  const [sampleLoading, setSampleLoading] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.88);
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>('classic');

  const htmlArtifact = renderResult?.artifacts.find((artifact) => artifact.format === 'html');
  const pngArtifacts = renderResult?.artifacts.filter((artifact) => artifact.format === 'png') ?? [];
  const yamlLineCount = yamlText.split('\n').length;
  const previewProfile = useMemo(() => buildPreviewProfile(yamlText), [yamlText]);
  const renderOptions = useMemo(() => buildRenderOptions(selectedThemeId), [selectedThemeId]);

  const updateYamlText = (nextYaml: string): void => {
    setYamlText(nextYaml);
    if (!nextYaml.trim()) {
      setRenderResult(null);
      setRenderStatus('idle');
    }
    setValidationStatus('idle');
  };

  const updatePersonalField = (field: PersonalFieldKey, value: string): void => {
    updateYamlText(updateCvValue(yamlText, field, value));
  };

  const updateSocialField = (network: SocialNetworkKey, value: string): void => {
    updateYamlText(updateSocialUsername(yamlText, network, value));
  };

  const updateExperienceField = (
    sectionTitle: string,
    index: number,
    updates: Partial<Omit<ExperienceEntryForm, 'sectionTitle' | 'index'>>,
  ): void => {
    updateYamlText(updateExperienceEntry(yamlText, sectionTitle, index, updates));
  };

  const updateSectionField = (
    sectionTitle: string,
    entryIndex: number,
    fieldKey: string,
    value: string,
  ): void => {
    updateYamlText(updateSectionEntryField(yamlText, sectionTitle, entryIndex, fieldKey, value));
  };

  const insertEntry = (sectionTitle: string, templateId: EntryTemplateId): void => {
    updateYamlText(insertEntryTemplate(yamlText, sectionTitle, templateId));
  };

  const loadSample = async (): Promise<void> => {
    setSampleLoading(true);
    setSampleStatus('Cargando muestra...');

    try {
      const response = await fetch('/sample-cv.yaml', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`No se pudo cargar la muestra (${response.status}).`);
      }

      updateYamlText(await response.text());
      setSampleStatus('Muestra cargada desde /sample-cv.yaml');
    } catch {
      updateYamlText(fallbackYaml);
      setSampleStatus('Muestra integrada cargada');
    } finally {
      setSampleLoading(false);
    }
  };

  const renderCv = async (themeId: ThemeId = selectedThemeId): Promise<void> => {
    if (!yamlText.trim()) {
      return;
    }

    setRenderStatus('rendering');

    const client = createRendercvClient(defaultApiBaseUrl);
    const requestOptions = buildRenderOptions(themeId);

    try {
      const response = await client.render(yamlText, renderFormats, requestOptions);
      setRenderResult(response);
      setRenderStatus('ready');
    } catch (error) {
      if (error instanceof RenderCvApiError) {
        setRenderStatus('error');
        if (error.validationErrors && error.validationErrors.length > 0) {
          setValidationStatus('invalid');
        }
      } else {
        setRenderStatus('error');
      }
    }
  };

  const updateTheme = (themeId: ThemeId): void => {
    if (themeId === selectedThemeId) {
      return;
    }

    setSelectedThemeId(themeId);
    setValidationStatus('idle');
  };

  const handleRender = async (): Promise<void> => {
    await renderCv();
  };

  const handleCopyYaml = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(yamlText);
      setSampleStatus('YAML copiado al portapapeles');
    } catch {
      setSampleStatus('No se pudo copiar el YAML');
    }
  };

  useEffect(() => {
    if (!yamlText.trim()) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const client = createRendercvClient(defaultApiBaseUrl);
      setValidationStatus('validating');

      try {
        const response = await client.validate(yamlText, renderOptions, controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        setValidationStatus(response.valid ? 'valid' : 'invalid');
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof RenderCvApiError) {
          setValidationStatus('error');
        } else {
          setValidationStatus('error');
        }
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [renderOptions, yamlText]);

  useEffect(() => {
    if (!yamlText.trim()) {
      return;
    }

    const controller = new AbortController();
    const renderLatestYaml = async (): Promise<void> => {
      const client = createRendercvClient(defaultApiBaseUrl);
      setRenderStatus('rendering');

      try {
        const response = await client.render(
          yamlText,
          renderFormats,
          renderOptions,
          controller.signal,
        );
        if (controller.signal.aborted) {
          return;
        }

        setRenderResult(response);
        setRenderStatus('ready');
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setRenderStatus('error');
        if (error instanceof RenderCvApiError && error.validationErrors?.length) {
          setValidationStatus('invalid');
        }
      }
    };

    void renderLatestYaml();

    return () => {
      controller.abort();
    };
  }, [renderOptions, yamlText]);

  return (
    <main className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <div className="flex min-h-dvh">
        <Sidebar
          onLoadSample={() => {
            void loadSample();
          }}
          sampleStatus={sampleStatus}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            artifacts={renderResult?.artifacts ?? []}
            onCopyYaml={() => {
              void handleCopyYaml();
            }}
            onLoadSample={() => {
              void loadSample();
            }}
            onRender={() => {
              void handleRender();
            }}
            renderDisabled={!yamlText.trim() || sampleLoading}
            renderStatus={renderStatus}
            validationStatus={validationStatus}
          />

          <div className="min-w-0 flex-1 p-2 sm:p-4">
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(420px,0.95fr)_minmax(460px,1.05fr)]">
              <EditorPanel
                onExperienceEntryChange={updateExperienceField}
                onInsertEntry={insertEntry}
                onPersonalFieldChange={updatePersonalField}
                onSectionEntryChange={updateSectionField}
                onSocialFieldChange={updateSocialField}
                onThemeChange={updateTheme}
                onYamlChange={updateYamlText}
                selectedThemeId={selectedThemeId}
                yamlLineCount={yamlLineCount}
                yamlText={yamlText}
              />
              <PreviewPanel
                htmlArtifact={htmlArtifact}
                onPreviewScaleChange={setPreviewScale}
                pngArtifacts={pngArtifacts}
                previewScale={previewScale}
                profile={previewProfile}
                renderStatus={renderStatus}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
