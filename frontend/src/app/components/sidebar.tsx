'use client';

import { Button } from '@heroui/react';
import { FileText, RefreshCcw } from 'lucide-react';

export function Sidebar({
  sampleStatus,
  onLoadSample,
}: {
  sampleStatus: string;
  onLoadSample: () => void;
}) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-separator bg-background-secondary lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-separator px-5">
        <div className="grid size-9 place-items-center rounded-[12px] border border-accent/25 bg-accent-soft text-accent">
          <FileText aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">CV Studio</p>
          <p className="truncate text-xs text-muted">Editor web</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4">
        <div className="rounded-[20px] border border-border bg-surface px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Archivo actual</p>
          <p className="mt-2 truncate text-sm font-semibold text-foreground">cv.yaml</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{sampleStatus}</p>
        </div>
      </div>

      <div className="border-t border-separator p-4">
        <Button fullWidth size="sm" variant="secondary" onPress={onLoadSample}>
          <RefreshCcw aria-hidden="true" className="size-4" />
          Cargar muestra
        </Button>
      </div>
    </aside>
  );
}
