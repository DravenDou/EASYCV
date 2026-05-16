'use client';

import Image from 'next/image';
import { Button, Chip, ScrollShadow } from '@heroui/react';
import {
  FileText,
  ImageIcon,
  Maximize2,
  Minimize2,
  MousePointer2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ChangeEvent, ComponentType, KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { RenderedArtifact } from '@/lib/rendercv-api';
import type {
  CvFieldPath,
  ImportedPdf,
  PdfEditorSelection,
  PdfFieldMapEntry,
  PreviewFitMode,
  PreviewProfile,
  RenderStatus,
} from '@/lib/types';
import { artifactHref } from '@/lib/yaml-helpers';
import { ToolButton, WorkspacePanel } from './ui-primitives';

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
        <h2 className="border-b border-slate-300 pb-1 text-xs font-bold text-slate-900">Resumen</h2>
        <p className="mt-3 text-xs leading-5 text-slate-700">
          Profesional orientada a construir CVs consistentes, fáciles de versionar y listos
          para enviar en distintos procesos de selección.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="border-b border-slate-300 pb-1 text-xs font-bold text-slate-900">Experiencia</h2>
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
        <h2 className="border-b border-slate-300 pb-1 text-xs font-bold text-slate-900">Habilidades</h2>
        <p className="mt-3 text-xs leading-5 text-slate-700">
          YAML, Typst, documentación técnica, automatización, edición de CVs y control de versiones.
        </p>
      </section>
    </article>
  );
}

/** Thin animated progress bar driven by renderStatus. */
function RenderProgressBar({ status }: { status: RenderStatus }) {
  const barClass =
    status === 'ready'
      ? 'w-full bg-success'
      : status === 'rendering'
        ? 'w-2/3 bg-accent'
        : status === 'error'
          ? 'w-full bg-danger'
          : 'w-1/4 bg-warning';

  return (
    <div className="h-1 bg-default">
      <div className={`h-full transition-all duration-500 ${barClass}`} />
    </div>
  );
}

type PreviewMode = 'auto' | 'imported' | 'pdf' | 'pages' | 'html';

type PdfViewport = {
  width: number;
  height: number;
};

type PdfRenderTask = {
  promise: Promise<void>;
  cancel?: () => void;
};

type PdfPageProxy = {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => PdfRenderTask;
};

type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy?: () => Promise<void> | void;
};

type PdfLoadingTask = {
  promise: Promise<PdfDocumentProxy>;
  destroy?: () => Promise<void> | void;
};

