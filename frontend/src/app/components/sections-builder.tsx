'use client';

import { Button, Chip, Input, Label, TextArea, TextField } from '@heroui/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { entryTemplates, getTemplateById } from '@/constants/templates';
import type { EntryTemplateId } from '@/lib/types';
import {
  getCvSections,
  highlightsToText,
  inferSectionTemplateId,
  inferTemplateIdFromEntry,
  isSectionCompatibleWithTemplate,
  isRecordLike,
  parseYamlRecord,
  extractSectionTitles,
  resolveEntryDestinationSection,
  stringValue,
} from '@/lib/yaml-helpers';

// ─── Micro field components ───────────────────────────────────────────────────

function SectionTextInput({
  label,
  name,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField fullWidth name={name}>
      <Label className="text-xs font-semibold text-muted">{label}</Label>
      <Input
        placeholder={placeholder}
        value={value}
        variant="secondary"
        onChange={(e) => onChange(e.target.value)}
      />
    </TextField>
  );
}

function SectionTextArea({
  label,
  name,
  value,
  placeholder,
  rows = 4,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <TextField fullWidth name={name}>
      <Label className="text-xs font-semibold text-muted">{label}</Label>
      <TextArea
        className="min-h-24 resize-y text-sm leading-6"
        placeholder={placeholder}
        rows={rows}
        value={value}
        variant="secondary"
        onChange={(e) => onChange(e.target.value)}
      />
    </TextField>
  );
}

// ─── SectionEntryEditor ───────────────────────────────────────────────────────

function SectionEntryEditor({
  sectionTitle,
  entry,
  entryIndex,
  templateId,
  onEntryChange,
}: {
  sectionTitle: string;
  entry: unknown;
  entryIndex: number;
  templateId: EntryTemplateId;
  onEntryChange: (sectionTitle: string, entryIndex: number, fieldKey: string, value: string) => void;
}) {
  const update = (fieldKey: string, value: string): void => {
    onEntryChange(sectionTitle, entryIndex, fieldKey, value);
  };
  const rec = isRecordLike(entry) ? entry : {};
  const name = (k: string): string => `${sectionTitle}-${entryIndex}-${k}`;
  const input = (k: string, label: string, ph?: string): React.ReactNode => (
    <SectionTextInput
      key={k}
      label={label}
      name={name(k)}
      placeholder={ph}
      value={stringValue(rec[k])}
      onChange={(v) => update(k, v)}
    />
  );
  const highlights = (
    <SectionTextArea
      label="Logros o detalles"
      name={name('highlightsText')}
      placeholder="Una línea por logro o detalle"
      value={highlightsToText(rec.highlights)}
      onChange={(v) => update('highlightsText', v)}
    />
  );

  if (templateId === 'text') {
    return (
      <SectionTextArea
        label="Texto"
        name={name('text')}
        rows={5}
        value={stringValue(entry)}
        onChange={(v) => update('$text', v)}
      />
    );
  }
  if (templateId === 'experience') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {input('company', 'Empresa', 'Nombre de la empresa')}
        {input('position', 'Cargo', 'Cargo o rol')}
        {input('location', 'Ubicación', 'Ciudad o remoto')}
        <div className="grid gap-3 sm:grid-cols-2">
          {input('start_date', 'Inicio', '2024-01')}
          {input('end_date', 'Fin', 'present')}
        </div>
        <div className="md:col-span-2">{highlights}</div>
      </div>
    );
  }
  if (templateId === 'education') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {input('institution', 'Institución', 'Universidad o institución')}
        {input('area', 'Área', 'Área de estudio')}
        {input('degree', 'Título', 'Título obtenido')}
        {input('location', 'Ubicación', 'Ciudad')}
        <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
          {input('start_date', 'Inicio', '2020-01')}
          {input('end_date', 'Fin', '2024-12')}
        </div>
        <div className="md:col-span-2">{highlights}</div>
      </div>
    );
  }
  if (templateId === 'normal') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {input('name', 'Nombre', 'Nombre del proyecto')}
        {input('location', 'Ubicación', 'Remoto')}
        {input('date', 'Fecha', '2025')}
        <div className="md:col-span-2">{highlights}</div>
      </div>
    );
  }
  if (templateId === 'publication') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {input('title', 'Título', 'Título de la publicación')}
        {input('journal', 'Revista o conferencia')}
        {input('date', 'Fecha', '2025-01')}
        {input('doi', 'DOI')}
        <div className="md:col-span-2">
          <SectionTextArea
            label="Autores"
            name={name('authorsText')}
            placeholder="Un autor por línea"
            value={highlightsToText(rec.authors)}
            onChange={(v) => update('authorsText', v)}
          />
        </div>
      </div>
    );
  }
  if (templateId === 'bullet') return input('bullet', 'Viñeta', 'Premio, certificación o reconocimiento');
  if (templateId === 'numbered') return input('number', 'Elemento numerado', 'Logro o resultado');
  if (templateId === 'reversedNumbered') return input('reversed_number', 'Elemento inverso', 'Charla, ponencia o actividad');

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {input('label', 'Etiqueta', 'Lenguajes')}
      {input('details', 'Detalle', 'Python, TypeScript, SQL')}
    </div>
  );
}

