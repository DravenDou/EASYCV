'use client';

import { Button, Chip } from '@heroui/react';
import { AlertTriangle, FileSearch, TerminalSquare, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { clearStoredYaml, useLocalStorageYaml } from '@/lib/use-local-storage-yaml';
import { useEditorState } from '@/lib/use-editor-state';
import {
  RenderCvApiError,
  createRendercvClient,
  type RenderFormats,
  type RenderResponsePayload,
  type ValidationIssue,
} from '@/lib/rendercv-api';
import { buildPreviewProfile } from '@/lib/yaml-helpers';
import type {
  CvLanguage,
  ImportedPdf,
  RenderFormatSelection,
  ThemeId,
  ValidationStatus,
  RenderStatus,
  ExperienceEntryForm,
  PersonalFieldKey,
  SocialNetworkKey,
  EntryTemplateId,
  EditorTabId,
  PdfImportReview,
  PreviewFitMode,
} from '@/lib/types';
import {
  updateCvValue,
  updateSocialUsername,
  updateExperienceEntry,
  updateSectionEntryField,
  insertEntryTemplate,
  deleteSectionEntry,
  duplicateSectionEntry,
  moveSectionEntryToIndex,
  normalizeWrappedNormalSections,
  replaceTextSectionEntries,
  renameSection,
  deleteSection,
} from '@/lib/yaml-helpers';

import { Sidebar } from './components/sidebar';
import { TopBar } from './components/top-bar';
import { EditorPanel } from './components/editor-panel';
import { PreviewPanel } from './components/preview-panel';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_RENDERCV_API_BASE_URL ?? '/rendercv-api';
function buildLocaleYaml(lang: CvLanguage): string {
  return `locale:\n  language: ${lang}\n`;
}

/**
 * Debounce delay (ms) before triggering a render after the user edits.
 * - YAML tab: 800ms — user types fast, wait until they pause.
 * - Form tab: 1200ms — form changes cause several rapid YAML mutations;
 *   a longer delay avoids sending half-built payloads to the backend.
 */
const RENDER_DEBOUNCE_FORM_MS = 1200;
const RENDER_DEBOUNCE_YAML_MS = 800;
const VALIDATE_DEBOUNCE_MS = 500;

const FALLBACK_YAML = `cv:
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

const DEFAULT_FORMAT_SELECTION: RenderFormatSelection = {
  pdf: true,
  png: true,
  html: true,
  markdown: false,
  typst: false,
};

function buildRenderFormats(sel: RenderFormatSelection): RenderFormats {
  return {
    include_pdf: sel.pdf,
    include_png: sel.png,
    include_html: sel.html,
    include_markdown: sel.markdown,
    include_typst: sel.typst,
  };
}

function isPreviewFitMode(value: string | null): value is PreviewFitMode {
  return value === 'custom' || value === 'width' || value === 'page';
}

function getStoredPreviewScale(): number {
  const storedScale = Number(window.localStorage.getItem('rendercv-preview-scale'));
  return Number.isFinite(storedScale) && storedScale >= 0.6 && storedScale <= 1.6
    ? storedScale
    : 0.88;
}

function getStoredPreviewFitMode(): PreviewFitMode {
  const storedFitMode = window.localStorage.getItem('rendercv-preview-fit-mode');
  return isPreviewFitMode(storedFitMode) ? storedFitMode : 'custom';
}

// ─── Source-of-change tracking ────────────────────────────────────────────────
// Distinguishes between "user typed in YAML tab" vs "form mutated YAML"
// so we can apply different debounce delays.
type YamlChangeSource = 'yaml' | 'form';

function issueLocation(issue: ValidationIssue): string {
  const schemaPath = issue.schema_location?.join('.') || 'YAML';
  if (issue.start_line) {
    return `${schemaPath} · línea ${issue.start_line}`;
  }
  return schemaPath;
}

function ValidationIssuesPanel({
  issues,
  onOpenYaml,
}: {
  issues: ValidationIssue[];
  onOpenYaml: () => void;
}) {
  if (issues.length === 0) return null;

  return (
    <section className="rounded-[18px] border border-warning/40 bg-warning/10 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Errores por corregir</h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              Revisa estos campos antes de descargar el CV final.
            </p>
          </div>
        </div>
        <Button size="sm" variant="secondary" onPress={onOpenYaml}>
          <TerminalSquare aria-hidden="true" className="size-4" />
          Abrir YAML
        </Button>
      </div>
      <div className="mt-3 grid gap-2">
        {issues.slice(0, 4).map((issue, index) => (
          <div
            className="rounded-[12px] border border-warning/25 bg-background/50 px-3 py-2"
            key={`${issueLocation(issue)}-${index}`}
          >
            <p className="text-xs font-semibold text-warning">{issueLocation(issue)}</p>
            <p className="mt-1 text-sm leading-5 text-foreground">{issue.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ImportReviewPanel({
  review,
  onDismiss,
}: {
  review: PdfImportReview | null;
  onDismiss: () => void;
}) {
  if (!review) return null;

  return (
    <section className="rounded-[18px] border border-accent/30 bg-accent/10 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <FileSearch aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Revisar importación</h3>
            <p className="mt-1 truncate text-sm text-muted">{review.fileName}</p>
          </div>
        </div>
        <Button aria-label="Cerrar revisión de importación" isIconOnly size="sm" variant="tertiary" onPress={onDismiss}>
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {review.detectedFields.slice(0, 10).map((field) => (
          <Chip color="success" key={field} size="sm" variant="soft">
            {field}
          </Chip>
        ))}
      </div>
      {review.warnings.length > 0 || review.unrecognizedLines.length > 0 ? (
        <div className="mt-3 grid gap-2 text-sm leading-5 text-muted">
          {review.warnings.slice(0, 3).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          {review.unrecognizedLines.length > 0 ? (
            <p>
              Líneas dudosas: {review.unrecognizedLines.slice(0, 3).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  // ── Persistence + undo/redo ──────────────────────────────────────────────
  const { yaml: persistedYaml, setYaml: persistYaml, restoredFromStorage } = useLocalStorageYaml(FALLBACK_YAML);
  const editor = useEditorState(persistedYaml);
  const { yamlText, canUndo, canRedo, setYaml, setYamlSkipHistory, undo, redo } = editor;

  // Sync editor changes back to localStorage.
  useEffect(() => {
    persistYaml(yamlText);
  }, [yamlText, persistYaml]);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [showRestoredBanner, setShowRestoredBanner] = useState(false);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
  const [renderResult, setRenderResult] = useState<RenderResponsePayload | null>(null);
  const [renderStatus, setRenderStatus] = useState<RenderStatus>('idle');
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [sampleStatus, setSampleStatus] = useState('Muestra inicial cargada');
  const [, setSampleLoading] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.88);
  const [previewFitMode, setPreviewFitMode] = useState<PreviewFitMode>('custom');
  const [editorTab, setEditorTab] = useState<EditorTabId>('lista');
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>('classic');
  const [formatSelection, setFormatSelection] = useState<RenderFormatSelection>(DEFAULT_FORMAT_SELECTION);
  const [customDesignYaml, setCustomDesignYaml] = useState('');
  const [cvLanguage, setCvLanguage] = useState<CvLanguage>('spanish');
  const [isYamlEnabled, setIsYamlEnabled] = useState(true);
  const [importedPdf, setImportedPdf] = useState<ImportedPdf | null>(null);
  const [importReview, setImportReview] = useState<PdfImportReview | null>(null);

  // Track what triggered the last YAML change so we debounce appropriately.
  const changeSourceRef = useRef<YamlChangeSource>('yaml');
  const previewPreferencesLoadedRef = useRef(false);

  useEffect(() => {
    const normalizedYaml = normalizeWrappedNormalSections(yamlText);
    if (normalizedYaml === yamlText) return;
    const timeoutId = window.setTimeout(() => {
      changeSourceRef.current = 'form';
      setYamlSkipHistory(normalizedYaml);
      setValidationStatus('idle');
      setValidationIssues([]);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [setYamlSkipHistory, yamlText]);

  // ── Banner ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restoredFromStorage) return;
    const timeoutId = window.setTimeout(() => setShowRestoredBanner(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, [restoredFromStorage]);

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      setPreviewScale(getStoredPreviewScale());
      setPreviewFitMode(getStoredPreviewFitMode());
      previewPreferencesLoadedRef.current = true;
    });
    return () => window.cancelAnimationFrame(animationFrameId);
  }, []);

  useEffect(() => {
    if (!previewPreferencesLoadedRef.current) return;
    window.localStorage.setItem('rendercv-preview-scale', String(previewScale));
    window.localStorage.setItem('rendercv-preview-fit-mode', previewFitMode);
  }, [previewFitMode, previewScale]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const htmlArtifact = renderResult?.artifacts.find((a) => a.format === 'html');
  const pdfArtifact = renderResult?.artifacts.find((a) => a.format === 'pdf');
  const pngArtifacts = renderResult?.artifacts.filter((a) => a.format === 'png') ?? [];
  const allArtifacts = renderResult?.artifacts ?? [];
  const yamlLineCount = yamlText.split('\n').length;
  const previewProfile = useMemo(() => buildPreviewProfile(yamlText), [yamlText]);
  const renderOptions = useMemo(() => ({
    designYaml: customDesignYaml || `design:\n  theme: ${selectedThemeId}\n`,
    localeYaml: buildLocaleYaml(cvLanguage),
  }), [customDesignYaml, selectedThemeId, cvLanguage]);

  // ── YAML mutators ─────────────────────────────────────────────────────────

  /**
   * Called when the user types directly in the CodeMirror YAML tab.
   * Uses the shorter debounce delay.
   */
  const updateYamlText = useCallback((next: string): void => {
    changeSourceRef.current = 'yaml';
    setYaml(next);
    if (!next.trim()) {
      setRenderResult(null);
      setRenderStatus('idle');
    }
    setValidationStatus('idle');
    setValidationIssues([]);
  }, [setYaml]);

  /**
   * Called when a form field changes. Marks source as 'form' so the
   * render debounce waits longer before hitting the backend.
   */
  const updateYamlFromForm = useCallback((next: string): void => {
    changeSourceRef.current = 'form';
    setYaml(next);
    setValidationStatus('idle');
    setValidationIssues([]);
  }, [setYaml]);

  const updatePersonalField = useCallback((field: PersonalFieldKey, value: string): void => {
    updateYamlFromForm(updateCvValue(yamlText, field, value));
  }, [yamlText, updateYamlFromForm]);

  const updateSocialField = useCallback((network: SocialNetworkKey, value: string): void => {
    updateYamlFromForm(updateSocialUsername(yamlText, network, value));
  }, [yamlText, updateYamlFromForm]);

  const updateExperienceField = useCallback((
    sectionTitle: string,
    index: number,
    updates: Partial<Omit<ExperienceEntryForm, 'sectionTitle' | 'index'>>,
  ): void => {
    updateYamlFromForm(updateExperienceEntry(yamlText, sectionTitle, index, updates));
  }, [yamlText, updateYamlFromForm]);

  const updateSectionField = useCallback((
    sectionTitle: string,
    entryIndex: number,
    fieldKey: string,
    value: string,
  ): void => {
    updateYamlFromForm(updateSectionEntryField(yamlText, sectionTitle, entryIndex, fieldKey, value));
  }, [yamlText, updateYamlFromForm]);

  const insertEntry = useCallback((sectionTitle: string, templateId: EntryTemplateId): void => {
    updateYamlFromForm(insertEntryTemplate(yamlText, sectionTitle, templateId));
  }, [yamlText, updateYamlFromForm]);

  const deleteEntry = useCallback((sectionTitle: string, entryIndex: number): void => {
    updateYamlFromForm(deleteSectionEntry(yamlText, sectionTitle, entryIndex));
  }, [yamlText, updateYamlFromForm]);

  const duplicateEntry = useCallback((sectionTitle: string, entryIndex: number): void => {
    updateYamlFromForm(duplicateSectionEntry(yamlText, sectionTitle, entryIndex));
  }, [yamlText, updateYamlFromForm]);

  const reorderEntry = useCallback((
    sectionTitle: string,
    fromIndex: number,
    toIndex: number,
  ): void => {
    updateYamlFromForm(moveSectionEntryToIndex(yamlText, sectionTitle, fromIndex, toIndex));
  }, [yamlText, updateYamlFromForm]);

  const replaceTextSection = useCallback((sectionTitle: string, value: string): void => {
    updateYamlFromForm(replaceTextSectionEntries(yamlText, sectionTitle, value));
  }, [yamlText, updateYamlFromForm]);

  const renameCvSection = useCallback((sectionTitle: string, nextTitle: string): void => {
    updateYamlFromForm(renameSection(yamlText, sectionTitle, nextTitle));
  }, [yamlText, updateYamlFromForm]);

  const deleteCvSection = useCallback((sectionTitle: string): void => {
    updateYamlFromForm(deleteSection(yamlText, sectionTitle));
  }, [yamlText, updateYamlFromForm]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const atLeastOneFormat = Object.values(formatSelection).some(Boolean);

  const openYamlTab = useCallback((): void => {
    setIsYamlEnabled(true);
    setEditorTab('yaml');
  }, []);

  const handleYamlVisibilityChange = useCallback((visible: boolean): void => {
    setIsYamlEnabled(visible);
    if (!visible) {
      setEditorTab((tab) => (tab === 'yaml' ? 'lista' : tab));
    }
  }, []);

  const applyTheme = useCallback((theme: ThemeId): void => {
    changeSourceRef.current = 'form';
    setSelectedThemeId(theme);
    setCustomDesignYaml('');
  }, []);

  const handleCopyYaml = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(yamlText);
      setSampleStatus('YAML copiado al portapapeles ✓');
    } catch {
      setSampleStatus('No se pudo copiar el YAML');
    }
  }, [yamlText]);

  const importPdf = useCallback(async (file: File): Promise<void> => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setSampleStatus('Selecciona un archivo PDF válido');
      return;
    }

    setSampleStatus(`Convirtiendo PDF: ${file.name}`);

    try {
      const client = createRendercvClient(DEFAULT_API_BASE);
      const response = await client.importPdf(file);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (): void => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Invalid PDF data URL'));
          }
        };
        reader.onerror = (): void => reject(reader.error ?? new Error('PDF read failed'));
        reader.readAsDataURL(file);
      });

      const normalizedYaml = normalizeWrappedNormalSections(response.yaml);
      changeSourceRef.current = 'yaml';
      setYamlSkipHistory(normalizedYaml);
      setRenderResult(null);
      setRenderStatus('idle');
      setImportedPdf({
        dataUrl,
        name: file.name,
        size: file.size,
      });
      setImportReview({
        fileName: file.name,
        warnings: response.warnings ?? [],
        detectedFields: response.detected_fields ?? [],
        unrecognizedLines: response.unrecognized_lines ?? [],
      });
      setValidationStatus('idle');
      setValidationIssues([]);
      setSampleStatus(`PDF convertido a YAML: ${file.name}`);
    } catch (error) {
      const message =
        error instanceof RenderCvApiError
          ? error.message
          : 'No se pudo convertir el PDF a YAML';
      setSampleStatus(message);
    }
  }, [setYamlSkipHistory]);

  const loadSample = useCallback(async (): Promise<void> => {
    setSampleLoading(true);
    setSampleStatus('Cargando muestra...');
    try {
      const response = await fetch('/sample-cv.yaml', { cache: 'no-store' });
      if (!response.ok) throw new Error(`${response.status}`);
      const text = await response.text();
      setYamlSkipHistory(text);
      setSampleStatus('Muestra cargada desde /sample-cv.yaml');
      setImportedPdf(null);
      setImportReview(null);
      clearStoredYaml();
      setShowRestoredBanner(false);
    } catch {
      setYamlSkipHistory(FALLBACK_YAML);
      setSampleStatus('Muestra integrada cargada');
      setImportedPdf(null);
      setImportReview(null);
    } finally {
      setSampleLoading(false);
    }
  }, [setYamlSkipHistory]);

  // ── Auto-validation debounce ──────────────────────────────────────────────
  useEffect(() => {
    if (!yamlText.trim()) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const client = createRendercvClient(DEFAULT_API_BASE);
      setValidationStatus('validating');
      try {
        const res = await client.validate(yamlText, renderOptions, controller.signal);
        if (!controller.signal.aborted) {
          setValidationStatus(res.valid ? 'valid' : 'invalid');
          setValidationIssues(res.errors);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setValidationStatus('error');
          setValidationIssues(error instanceof RenderCvApiError ? error.validationErrors ?? [] : []);
        }
      }
    }, VALIDATE_DEBOUNCE_MS);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [renderOptions, yamlText]);

  // ── Auto-render with adaptive debounce ───────────────────────────────────
  useEffect(() => {
    if (!yamlText.trim() || !atLeastOneFormat) return;
    const controller = new AbortController();

    // Use a longer delay when the change came from the form to avoid
    // sending half-rebuilt YAML payloads while the user is still typing.
    const delay = changeSourceRef.current === 'form'
      ? RENDER_DEBOUNCE_FORM_MS
      : RENDER_DEBOUNCE_YAML_MS;

    const timeout = window.setTimeout(async () => {
      if (controller.signal.aborted) return;
      const client = createRendercvClient(DEFAULT_API_BASE);
      setRenderStatus('rendering');
      try {
        const res = await client.render(
          yamlText,
          buildRenderFormats(formatSelection),
          renderOptions,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setRenderResult(res);
          setRenderStatus('ready');
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setRenderStatus('error');
          if (error instanceof RenderCvApiError && error.validationErrors?.length) {
            setValidationStatus('invalid');
            setValidationIssues(error.validationErrors);
          }
        }
      }
    }, delay);

    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [renderOptions, yamlText, formatSelection, atLeastOneFormat]);

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      {/* Restored-draft banner */}
      {showRestoredBanner ? (
        <div
          aria-live="polite"
          className="flex items-center justify-between gap-3 border-b border-separator bg-accent/10 px-4 py-2.5 text-sm"
          role="status"
        >
          <span className="font-medium text-accent">
            ✦ Borrador anterior restaurado automáticamente.
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-full px-3 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-tertiary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              type="button"
              onClick={() => {
                clearStoredYaml();
                setYamlSkipHistory(FALLBACK_YAML);
                setShowRestoredBanner(false);
              }}
            >
              Descartar borrador
            </button>
            <button
              aria-label="Cerrar aviso"
              className="rounded-full p-1 text-muted transition-colors hover:bg-surface-tertiary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              type="button"
              onClick={() => setShowRestoredBanner(false)}
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-dvh">
        <Sidebar
          sampleStatus={sampleStatus}
          onImportPdf={(file) => { void importPdf(file); }}
          onLoadSample={() => { void loadSample(); }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            artifacts={allArtifacts}
            canRedo={canRedo}
            canUndo={canUndo}
            formatSelection={formatSelection}
            language={cvLanguage}
            renderStatus={renderStatus}
            validationStatus={validationStatus}
            onCopyYaml={() => { void handleCopyYaml(); }}
            onFormatChange={setFormatSelection}
            onLanguageChange={setCvLanguage}
            onLoadSample={() => { void loadSample(); }}
            onRedo={redo}
            onUndo={undo}
            onYamlVisibilityChange={handleYamlVisibilityChange}
            isYamlEnabled={isYamlEnabled}
          />

          <div className="min-w-0 flex-1 p-2 sm:p-4">
            <div className="mb-4 space-y-3">
              <ImportReviewPanel
                review={importReview}
                onDismiss={() => setImportReview(null)}
              />
              <ValidationIssuesPanel issues={validationIssues} onOpenYaml={openYamlTab} />
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(420px,0.95fr)_minmax(460px,1.05fr)]">
              <EditorPanel
                canRedo={canRedo}
                canUndo={canUndo}
                customDesignYaml={customDesignYaml}
                formatSelection={formatSelection}
                isYamlEnabled={isYamlEnabled}
                selectedTab={editorTab}
                selectedThemeId={selectedThemeId}
                yamlLineCount={yamlLineCount}
                yamlText={yamlText}
                onCopyYaml={() => { void handleCopyYaml(); }}
                onCustomDesignYamlChange={setCustomDesignYaml}
                onDeleteEntry={deleteEntry}
                onDeleteSection={deleteCvSection}
                onDuplicateEntry={duplicateEntry}
                onExperienceEntryChange={updateExperienceField}
                onFormatChange={setFormatSelection}
                onInsertEntry={insertEntry}
                onPersonalFieldChange={updatePersonalField}
                onReplaceTextSection={replaceTextSection}
                onReorderEntry={reorderEntry}
                onRenameSection={renameCvSection}
                onRedo={redo}
                onSectionEntryChange={updateSectionField}
                onSocialFieldChange={updateSocialField}
                onTabChange={setEditorTab}
                onThemeChange={applyTheme}
                onUndo={undo}
                onYamlChange={updateYamlText}
              />
              <PreviewPanel
                generatedPreviewKey={`${selectedThemeId}:${customDesignYaml}`}
                htmlArtifact={htmlArtifact}
                importedPdf={importedPdf}
                pdfArtifact={pdfArtifact}
                pngArtifacts={pngArtifacts}
                previewFitMode={previewFitMode}
                previewScale={previewScale}
                profile={previewProfile}
                renderStatus={renderStatus}
                onClearImportedPdf={() => {
                  setImportedPdf(null);
                  setImportReview(null);
                }}
                onPreviewFitModeChange={setPreviewFitMode}
                onPreviewScaleChange={setPreviewScale}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