type PdfJsModule = {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (source: { data: Uint8Array }) => PdfLoadingTask;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PreviewModeButton({
  isActive,
  isDisabled,
  label,
  icon: Icon,
  onPress,
}: {
  isActive: boolean;
  isDisabled?: boolean;
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  onPress: () => void;
}) {
  return (
    <Button
      className="preview-pill-button shrink-0 gap-1.5"
      isDisabled={isDisabled}
      size="sm"
      variant={isActive ? 'primary' : 'tertiary'}
      onPress={onPress}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      <span className="hidden 2xl:inline">{label}</span>
    </Button>
  );
}

function PreviewFitButton({
  ariaLabel,
  isActive,
  label,
  onPress,
}: {
  ariaLabel: string;
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      aria-label={ariaLabel}
      aria-pressed={isActive}
      className="preview-pill-button shrink-0 px-3"
      size="sm"
      variant={isActive ? 'secondary' : 'tertiary'}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}

function base64ToBytes(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function pdfScaleFromPreview(previewScale: number): number {
  return Math.max(0.72, Math.min(1.8, previewScale * 1.24));
}

function fieldPathKey(path: CvFieldPath): string {
  return path.join('\u001f');
}

function PdfFieldHotspot({
  entry,
  isSelected,
  scale,
  onFieldSelect,
}: {
  entry: PdfFieldMapEntry;
  isSelected: boolean;
  scale: number;
  onFieldSelect: (selection: PdfEditorSelection) => void;
}) {
  return (
    <button
      aria-label={`Editar ${entry.label} en la lista`}
      className="pdf-field-hotspot"
      data-selected={isSelected ? 'true' : 'false'}
      style={{
        height: `${Math.max(18, entry.height * scale + 4)}px`,
        left: `${entry.x * scale}px`,
        top: `${entry.y * scale - 2}px`,
        width: `${Math.max(36, entry.width * scale + 8)}px`,
      }}
      title={`Editar ${entry.label}`}
      type="button"
      onClick={() =>
        onFieldSelect({
          label: entry.label,
          path: entry.path,
          text: entry.text,
        })
      }
    >
      <span className="sr-only">{entry.text}</span>
    </button>
  );
}

function PdfInlineFieldEditor({
  entry,
  scale,
  onCancel,
  onFieldEdit,
  onFieldSelect,
}: {
  entry: PdfFieldMapEntry;
  scale: number;
  onCancel: () => void;
  onFieldEdit: (path: CvFieldPath, value: string) => void;
  onFieldSelect: (selection: PdfEditorSelection) => void;
}) {
  const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState(entry.text);
  const isLongField = entry.text.length > 72 || entry.path.includes('highlights');
  const editorHeight = isLongField ? 132 : 74;
  const preferredTop = entry.y * scale + entry.height * scale + 6;
  const editorTop = Math.max(
    6,
    Math.min(preferredTop, entry.page_height * scale - editorHeight - 6),
  );

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.select();
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [entry]);

  const commit = (): void => {
    const nextValue = value.trim();
    if (nextValue && nextValue !== entry.text.trim()) {
      onFieldEdit(entry.path, nextValue);
      onFieldSelect({
        label: entry.label,
        path: entry.path,
        text: nextValue,
      });
    }
  };

  const setEditorRef = (node: HTMLInputElement | HTMLTextAreaElement | null): void => {
    editorRef.current = node;
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setValue(event.target.value);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setValue(entry.text);
      onCancel();
    }
  };

  return (
    <div
      className="pdf-inline-editor"
      style={{
        left: `${entry.x * scale}px`,
        top: `${editorTop}px`,
        width: `${Math.min(520, Math.max(220, entry.width * scale + 80))}px`,
      }}
    >
      <span className="pdf-inline-editor__label">{entry.label}</span>
      {isLongField ? (
        <textarea
          aria-label={`Editar ${entry.label}`}
          className="pdf-inline-editor__control"
          ref={setEditorRef}
          rows={4}
          value={value}
          onBlur={commit}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <input
          aria-label={`Editar ${entry.label}`}
          className="pdf-inline-editor__control"
          ref={setEditorRef}
          type="text"
          value={value}
          onBlur={commit}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
      )}
    </div>
  );
}

function PdfCanvasPage({
  editMode,
  fieldMap,
  pageNumber,
  pdfDocument,
  scale,
  selectedFieldPath,
  onClearSelection,
  onFieldEdit,
  onFieldSelect,
}: {
  editMode: boolean;
  fieldMap: PdfFieldMapEntry[];
  pageNumber: number;
  pdfDocument: PdfDocumentProxy;
  scale: number;
  selectedFieldPath: CvFieldPath | null;
  onClearSelection: () => void;
  onFieldEdit: (path: CvFieldPath, value: string) => void;
  onFieldSelect: (selection: PdfEditorSelection) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewport, setViewport] = useState<PdfViewport | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let renderTask: PdfRenderTask | null = null;

    async function renderPage(): Promise<void> {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const page = await pdfDocument.getPage(pageNumber);
      if (isCancelled) return;
      const nextViewport = page.getViewport({ scale });
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = Math.floor(nextViewport.width);
      canvas.height = Math.floor(nextViewport.height);
      canvas.style.width = `${nextViewport.width}px`;
      canvas.style.height = `${nextViewport.height}px`;
      setViewport(nextViewport);
      renderTask = page.render({ canvasContext: context, viewport: nextViewport });
      await renderTask.promise;
    }

    void renderPage();

    return () => {
      isCancelled = true;
      renderTask?.cancel?.();
    };
  }, [pageNumber, pdfDocument, scale]);

  const pageFields = fieldMap.filter((entry) => entry.page === pageNumber);
  const selectedPathKey = selectedFieldPath ? fieldPathKey(selectedFieldPath) : '';
  const selectedEntry = pageFields.find((entry) => fieldPathKey(entry.path) === selectedPathKey);

  return (
    <div
      className="pdf-edit-page"
      style={{
        height: viewport ? `${viewport.height}px` : undefined,
        width: viewport ? `${viewport.width}px` : undefined,
      }}
    >
      <canvas ref={canvasRef} />
      {editMode && viewport
        ? pageFields.map((entry) => (
            <PdfFieldHotspot
              entry={entry}
              isSelected={fieldPathKey(entry.path) === selectedPathKey}
              key={`${entry.path.join('.')}-${entry.page}-${entry.x}-${entry.y}-${entry.text}`}
              scale={scale}
              onFieldSelect={onFieldSelect}
            />
          ))
        : null}
      {editMode && viewport && selectedEntry ? (
        <PdfInlineFieldEditor
          entry={selectedEntry}
          key={`${selectedPathKey}-${selectedEntry.text}`}
          scale={scale}
          onCancel={onClearSelection}
          onFieldEdit={onFieldEdit}
          onFieldSelect={onFieldSelect}
        />
      ) : null}
    </div>
  );
}