// ─── ActiveSectionEditor ──────────────────────────────────────────────────────

function ActiveSectionEditor({
  yamlText,
  selectedSection,
  onInsertEntry,
  onEntryChange,
}: {
  yamlText: string;
  selectedSection: string;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
  onEntryChange: (sectionTitle: string, entryIndex: number, fieldKey: string, value: string) => void;
}) {
  const data = parseYamlRecord(yamlText);
  const sections = data ? getCvSections(data) : null;
  const sectionValue = selectedSection ? sections?.[selectedSection] : null;
  const entries = Array.isArray(sectionValue) ? sectionValue : [];
  const templateId = inferSectionTemplateId(entries) ?? 'text';
  const template = getTemplateById(templateId);
  const Icon = template.icon;

  if (!selectedSection) {
    return (
      <div className="rounded-[20px] border border-dashed border-border bg-surface-secondary p-4">
        <p className="text-sm font-semibold text-foreground">Ninguna sección seleccionada</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Selecciona una sección existente para editar sus entradas desde el formulario.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[20px] border border-border bg-surface-secondary p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted">Editar sección</p>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="min-w-0 text-base font-semibold text-foreground">{selectedSection}</h4>
            <Chip color="accent" size="sm" variant="soft">
              <Icon aria-hidden="true" className="size-3.5" />
              {template.label}
            </Chip>
            <Chip color="default" size="sm" variant="soft">
              {entries.length} entradas
            </Chip>
          </div>
        </div>
        <Button size="sm" variant="secondary" onPress={() => onInsertEntry(selectedSection, templateId)}>
          <Plus aria-hidden="true" className="size-4" />
          Agregar
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-border px-3 py-3 text-sm text-muted">
          Esta sección está vacía. Agrega una entrada para editarla aquí.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div className="rounded-[18px] border border-border bg-surface p-4" key={`${selectedSection}-${index}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Entrada {index + 1}</p>
                <Chip color="default" size="sm" variant="soft">
                  #{index + 1}
                </Chip>
              </div>
              <SectionEntryEditor
                entry={entry}
                entryIndex={index}
                sectionTitle={selectedSection}
                templateId={inferTemplateIdFromEntry(entry) ?? templateId}
                onEntryChange={onEntryChange}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SectionsBuilder (public) ─────────────────────────────────────────────────

export function SectionsBuilder({
  yamlText,
  onInsertEntry,
  onSectionEntryChange,
}: {
  yamlText: string;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
  onSectionEntryChange: (sectionTitle: string, entryIndex: number, fieldKey: string, value: string) => void;
}) {
  const sectionTitles = extractSectionTitles(yamlText);
  const [selectedSection, setSelectedSection] = useState(sectionTitles[0] ?? 'Experiencia');
  const data = parseYamlRecord(yamlText);
  const sections = data ? getCvSections(data) : null;
  const selectedSectionForInsert = sectionTitles.includes(selectedSection) ? selectedSection : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground" id="sections-info-heading">
            Secciones y entradas
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Elige el destino y agrega bloques con una estructura lista para renderizar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="default" size="sm" variant="soft">
            {sectionTitles.length} secciones
          </Chip>
          <Chip color="default" size="sm" variant="soft">
            {selectedSectionForInsert || 'Destino automático'}
          </Chip>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.15fr)]">
        <div className="min-w-0 space-y-3 rounded-[20px] border border-border bg-surface-secondary p-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted">Secciones existentes</p>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2 2xl:grid-cols-1">
              {sectionTitles.map((title, index) => (
                <button
                  aria-pressed={selectedSection === title}
                  className={`flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-full border px-4 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    selectedSection === title
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border bg-surface text-foreground hover:border-border-tertiary'
                  }`}
                  key={`${title}-${index}`}
                  type="button"
                  onClick={() => setSelectedSection((s) => (s === title ? '' : title))}
                >
                  <span className="min-w-0 truncate text-sm font-semibold">{title}</span>
                  {sections?.[title] ? (
                    <span className="shrink-0 rounded-full bg-default px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {getTemplateById(inferSectionTemplateId(sections[title]) ?? 'text').label}
                    </span>
                  ) : null}
                </button>
              ))}
              {sectionTitles.length === 0 ? (
                <p className="rounded-[16px] border border-dashed border-border px-3 py-3 text-sm text-muted">
                  Todavía no hay secciones. Usa un bloque de contenido para crear una.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <ActiveSectionEditor
          onEntryChange={onSectionEntryChange}
          onInsertEntry={onInsertEntry}
          selectedSection={selectedSectionForInsert}
          yamlText={yamlText}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Agregar contenido</h4>
            <p className="mt-1 text-sm leading-6 text-muted">
              Estos bloques crean secciones editables en el formulario y visibles en el PDF.
            </p>
          </div>
          <Chip color="default" size="sm" variant="soft">
            {entryTemplates.length} tipos
          </Chip>
        </div>
        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
          {entryTemplates.map((template) => {
            const Icon = template.icon;
            const destination = resolveEntryDestinationSection(
              yamlText,
              selectedSectionForInsert,
              '',
              template.id,
            );
            const sv = selectedSectionForInsert ? sections?.[selectedSectionForInsert] : undefined;
            const autoRedirect =
              selectedSectionForInsert &&
              destination !== selectedSectionForInsert &&
              !isSectionCompatibleWithTemplate(sv, template.id);
            return (
              <button
                aria-label={`Agregar ${template.label} en ${destination}`}
                className="group flex min-h-[132px] min-w-0 flex-col items-start gap-3 rounded-[18px] border border-border bg-surface-secondary px-4 py-3 text-left transition-colors hover:border-accent/70 hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                key={template.id}
                type="button"
                onClick={() => {
                  onInsertEntry(destination, template.id);
                  setSelectedSection(destination);
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 text-base font-semibold leading-5 text-foreground">{template.label}</span>
                </span>
                <span className="block min-w-0 flex-1 text-sm leading-5 text-muted">{template.description}</span>
                <span className="block min-w-0 text-xs font-semibold leading-5 text-accent">
                  <span className="text-muted">Destino:</span> {destination}
                </span>
                {autoRedirect ? (
                  <span className="block min-w-0 rounded-[12px] bg-warning/10 px-2.5 py-1.5 text-xs font-semibold leading-4 text-warning">
                    Se usa una sección compatible para evitar errores de render.
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
