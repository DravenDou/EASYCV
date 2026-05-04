'use client';

import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { lintGutter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { Button } from '@heroui/react';
import { Copy, TerminalSquare } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';

import type { EntryTemplateId } from '@/lib/types';

function formatNumber(value: number): string {
  return value.toLocaleString('es-ES');
}

export function YamlEditor({
  yamlText,
  yamlLineCount,
  onYamlChange,
  onCopyYaml,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  yamlText: string;
  yamlLineCount: number;
  onYamlChange: (value: string) => void;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
  onCopyYaml?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const extensions = useMemo(() => [yaml(), lintGutter()], []);
  const editorTheme = !mounted || resolvedTheme !== 'light' ? oneDark : 'light';

  useEffect(() => {
    const af = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(af);
  }, []);

  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-field-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator px-3 py-2">
        {/* Left: filename */}
        <div className="flex items-center gap-2">
          <TerminalSquare aria-hidden="true" className="size-4 text-accent" />
          <span className="text-xs font-semibold text-foreground">cv.yaml</span>
        </div>

        {/* Right: stats + actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs font-semibold tabular-nums text-muted">
            {formatNumber(yamlLineCount)} líneas
          </span>
          <span className="rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs font-semibold tabular-nums text-muted">
            {formatNumber(yamlText.length)} car.
          </span>

          {onUndo ? (
            <Button isDisabled={!canUndo} size="sm" variant="tertiary" onPress={onUndo}>
              ↩ Deshacer
            </Button>
          ) : null}
          {onRedo ? (
            <Button isDisabled={!canRedo} size="sm" variant="tertiary" onPress={onRedo}>
              ↪ Rehacer
            </Button>
          ) : null}
          {onCopyYaml ? (
            <Button size="sm" variant="tertiary" onPress={onCopyYaml}>
              <Copy aria-hidden="true" className="size-4" />
              Copiar
            </Button>
          ) : null}
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
          height="min(560px, 62dvh)"
          placeholder="Pega aquí tu YAML del CV..."
          theme={editorTheme}
          value={yamlText}
          onChange={onYamlChange}
        />
      </div>
    </div>
  );
}
