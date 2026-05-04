'use client';

import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import { Button, Chip, Switch, Label } from '@heroui/react';
import { Palette, RotateCcw, Code2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';

import { templateCards } from '@/constants/templates';
import type { RenderFormatSelection, ThemeId } from '@/lib/types';

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

      {/* Format selection */}
      <div className="rounded-[20px] border border-border bg-surface-secondary p-4 space-y-3">
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
              className={`flex cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-2 transition-colors ${
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
        <div className="rounded-[20px] border border-border bg-surface-secondary p-4">
          <p className="text-sm font-semibold text-foreground">Idioma</p>
          <p className="mt-2 text-sm text-muted">Español</p>
        </div>
        <div className="rounded-[20px] border border-border bg-surface-secondary p-4">
          <p className="text-sm font-semibold text-foreground">Motor</p>
          <p className="mt-2 text-sm text-muted">Typst + RenderCV</p>
        </div>
      </div>

      {/* Custom design YAML editor */}
      <div className="rounded-[20px] border border-border bg-surface-secondary overflow-hidden">
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
                onPress={() => onCustomDesignYamlChange(buildDesignYaml(selectedThemeId))}
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
                Resetear
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
