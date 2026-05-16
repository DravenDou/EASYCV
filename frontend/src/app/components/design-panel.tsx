'use client';

import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import { Button, Chip, Switch } from '@heroui/react';
import { CheckCircle2, Code2, RotateCcw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';

import { templateCards } from '@/constants/templates';
import type { RenderFormatSelection, TemplateCard, ThemeId } from '@/lib/types';

function buildDesignYaml(themeId: ThemeId): string {
  return `design:\n  theme: ${themeId}\n`;
}

const FORMAT_LABELS: Record<keyof RenderFormatSelection, string> = {
  pdf: 'PDF',
  png: 'PNG',
  html: 'HTML',
  markdown: 'Markdown',
  typst: 'Typst',
};

function ThemeMiniPreview({
  isSelected,
  template,
}: {
  isSelected: boolean;
  template: TemplateCard;
}) {
  const isTwoColumn = template.id === 'moderncv' || template.id === 'opal';
  const isDense = template.id === 'sb2nov' || template.id === 'engineeringresumes';
  const isFormal = template.id === 'harvard' || template.id === 'engineeringclassic';

  return (
    <span
      aria-hidden="true"
      className={`mb-3 block aspect-[1/1.28] overflow-hidden rounded-[8px] border bg-white p-2 shadow-sm transition ${
        isSelected ? 'border-accent/60 ring-2 ring-accent/20' : 'border-slate-200'
      }`}
    >
        <span className="block h-full rounded-[6px] bg-slate-50 p-2">
        <span
          className={`mx-auto block h-2 rounded-full ${
            isTwoColumn ? 'w-12' : isFormal ? 'w-20' : 'w-16'
          } ${template.accentClassName}`}
        />
        <span className="mt-2 block h-1.5 w-20 rounded-full bg-slate-800" />
        <span className="mt-1 block h-1 w-28 rounded-full bg-slate-300" />
        <span className={isTwoColumn ? 'mt-3 grid grid-cols-[0.38fr_1fr] gap-2' : 'mt-3 block'}>
          {isTwoColumn ? (
            <span className="space-y-1.5">
              <span className={`block h-1.5 w-full rounded-full ${template.accentClassName}`} />
              <span className="block h-1.5 w-4/5 rounded-full bg-slate-300" />
              <span className="block h-1.5 w-3/5 rounded-full bg-slate-300" />
            </span>
          ) : null}
          <span className="block space-y-1.5">
            <span className={`block h-1 w-16 rounded-full ${template.accentClassName}`} />
            <span className="block h-1.5 w-full rounded-full bg-slate-300" />
            <span className="block h-1.5 w-11/12 rounded-full bg-slate-300" />
            <span className="block h-1.5 w-10/12 rounded-full bg-slate-300" />
            <span className="mt-2 block h-1 w-14 rounded-full bg-slate-500" />
            <span className="block h-1.5 w-full rounded-full bg-slate-300" />
            <span
              className={`block h-1.5 rounded-full bg-slate-300 ${
                isDense ? 'w-full' : 'w-8/12'
              }`}
            />
          </span>
        </span>
      </span>
    </span>
  );
}

export function DesignPanel({
  selectedThemeId,
  onThemeChange,
  formatSelection,
  onFormatChange,
  customDesignYaml,
  onCustomDesignYamlChange,
}: {
  selectedThemeId: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  formatSelection: RenderFormatSelection;
  onFormatChange: (formats: RenderFormatSelection) => void;
  customDesignYaml: string;
  onCustomDesignYamlChange: (yaml: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showCustomYaml, setShowCustomYaml] = useState(false);
  const selectedTheme = templateCards.find((t) => t.id === selectedThemeId) ?? templateCards[0];
  const extensions = useMemo(() => [yaml()], []);
  const editorTheme = !mounted || resolvedTheme !== 'light' ? oneDark : 'light';
  const atLeastOne = Object.values(formatSelection).some(Boolean);

  useEffect(() => {
    const af = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(af);
  }, []);

  const toggleFormat = (key: keyof RenderFormatSelection): void => {
    const next = { ...formatSelection, [key]: !formatSelection[key] };
    // At least one format must remain enabled.
    if (Object.values(next).every((v) => !v)) return;
    onFormatChange(next);
  };

  return (
    <div className="space-y-5">
      {/* Theme selector */}
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
            className={`rounded-[10px] border p-4 text-left transition duration-200 ${
              selectedThemeId === template.id
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border bg-surface-secondary text-foreground hover:border-border-tertiary'
            }`}
            key={template.id}
            type="button"
            onClick={() => onThemeChange(template.id)}
          >
            <ThemeMiniPreview
              isSelected={selectedThemeId === template.id}
              template={template}
            />
            <span className="flex items-center justify-between gap-2">
              <span className="block text-sm font-semibold">{template.name}</span>
              {selectedThemeId === template.id ? (
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
              ) : null}
            </span>
            <span className="mt-2 block text-xs text-muted">{template.description}</span>
            <span className="mt-3 inline-flex rounded-md bg-default px-2 py-1 text-[11px] font-semibold text-muted">
              {selectedThemeId === template.id ? 'Aplicado' : template.status}
            </span>
          </button>
        ))}
      </div>

      {/* Format selection */}
      <div className="rounded-[10px] border border-border bg-surface-secondary p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Formatos de salida</p>
            <p className="mt-1 text-xs text-muted">Al menos uno debe estar habilitado.</p>
          </div>
          {!atLeastOne ? (
            <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">
              Selecciona al menos uno
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(formatSelection) as Array<keyof RenderFormatSelection>).map((key) => (
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2 transition-colors ${
                formatSelection[key]
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border bg-surface text-muted hover:border-border-tertiary'
              }`}
              key={key}
            >
              <Switch
                aria-label={FORMAT_LABELS[key]}
                isSelected={formatSelection[key]}
                size="sm"
                onChange={() => toggleFormat(key)}
              >
                {() => null}
              </Switch>
              <span className="text-sm font-semibold">{FORMAT_LABELS[key]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Idioma y salida info */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[10px] border border-border bg-surface-secondary p-4">
          <p className="text-sm font-semibold text-foreground">Idioma</p>
          <p className="mt-2 text-sm text-muted">Español</p>
        </div>
        <div className="rounded-[10px] border border-border bg-surface-secondary p-4">
          <p className="text-sm font-semibold text-foreground">Motor</p>
          <p className="mt-2 text-sm text-muted">Typst + RenderCV</p>
        </div>
      </div>

      {/* Custom design YAML editor */}
      <div className="rounded-[10px] border border-border bg-surface-secondary overflow-hidden">
        <button
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-tertiary/50 transition-colors"
          type="button"
          onClick={() => setShowCustomYaml((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <Code2 aria-hidden="true" className="size-4 text-accent" />
            <span className="text-sm font-semibold text-foreground">YAML de diseño personalizado</span>
          </div>
          <Chip color="default" size="sm" variant="soft">
            {showCustomYaml ? 'Ocultar' : 'Editar'}
          </Chip>
        </button>
        {showCustomYaml ? (
          <div className="border-t border-separator">
            <div className="flex items-center justify-between gap-2 border-b border-separator px-3 py-2">
              <span className="text-xs text-muted">design.yaml — anula el tema base</span>
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => onCustomDesignYamlChange('')}
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
                Usar tema base
              </Button>
            </div>
            <CodeMirror
              aria-label="YAML de diseño personalizado"
              extensions={extensions}
              height="200px"
              placeholder={buildDesignYaml(selectedThemeId)}
              theme={editorTheme}
              value={customDesignYaml}
              onChange={onCustomDesignYamlChange}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
