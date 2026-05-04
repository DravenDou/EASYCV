'use client';

import Image from 'next/image';
import { Button, Chip, ScrollShadow } from '@heroui/react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';

import type { RenderedArtifact } from '@/lib/rendercv-api';
import type { PreviewProfile, RenderStatus } from '@/lib/types';
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

export function PreviewPanel({
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
  const safeIdx = pngArtifacts.length > 0 ? Math.min(selectedPageIndex, pngArtifacts.length - 1) : 0;
  const selectedPng = pngArtifacts[safeIdx];
  const multiPage = pngArtifacts.length > 1;
  const pw = Math.round(520 * previewScale);
  const fh = Math.round(735 * previewScale);

  return (
    <WorkspacePanel
      actions={
        <>
          {multiPage ? (
            <>
              <ToolButton
                icon={ChevronLeft}
                isDisabled={safeIdx === 0}
                label="Página anterior"
                onPress={() => setSelectedPageIndex(Math.max(0, safeIdx - 1))}
              />
              <Chip color="default" size="sm" variant="soft">
                Página {safeIdx + 1}/{pngArtifacts.length}
              </Chip>
              <ToolButton
                icon={ChevronRight}
                isDisabled={safeIdx >= pngArtifacts.length - 1}
                label="Página siguiente"
                onPress={() => setSelectedPageIndex(Math.min(pngArtifacts.length - 1, safeIdx + 1))}
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
      <RenderProgressBar status={renderStatus} />
      <ScrollShadow className="h-[540px] overflow-auto bg-preview p-3 sm:p-6 xl:h-[626px]">
        <div className="animate-preview-pop min-w-fit transition-[width] duration-200">
          {selectedPng ? (
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
          ) : htmlArtifact ? (
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
        </div>
      </ScrollShadow>
    </WorkspacePanel>
  );
}