function PdfCanvasEditor({
  artifact,
  editMode,
  fallbackHref,
  fieldMap,
  previewScale,
  selectedFieldPath,
  onClearSelection,
  onFieldEdit,
  onFieldSelect,
}: {
  artifact: RenderedArtifact;
  editMode: boolean;
  fallbackHref: string;
  fieldMap: PdfFieldMapEntry[];
  previewScale: number;
  selectedFieldPath: CvFieldPath | null;
  onClearSelection: () => void;
  onFieldEdit: (path: CvFieldPath, value: string) => void;
  onFieldSelect: (selection: PdfEditorSelection) => void;
}) {
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scale = useMemo(() => pdfScaleFromPreview(previewScale), [previewScale]);

  useEffect(() => {
    let isCancelled = false;
    let loadingTask: PdfLoadingTask | null = null;

    async function loadPdf(): Promise<void> {
      try {
        setError(null);
        const pdfjs = (await import('pdfjs-dist')) as unknown as PdfJsModule;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        loadingTask = pdfjs.getDocument({ data: base64ToBytes(artifact.content) });
        const document = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDocument(document);
        } else {
          await document.destroy?.();
        }
      } catch {
        if (!isCancelled) {
          setError('No se pudo cargar el visor editable del PDF.');
        }
      }
    }

    void loadPdf();

    return () => {
      isCancelled = true;
      setPdfDocument(null);
      void loadingTask?.destroy?.();
    };
  }, [artifact.content]);

  if (error) {
    return (
      <div className="pdf-native-fallback">
        <p role="status">{error} Mostrando vista PDF nativa.</p>
        <iframe
          className="w-full bg-white shadow-preview"
          src={fallbackHref}
          style={{
            height: `${Math.round(1190 * previewScale)}px`,
            width: `${Math.round(920 * previewScale)}px`,
          }}
          title="PDF generado"
        />
      </div>
    );
  }

  if (!pdfDocument) {
    return (
      <div className="pdf-edit-empty" role="status">
        Preparando PDF editable...
      </div>
    );
  }

  return (
    <div className="pdf-edit-document" style={{ width: 'fit-content' }}>
      {Array.from({ length: pdfDocument.numPages }, (_, index) => (
        <PdfCanvasPage
          editMode={editMode}
          fieldMap={fieldMap}
          key={index + 1}
          pageNumber={index + 1}
          pdfDocument={pdfDocument}
          scale={scale}
          selectedFieldPath={selectedFieldPath}
          onClearSelection={onClearSelection}
          onFieldEdit={onFieldEdit}
          onFieldSelect={onFieldSelect}
        />
      ))}
    </div>
  );
}

