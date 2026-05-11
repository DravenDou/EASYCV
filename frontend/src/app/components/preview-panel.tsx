'use client';

import Image from 'next/image';
import { Button, Chip, ScrollShadow } from '@heroui/react';
import {
  FileText,
  ImageIcon,
  Maximize2,
  Minimize2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ComponentType } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { RenderedArtifact } from '@/lib/rendercv-api';
import type { ImportedPdf, PreviewFitMode, PreviewProfile, RenderStatus } from '@/lib/types';
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

export function PreviewPanel({
  generatedPreviewKey,
  htmlArtifact,
  importedPdf,
  pdfArtifact,
  pngArtifacts,
  previewFitMode,
  previewScale,
  profile,
  renderStatus,
  onClearImportedPdf,
  onPreviewFitModeChange,
  onPreviewScaleChange,
}: {
  generatedPreviewKey: string;
  htmlArtifact: RenderedArtifact | undefined;
  importedPdf: ImportedPdf | null;
  pdfArtifact: RenderedArtifact | undefined;
  pngArtifacts: RenderedArtifact[];
  previewFitMode: PreviewFitMode;
  previewScale: number;
  profile: PreviewProfile;
  renderStatus: RenderStatus;
  onClearImportedPdf: () => void;
  onPreviewFitModeChange: (mode: PreviewFitMode) => void;
  onPreviewScaleChange: (value: number) => void;
}) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('auto');
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
                <div className="mb-2 flex items-center gap-2 rounded-[12px] border border-border bg-surface px-3 py-2">
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
            ) : activeMode === 'pdf' && generatedPdfHref ? (
              <div className="mx-auto" style={{ width: `${pdfWidth}px` }}>
                <iframe
                  className="w-full bg-white shadow-preview"
                  src={generatedPdfHref}
                  style={{ height: `${pdfHeight}px` }}
                  title="PDF generado"
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
