/**
 * Shared domain types used across the CV Studio application.
 * Keeping them in one file avoids circular imports between components.
 */
import type { LucideIcon } from 'lucide-react';

export type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid' | 'error';
export type RenderStatus = 'idle' | 'rendering' | 'ready' | 'error';
export type ChipTone = 'default' | 'accent' | 'success' | 'warning' | 'danger';
export type EditorTabId = 'lista' | 'yaml' | 'diseno';
export type PreviewFitMode = 'custom' | 'width' | 'page';
export type PersonalFieldKey = 'name' | 'headline' | 'location' | 'email' | 'phone' | 'website';
export type TemplateStatus = 'Activo' | 'Borrador' | 'Disponible' | 'Nuevo';
export type SocialNetworkKey = 'LinkedIn' | 'GitHub';

/** Language used for the rendered CV (controls locale_yaml sent to backend). */
export type CvLanguage = 'spanish' | 'english';
export type EntryTemplateId =
  | 'text'
  | 'experience'
  | 'education'
  | 'normal'
  | 'publication'
  | 'bullet'
  | 'numbered'
  | 'reversedNumbered'
  | 'oneLine';
export type ThemeId =
  | 'classic'
  | 'moderncv'
  | 'sb2nov'
  | 'engineeringresumes'
  | 'engineeringclassic'
  | 'harvard'
  | 'ink'
  | 'opal'
  | 'ember';

/** Render output format toggles — mirrors the backend RenderFormats model. */
export type RenderFormatSelection = {
  pdf: boolean;
  png: boolean;
  html: boolean;
  markdown: boolean;
  typst: boolean;
};

export type WorkspacePanelProps = {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export type ToolButtonProps = {
  label: string;
  icon: LucideIcon;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger';
  isDisabled?: boolean;
  onPress?: () => void;
};

export type TemplateCard = {
  id: ThemeId;
  name: string;
  status: TemplateStatus;
  accentClassName: string;
  description: string;
};

export type PersonalField = {
  key: PersonalFieldKey;
  label: string;
  placeholder: string;
  icon: LucideIcon;
  type?: string;
};

export type SocialField = {
  network: SocialNetworkKey;
  label: string;
  placeholder: string;
  icon: LucideIcon;
};

export type ExperienceEntryForm = {
  sectionTitle: string;
  index: number;
  company: string;
  position: string;
  location: string;
  start_date: string;
  end_date: string;
  highlightsText: string;
};

export type EntryTemplate = {
  id: EntryTemplateId;
  label: string;
  sectionTitle: string;
  description: string;
  icon: LucideIcon;
  buildEntry: () => string;
};

export type PreviewProfile = {
  name: string;
  location: string;
  email: string;
  phone: string;
  website: string;
  position: string;
};

export type ImportedPdf = {
  dataUrl: string;
  name: string;
  size: number;
};

export type CvFieldPath = string[];

export type CvDocument = {
  cv?: Record<string, unknown>;
  design?: Record<string, unknown>;
  locale?: Record<string, unknown>;
  settings?: Record<string, unknown>;
};

export type PdfFieldMapEntry = {
  path: CvFieldPath;
  label: string;
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  page_width: number;
  page_height: number;
};

export type ImportedPdfTextBlock = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font_size: number | null;
};

export type ImportedPdfPage = {
  page: number;
  width: number;
  height: number;
  blocks: ImportedPdfTextBlock[];
};

export type ImportedFieldCandidate = {
  path: CvFieldPath;
  label: string;
  value: string;
  confidence: number;
  source: string;
};

export type PdfEditorSelection = {
  path: CvFieldPath;
  label: string;
  text: string;
} | null;

export type PdfImportReview = {
  fileName: string;
  warnings: string[];
  detectedFields: string[];
  fieldCandidates: ImportedFieldCandidate[];
  pages: ImportedPdfPage[];
  unrecognizedLines: string[];
};

/** Per-stage render progress. */
export type RenderStage =
  | 'idle'
  | 'validating'
  | 'building_model'
  | 'templating'
  | 'compiling'
  | 'done'
  | 'error';

export type RenderProgressEvent = {
  stage: RenderStage;
  progress: number;
  message?: string;
};