export function PreviewPanel({
  generatedPreviewKey,
  htmlArtifact,
  importedPdf,
  pdfArtifact,
  pngArtifacts,
  fieldMap,
  previewFitMode,
  previewScale,
  profile,
  renderStatus,
  selectedPdfField,
  onClearImportedPdf,
  onFieldEdit,
  onFieldSelect,
  onPreviewFitModeChange,
  onPreviewScaleChange,
}: {
  generatedPreviewKey: string;
  htmlArtifact: RenderedArtifact | undefined;
  importedPdf: ImportedPdf | null;
  pdfArtifact: RenderedArtifact | undefined;
  pngArtifacts: RenderedArtifact[];
  fieldMap: PdfFieldMapEntry[];
  previewFitMode: PreviewFitMode;
  previewScale: number;
  profile: PreviewProfile;
  renderStatus: RenderStatus;
  selectedPdfField: PdfEditorSelection;
  onClearImportedPdf: () => void;
  onFieldEdit: (path: CvFieldPath, value: string) => void;
  onFieldSelect: (selection: PdfEditorSelection) => void;
  onPreviewFitModeChange: (mode: PreviewFitMode) => void;
  onPreviewScaleChange: (value: number) => void;
}) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('auto');
  const [isPdfEditMode, setIsPdfEditMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previousGeneratedPreviewKey = useRef(generatedPreviewKey);
  const shouldReduceMotion = useReducedMotion();
  const safeIdx = 0;
  const selectedPng = pngArtifacts[safeIdx];
  const pw = Math.round(760 * previewScale);
  const fh = Math.round(1075 * previewScale);
  const pdfWidth = Math.round(920 * previewScale);
  const pdfHeight = Math.round(1190 * previewScale);
  const generatedPdfHref = pdfArtifact ? artifactHref(pdfArtifact) : null;
  const explicitMode =
    previewMode === 'imported' && importedPdf
      ? 'imported'
      : previewMode === 'pdf' && generatedPdfHref
        ? 'pdf'
        : previewMode === 'pages' && selectedPng
          ? 'pages'
          : previewMode === 'html' && htmlArtifact
            ? 'html'
            : null;
  const activeMode =
    explicitMode ??
    (generatedPdfHref
        ? 'pdf'
        : selectedPng
          ? 'pages'
          : htmlArtifact
          ? 'html'
          : importedPdf
          ? 'imported'
          : 'pages');
  const previewKey = activeMode === 'pages' ? `${activeMode}-${safeIdx}` : activeMode;
  const setCustomScale = (value: number): void => {
    onPreviewFitModeChange('custom');
    onPreviewScaleChange(value);
  };
  const setFitMode = (mode: PreviewFitMode): void => {
    onPreviewFitModeChange(mode);
    if (mode === 'width') {
      onPreviewScaleChange(1);
    } else if (mode === 'page') {
      onPreviewScaleChange(0.72);
    } else {
      onPreviewScaleChange(1);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setPreviewMode('auto'), 0);
    return () => window.clearTimeout(timeoutId);
  }, [importedPdf]);

  useEffect(() => {
    if (previousGeneratedPreviewKey.current === generatedPreviewKey) return;
    previousGeneratedPreviewKey.current = generatedPreviewKey;

    const timeoutId = window.setTimeout(() => {
      if (generatedPdfHref) {
        setPreviewMode('pdf');
      } else if (selectedPng) {
        setPreviewMode('pages');
      } else if (htmlArtifact) {
        setPreviewMode('html');
      } else {
        setPreviewMode('auto');
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [generatedPdfHref, generatedPreviewKey, htmlArtifact, selectedPng]);

  return (
    <WorkspacePanel
      actions={
        <ToolButton
          icon={isFullscreen ? Minimize2 : Maximize2}
          label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          onPress={() => setIsFullscreen((value) => !value)}
        />
      }
      className={
        isFullscreen
          ? 'fixed inset-3 z-50 h-[calc(100dvh-1.5rem)] min-h-0 overflow-hidden shadow-2xl'
          : 'min-h-[560px] overflow-hidden xl:min-h-[680px]'
      }
      eyebrow="Salida"
      title="Previsualización"
    >
      <RenderProgressBar status={renderStatus} />
      <div className="preview-toolbar">
        <div className="preview-control-group" aria-label="Tipo de vista">
          {importedPdf ? (
            <PreviewModeButton
              icon={FileText}
              isActive={activeMode === 'imported'}
              label="Original"
              onPress={() => setPreviewMode('imported')}
            />
          ) : null}
          <PreviewModeButton
            icon={FileText}
            isActive={activeMode === 'pdf'}
            isDisabled={!generatedPdfHref}
            label="PDF"
            onPress={() => setPreviewMode('pdf')}
          />
          <PreviewModeButton
            icon={ImageIcon}
            isActive={activeMode === 'pages'}
            isDisabled={!selectedPng}
            label="Páginas"
            onPress={() => setPreviewMode('pages')}
          />
        </div>

        <Button
          aria-pressed={isPdfEditMode}
          className="preview-pill-button shrink-0 gap-1.5"
          isDisabled={activeMode !== 'pdf' || fieldMap.length === 0}
          size="sm"
          variant={isPdfEditMode ? 'secondary' : 'tertiary'}
          onPress={() => setIsPdfEditMode((value) => !value)}
        >
          <MousePointer2 aria-hidden="true" className="size-3.5" />
          <span className="hidden 2xl:inline">Editar PDF</span>
        </Button>

        <div className="preview-control-group ml-auto" aria-label="Zoom">
          <PreviewFitButton
            ariaLabel="Ver al 100 por ciento"
            isActive={previewFitMode === 'custom' && previewScale === 1}
            label="100%"
            onPress={() => setFitMode('custom')}
          />
          <ToolButton
            icon={ZoomOut}
            isDisabled={previewScale <= 0.6}
            label="Alejar"
            onPress={() => setCustomScale(Math.max(0.6, Number((previewScale - 0.1).toFixed(2))))}
          />
          <Chip className="preview-zoom-value" color="default" size="sm" variant="soft">
            {Math.round(previewScale * 100)}%
          </Chip>
          <ToolButton
            icon={ZoomIn}
            isDisabled={previewScale >= 1.6}
            label="Acercar"
            onPress={() => setCustomScale(Math.min(1.6, Number((previewScale + 0.1).toFixed(2))))}
          />
        </div>
      </div>
      <ScrollShadow
        className={
          isFullscreen
            ? 'h-[calc(100dvh-8.5rem)] overflow-auto bg-preview p-1.5 sm:p-2'
            : 'h-[540px] overflow-auto bg-preview p-1.5 sm:p-2 xl:h-[626px]'
        }
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            className="min-w-fit transition-[width] duration-200"
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: -8 }}
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.985, y: 8 }}
            key={previewKey}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {activeMode === 'imported' && importedPdf ? (
              <div className="mx-auto" style={{ width: `${pdfWidth}px` }}>
                <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2">
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {importedPdf.name}
                    </p>
                    <p className="text-xs text-muted">
                      PDF importado · {formatFileSize(importedPdf.size)}
                    </p>
                  </div>
                  <Button
                    aria-label="Quitar PDF importado"
                    className="h-8 px-2"
                    size="sm"
                    variant="tertiary"
                    onPress={onClearImportedPdf}
                  >
                    <X aria-hidden="true" className="size-4" />
                  </Button>
                </div>
                <iframe
                  className="w-full bg-white shadow-preview"
                  src={importedPdf.dataUrl}
                  style={{ height: `${pdfHeight}px` }}
                  title="PDF importado"
                />
              </div>
            ) : activeMode === 'pdf' && pdfArtifact ? (
              <div className="mx-auto">
                <PdfCanvasEditor
                  artifact={pdfArtifact}
                  editMode={isPdfEditMode}
                  fallbackHref={artifactHref(pdfArtifact)}
                  fieldMap={fieldMap}
                  previewScale={previewScale}
                  selectedFieldPath={selectedPdfField?.path ?? null}
                  onClearSelection={() => onFieldSelect(null)}
                  onFieldEdit={onFieldEdit}
                  onFieldSelect={onFieldSelect}
                />
              </div>
            ) : activeMode === 'pages' && selectedPng ? (
              <div className="mx-auto" style={{ width: `${pw}px` }}>
                <Image
                  alt={`Página ${safeIdx + 1} del CV generado`}
                  className="h-auto w-full max-w-none bg-white shadow-preview"
                  height={1800}
                  src={artifactHref(selectedPng)}
                  unoptimized
                  width={1400}
                />
              </div>
            ) : activeMode === 'html' && htmlArtifact ? (
              <div className="mx-auto" style={{ width: `${pw}px` }}>
                <iframe
                  className="bg-white shadow-preview"
                  referrerPolicy="no-referrer"
                  sandbox=""
                  srcDoc={htmlArtifact.content}
                  style={{ height: `${fh}px`, width: `${pw}px` }}
                  title="Previsualización HTML del CV"
                />
              </div>
            ) : (
              <div className="mx-auto" style={{ width: `${pw}px` }}>
                <MockCvPreview profile={profile} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </ScrollShadow>
    </WorkspacePanel>
  );
}
