'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { clearStoredYaml, useLocalStorageYaml } from '@/lib/use-local-storage-yaml';
import { useEditorState } from '@/lib/use-editor-state';
import {
  RenderCvApiError,
  createRendercvClient,
  type RenderFormats,
  type RenderResponsePayload,
} from '@/lib/rendercv-api';
import { buildPreviewProfile } from '@/lib/yaml-helpers';
import type {
  RenderFormatSelection,
  ThemeId,
  ValidationStatus,
  RenderStatus,
  ExperienceEntryForm,
  PersonalFieldKey,
  SocialNetworkKey,
  EntryTemplateId,
} from '@/lib/types';
import {
  updateCvValue,
  updateSocialUsername,
  updateExperienceEntry,
  updateSectionEntryField,
  insertEntryTemplate,
} from '@/lib/yaml-helpers';

import { Sidebar } from './components/sidebar';
import { TopBar } from './components/top-bar';
import { EditorPanel } from './components/editor-panel';
import { PreviewPanel } from './components/preview-panel';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_RENDERCV_API_BASE_URL ?? '/rendercv-api';
const SPANISH_LOCALE_YAML = `locale:\n  language: spanish\n`;

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

// ─── Source-of-change tracking ────────────────────────────────────────────────
// Distinguishes between "user typed in YAML tab" vs "form mutated YAML"
// so we can apply different debounce delays.
type YamlChangeSource = 'yaml' | 'form';

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
  const [sampleStatus, setSampleStatus] = useState('Muestra inicial cargada');
  const [sampleLoading, setSampleLoading] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.88);
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>('classic');
  const [formatSelection, setFormatSelection] = useState<RenderFormatSelection>(DEFAULT_FORMAT_SELECTION);
  const [customDesignYaml, setCustomDesignYaml] = useState('');

  // Track what triggered the last YAML change so we debounce appropriately.
  const changeSourceRef = useRef<YamlChangeSource>('yaml');

  // ── Banner ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (restoredFromStorage) setShowRestoredBanner(true);
  }, [restoredFromStorage]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const htmlArtifact = renderResult?.artifacts.find((a) => a.format === 'html');
  const pngArtifacts = renderResult?.artifacts.filter((a) => a.format === 'png') ?? [];
  const allArtifacts = renderResult?.artifacts ?? [];
  const yamlLineCount = yamlText.split('\n').length;
  const previewProfile = useMemo(() => buildPreviewProfile(yamlText), [yamlText]);
  const renderOptions = useMemo(() => ({
    designYaml: customDesignYaml || `design:\n  theme: ${selectedThemeId}\n`,
    localeYaml: SPANISH_LOCALE_YAML,
  }), [customDesignYaml, selectedThemeId]);

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
  }, [setYaml]);

  /**
   * Called when a form field changes. Marks source as 'form' so the
   * render debounce waits longer before hitting the backend.
   */
  const updateYamlFromForm = useCallback((next: string): void => {
    changeSourceRef.current = 'form';
    setYaml(next);
    setValidationStatus('idle');
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const atLeastOneFormat = Object.values(formatSelection).some(Boolean);

  const handleCopyYaml = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(yamlText);
      setSampleStatus('YAML copiado al portapapeles ✓');
    } catch {
      setSampleStatus('No se pudo copiar el YAML');
    }
  }, [yamlText]);

  const loadSample = useCallback(async (): Promise<void> => {
    setSampleLoading(true);
    setSampleStatus('Cargando muestra...');
    try {
      const response = await fetch('/sample-cv.yaml', { cache: 'no-store' });
      if (!response.ok) throw new Error(`${response.status}`);
      const text = await response.text();
      setYamlSkipHistory(text);
      setSampleStatus('Muestra cargada desde /sample-cv.yaml');
      clearStoredYaml();
      setShowRestoredBanner(false);
    } catch {
      setYamlSkipHistory(FALLBACK_YAML);
      setSampleStatus('Muestra integrada cargada');
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
        if (!controller.signal.aborted) setValidationStatus(res.valid ? 'valid' : 'invalid');
      } catch {
        if (!controller.signal.aborted) setValidationStatus('error');
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
          onLoadSample={() => { void loadSample(); }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            artifacts={allArtifacts}
            canRedo={canRedo}
            canUndo={canUndo}
            formatSelection={formatSelection}
            renderStatus={renderStatus}
            validationStatus={validationStatus}
            onCopyYaml={() => { void handleCopyYaml(); }}
            onFormatChange={setFormatSelection}
            onLoadSample={() => { void loadSample(); }}
            onRedo={redo}
            onUndo={undo}
          />

          <div className="min-w-0 flex-1 p-2 sm:p-4">
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(420px,0.95fr)_minmax(460px,1.05fr)]">
              <EditorPanel
                canRedo={canRedo}
                canUndo={canUndo}
                customDesignYaml={customDesignYaml}
                formatSelection={formatSelection}
                selectedThemeId={selectedThemeId}
                yamlLineCount={yamlLineCount}
                yamlText={yamlText}
                onCopyYaml={() => { void handleCopyYaml(); }}
                onCustomDesignYamlChange={setCustomDesignYaml}
                onExperienceEntryChange={updateExperienceField}
                onFormatChange={setFormatSelection}
                onInsertEntry={insertEntry}
                onPersonalFieldChange={updatePersonalField}
                onRedo={redo}
                onSectionEntryChange={updateSectionField}
                onSocialFieldChange={updateSocialField}
                onThemeChange={setSelectedThemeId}
                onUndo={undo}
                onYamlChange={updateYamlText}
              />
              <PreviewPanel
                htmlArtifact={htmlArtifact}
                pngArtifacts={pngArtifacts}
                previewScale={previewScale}
                profile={previewProfile}
                renderStatus={renderStatus}
                onPreviewScaleChange={setPreviewScale}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
