'use client';

import Image from 'next/image';
import { Button } from '@heroui/react';
import { FileUp, RefreshCcw } from 'lucide-react';
import { useRef } from 'react';

export function Sidebar({
  sampleStatus,
  onImportPdf,
  onLoadSample,
}: {
  sampleStatus: string;
  onImportPdf: (file: File) => void;
  onLoadSample: () => void;
}) {
  const pdfInputRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-separator bg-background-secondary lg:flex lg:flex-col">
      {/* Logo header */}
      <div className="flex h-16 items-center gap-3 border-b border-separator px-5">
        <div className="relative size-9 shrink-0 overflow-hidden rounded-[12px]">
          <Image
            alt="EasyCV logo"
            className="object-contain"
            fill
            priority
            src="/logo.png"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">EasyCV</p>
          <p className="truncate text-xs text-muted">Editor web</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4">
        <div className="rounded-[20px] border border-border bg-surface px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Archivo actual</p>
          <p className="mt-2 truncate text-sm font-semibold text-foreground">cv.yaml</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{sampleStatus}</p>
        </div>

        <div className="rounded-[20px] border border-border bg-surface px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Importar CV</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Sube un PDF con texto seleccionable para convertirlo a YAML editable.
          </p>
          <input
            accept="application/pdf,.pdf"
            className="hidden"
            ref={pdfInputRef}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImportPdf(file);
              event.target.value = '';
            }}
          />
          <Button
            fullWidth
            className="mt-3"
            size="sm"
            variant="primary"
            onPress={() => pdfInputRef.current?.click()}
          >
            <FileUp aria-hidden="true" className="size-4" />
            Subir PDF
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-separator p-4">
        <Button fullWidth size="sm" variant="secondary" onPress={onLoadSample}>
          <RefreshCcw aria-hidden="true" className="size-4" />
          Cargar muestra
        </Button>
      </div>
    </aside>
  );
}
