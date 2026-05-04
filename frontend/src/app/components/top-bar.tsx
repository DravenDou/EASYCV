'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@heroui/react';
import {
  ChevronDown,
  Code2,
  Copy,
  Download,
  FileText,
  FolderOpen,
  ImageIcon,
  TerminalSquare,
  Type,
} from 'lucide-react';

import type { CvLanguage, RenderStatus, ValidationStatus, RenderFormatSelection } from '@/lib/types';
import type { RenderedArtifact } from '@/lib/rendercv-api';
import { artifactHref } from '@/lib/yaml-helpers';
import { chipColorForRender, chipColorForValidation, statusLabelForRender, statusLabelForValidation } from '@/lib/yaml-helpers';
import { ThemeToggle, ToolButton } from './ui-primitives';

// ─── chip-like badge (no HeroUI to avoid SSR flicker) ────────────────────────

function StatusBadge({ color, children }: { color: 'success' | 'warning' | 'danger' | 'accent' | 'default'; children: React.ReactNode }) {
  const colorMap = {
    success: 'bg-success/15 text-success border-success/30',
    warning: 'bg-warning/15 text-warning border-warning/30',
    danger: 'bg-danger/15 text-danger border-danger/30',
    accent: 'bg-accent/15 text-accent border-accent/30',
    default: 'bg-surface-secondary text-muted border-border',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${colorMap[color]}`}>
      {children}
    </span>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function downloadOne(artifact: RenderedArtifact): void {
  const link = document.createElement('a');
  link.href = artifactHref(artifact);
  link.download = artifact.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadAll(artifacts: RenderedArtifact[]): void {
  artifacts.forEach(downloadOne);
}

// ─── Language toggle ──────────────────────────────────────────────────────────

function LanguageToggle({
  language,
  onChange,
}: {
  language: CvLanguage;
  onChange: (lang: CvLanguage) => void;
}) {
  const isEnglish = language === 'english';
  return (
    <button
      aria-label={`Idioma del CV: ${isEnglish ? 'Inglés' : 'Español'}. Clic para cambiar.`}
      className="flex h-9 shrink-0 items-center gap-0 overflow-hidden rounded-full border border-border bg-surface-secondary text-xs font-bold transition-colors hover:border-border-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      title={`CV en ${isEnglish ? 'inglés' : 'español'}. Clic para cambiar.`}
      type="button"
      onClick={() => onChange(isEnglish ? 'spanish' : 'english')}
    >
      <span className={`flex h-full items-center px-3 py-1 transition-colors ${!isEnglish ? 'bg-accent text-accent-foreground' : 'text-muted'}`}>
        ES
      </span>
      <span className={`flex h-full items-center px-3 py-1 transition-colors ${isEnglish ? 'bg-accent text-accent-foreground' : 'text-muted'}`}>
        EN
      </span>
    </button>
  );
}

// ─── DownloadMenu ─────────────────────────────────────────────────────────────

const FORMAT_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }> }
> = {
  pdf: { label: 'PDF', icon: FileText },
  html: { label: 'HTML', icon: Code2 },
  png: { label: 'PNG', icon: ImageIcon },
  typst: { label: 'Typst', icon: TerminalSquare },
  markdown: { label: 'Markdown', icon: Type },
};

function DownloadMenu({
  artifacts,
  formatSelection,
  onFormatChange,
}: {
  artifacts: RenderedArtifact[];
  formatSelection: RenderFormatSelection;
  onFormatChange: (f: RenderFormatSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hasAny = artifacts.length > 0;
  const formatKeys: Array<keyof RenderFormatSelection> = ['pdf', 'png', 'html', 'markdown', 'typst'];

  const toggleFormat = (key: keyof RenderFormatSelection): void => {
    const next = { ...formatSelection, [key]: !formatSelection[key] };
    if (Object.values(next).every((v) => !v)) return; // keep at least one
    onFormatChange(next);
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        className="shrink-0 gap-1.5"
        isDisabled={!hasAny}
        size="sm"
        variant="secondary"
        onPress={() => setOpen((v) => !v)}
      >
        <Download aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Descargar</span>
        <ChevronDown
          aria-hidden="true"
          className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </Button>

      {open ? (
        <div className="animate-in fade-in slide-in-from-top-1 absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-[16px] border border-border bg-surface shadow-xl duration-150">
          {/* Download all */}
          <div className="border-b border-separator px-3 py-2">
            <button
              className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent-soft hover:text-accent disabled:pointer-events-none disabled:opacity-40"
              disabled={!hasAny}
              type="button"
              onClick={() => { downloadAll(artifacts); setOpen(false); }}
            >
              <Download aria-hidden="true" className="size-4 shrink-0 text-accent" />
              Descargar todo
              <span className="ml-auto rounded-full bg-surface-secondary px-2 py-0.5 text-[11px] font-bold text-muted">
                {artifacts.length}
              </span>
            </button>
          </div>

          {/* Per-format rows */}
          <div className="p-2 space-y-0.5">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
              Formatos
            </p>
            {formatKeys.map((key) => {
              const meta = FORMAT_META[key];
              const Icon = meta.icon;
              const available = artifacts.filter((a) => a.format === key);
              const enabled = formatSelection[key];
              return (
                <div
                  className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-surface-secondary"
                  key={key}
                >
                  {/* Toggle enable/disable */}
                  <button
                    aria-label={`${enabled ? 'Deshabilitar' : 'Habilitar'} ${meta.label}`}
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      enabled
                        ? 'border-accent bg-accent text-white'
                        : 'border-border bg-surface text-muted'
                    }`}
                    type="button"
                    onClick={() => toggleFormat(key)}
                  >
                    {enabled ? (
                      <svg className="size-3" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
                      </svg>
                    ) : null}
                  </button>

                  <Icon aria-hidden="true" className="size-4 shrink-0 text-muted" />
                  <span className={`flex-1 text-sm font-medium ${enabled ? 'text-foreground' : 'text-muted'}`}>
                    {meta.label}
                  </span>

                  {available.length > 0 ? (
                    <button
                      aria-label={`Descargar ${meta.label}`}
                      className="rounded-full p-1 text-muted transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      type="button"
                      onClick={() => { downloadAll(available); }}
                    >
                      <Download aria-hidden="true" className="size-3.5" />
                    </button>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold text-muted/50">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

export function TopBar({
  validationStatus,
  renderStatus,
  artifacts,
  formatSelection,
  language,
  onLoadSample,
  onCopyYaml,
  onFormatChange,
  onLanguageChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  validationStatus: ValidationStatus;
  renderStatus: RenderStatus;
  artifacts: RenderedArtifact[];
  formatSelection: RenderFormatSelection;
  language: CvLanguage;
  onLoadSample: () => void;
  onCopyYaml: () => void;
  onFormatChange: (f: RenderFormatSelection) => void;
  onLanguageChange: (lang: CvLanguage) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 flex min-h-14 flex-col gap-2 border-b border-separator bg-background/95 px-3 py-2 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-0 lg:pl-4">
      {/* Left — status badges */}
      <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
        <div className="grid size-9 shrink-0 place-items-center rounded-[12px] border border-accent/25 bg-accent-soft text-accent lg:hidden">
          <FileText aria-hidden="true" className="size-5" />
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <StatusBadge color={chipColorForValidation(validationStatus)}>
            {statusLabelForValidation(validationStatus)}
          </StatusBadge>
          <StatusBadge color={chipColorForRender(renderStatus)}>
            {statusLabelForRender(renderStatus)}
          </StatusBadge>
        </div>
        <div className="min-w-0 sm:hidden">
          <p className="truncate text-sm font-semibold text-foreground">CV Studio</p>
          <p className="truncate text-xs text-muted">{statusLabelForRender(renderStatus)}</p>
        </div>
        <div className="sm:hidden">
          <ThemeToggle />
        </div>
      </div>

      {/* Right — actions */}
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 sm:justify-end sm:overflow-visible sm:pb-0">
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>

        {/* Language toggle */}
        <LanguageToggle language={language} onChange={onLanguageChange} />

        {/* Undo / Redo / Copy */}
        <div className="hidden items-center gap-1 md:flex">
          <ToolButton icon={Copy} label="Copiar YAML" onPress={onCopyYaml} />
          {onUndo ? (
            <ToolButton
              icon={({ className, ...p }) => (
                <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" {...p}>
                  <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
              )}
              isDisabled={!canUndo}
              label="Deshacer (Ctrl+Z)"
              onPress={onUndo}
            />
          ) : null}
          {onRedo ? (
            <ToolButton
              icon={({ className, ...p }) => (
                <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" {...p}>
                  <path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
                </svg>
              )}
              isDisabled={!canRedo}
              label="Rehacer (Ctrl+Shift+Z)"
              onPress={onRedo}
            />
          ) : null}
        </div>

        {/* Muestra */}
        <Button className="shrink-0" size="sm" variant="secondary" onPress={onLoadSample}>
          <FolderOpen aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Muestra</span>
        </Button>

        {/* Download dropdown */}
        <DownloadMenu
          artifacts={artifacts}
          formatSelection={formatSelection}
          onFormatChange={onFormatChange}
        />
      </div>
    </header>
  );
}
