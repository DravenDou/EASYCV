'use client';

import { Button, Chip, Input, TextArea } from '@heroui/react';
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  GripVertical,
  ListTree,
  Plus,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';

import { personalFields, socialFields } from '@/constants/fields';
import { entryTemplates, getTemplateById } from '@/constants/templates';
import type { CvFieldPath, EntryTemplateId, PersonalFieldKey, SocialNetworkKey } from '@/lib/types';
import {
  extractCvValue,
  extractSocialUsername,
  getCvSections,
  highlightsToText,
  inferSectionTemplateId,
  inferTemplateIdFromEntry,
  isRecordLike,
  parseYamlRecord,
  resolveEntryDestinationSection,
  stringValue,
} from '@/lib/yaml-helpers';

function prettyFieldLabel(fieldKey: string): string {
  const knownLabels: Record<string, string> = {
    area: 'Área',
    authors: 'Autores',
    bullet: 'Viñeta',
    company: 'Empresa',
    date: 'Fecha',
    degree: 'Título',
    details: 'Detalle',
    doi: 'DOI',
    end_date: 'Fin',
    highlights: 'Logros',
    institution: 'Institución',
    journal: 'Revista',
    label: 'Etiqueta',
    location: 'Ubicación',
    name: 'Nombre',
    number: 'Número',
    position: 'Cargo',
    reversed_number: 'Elemento',
    start_date: 'Inicio',
    summary: 'Resumen',
    title: 'Título',
    url: 'URL',
  };

  return knownLabels[fieldKey] ?? fieldKey.replaceAll('_', ' ');
}

function ListRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 items-start gap-2 border-b border-separator/80 py-3 last:border-b-0 sm:grid-cols-[120px_minmax(0,1fr)] lg:grid-cols-[136px_minmax(0,1fr)]">
      <p className="text-xs font-semibold leading-10 text-muted">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CompactInput({
  ariaLabel,
  value,
  placeholder,
  type,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      aria-label={ariaLabel}
      className="cv-list-input"
      fullWidth
      placeholder={placeholder}
      type={type}
      value={value}
      variant="secondary"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function CompactTextArea({
  ariaLabel,
  value,
  placeholder,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextArea
      aria-label={ariaLabel}
      className="cv-list-textarea"
      fullWidth
      placeholder={placeholder}
      rows={6}
      value={value}
      variant="secondary"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

const singleBlockTextSections = new Set(['summary', 'resumen', 'profile', 'perfil']);

function fieldPathToEntryKey(path: CvFieldPath | null): string | null {
  if (!path || path.length < 4) return null;
  if (path[0] !== 'cv' || path[1] !== 'sections') return null;
  const sectionTitle = path[2];
  const entryIndex = Number(path[3]);
  if (!sectionTitle || !Number.isInteger(entryIndex)) return null;
  return `${sectionTitle}::${entryIndex}`;
}

function isSingleBlockTextSection(sectionTitle: string, entries: unknown[]): boolean {
  return (
    singleBlockTextSections.has(sectionTitle.trim().toLowerCase()) &&
    entries.length <= 1 &&
    entries.every((entry) => typeof entry === 'string')
  );
}

function textEntriesToParagraph(entries: unknown[]): string {
  return entries
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
    .join(' ');
}

function EditableSectionTitle({
  title,
  onRenameSection,
}: {
  title: string;
  onRenameSection: (sectionTitle: string, nextTitle: string) => void;
}) {
  const [draftTitle, setDraftTitle] = useState(title);

  const commitTitle = (): void => {
    const nextTitle = draftTitle.trim();
    if (nextTitle && nextTitle !== title) onRenameSection(title, nextTitle);
    if (!nextTitle) setDraftTitle(title);
  };

  return (
    <Input
      aria-label={`Renombrar sección ${title}`}
      className="cv-section-title-input"
      value={draftTitle}
      variant="secondary"
      onBlur={commitTitle}
      onChange={(event) => setDraftTitle(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          setDraftTitle(title);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function PersonalList({
  yamlText,
  onFieldChange,
}: {
  yamlText: string;
  onFieldChange: (field: PersonalFieldKey, value: string) => void;
}) {
  return (
    <section className="rounded-[10px] border border-border bg-surface-secondary px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">CV</h3>
        <Chip color="default" size="sm" variant="soft">
          Datos base
        </Chip>
      </div>

      {personalFields.map((field) => (
        <ListRow key={field.key} label={field.label}>
          <CompactInput
            ariaLabel={field.label}
            placeholder={field.placeholder}
            type={field.type}
            value={extractCvValue(yamlText, field.key)}
            onChange={(value) => onFieldChange(field.key, value)}
          />
        </ListRow>
      ))}
    </section>
  );
}

function SocialList({
  yamlText,
  onSocialFieldChange,
}: {
  yamlText: string;
  onSocialFieldChange: (network: SocialNetworkKey, value: string) => void;
}) {
  return (
    <section className="rounded-[10px] border border-border bg-surface-secondary px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Redes profesionales</h3>
        <Chip color="default" size="sm" variant="soft">
          {socialFields.length}
        </Chip>
      </div>

      {socialFields.map((field) => (
        <ListRow key={field.network} label={field.label}>
          <CompactInput
            ariaLabel={field.label}
            placeholder={field.placeholder}
            value={extractSocialUsername(yamlText, field.network)}
            onChange={(value) => onSocialFieldChange(field.network, value)}
          />
        </ListRow>
      ))}
    </section>
  );
}

function SectionFieldEditor({
  sectionTitle,
  entryIndex,
  fieldKey,
  value,
  onSectionEntryChange,
}: {
  sectionTitle: string;
  entryIndex: number;
  fieldKey: string;
  value: unknown;
  onSectionEntryChange: (
    sectionTitle: string,
    entryIndex: number,
    fieldKey: string,
    value: string,
  ) => void;
}) {
  const updateKey =
    fieldKey === 'highlights'
      ? 'highlightsText'
      : fieldKey === 'authors'
        ? 'authorsText'
        : fieldKey;
  const arrayValue = Array.isArray(value) ? highlightsToText(value) : '';
  const textValue = Array.isArray(value) ? arrayValue : stringValue(value);
  const isLongField =
    Array.isArray(value) || fieldKey === 'summary' || fieldKey === 'highlights';

  return (
    <ListRow label={prettyFieldLabel(fieldKey)}>
      {isLongField ? (
        <CompactTextArea
          ariaLabel={`${sectionTitle} ${prettyFieldLabel(fieldKey)}`}
          placeholder="Una línea por elemento"
          value={textValue}
          onChange={(nextValue) =>
            onSectionEntryChange(sectionTitle, entryIndex, updateKey, nextValue)
          }
        />
      ) : (
        <CompactInput
          ariaLabel={`${sectionTitle} ${prettyFieldLabel(fieldKey)}`}
          value={textValue}
          onChange={(nextValue) =>
            onSectionEntryChange(sectionTitle, entryIndex, updateKey, nextValue)
          }
        />
      )}
    </ListRow>
  );
}

function EntryListEditor({
  sectionTitle,
  entry,
  entryIndex,
  isOpen,
  isDragging,
  isDragTarget,
  isSelectedFromPdf,
  fallbackTemplateId,
  onDeleteEntry,
  onDuplicateEntry,
  onDragEndEntry,
  onDragOverEntry,
  onDragStartEntry,
  onDropEntry,
  onOpenChange,
  onSectionEntryChange,
}: {
  sectionTitle: string;
  entry: unknown;
  entryIndex: number;
  isOpen: boolean;
  isDragging: boolean;
  isDragTarget: boolean;
  isSelectedFromPdf: boolean;
  fallbackTemplateId: EntryTemplateId;
  onDeleteEntry: (sectionTitle: string, entryIndex: number) => void;
  onDuplicateEntry: (sectionTitle: string, entryIndex: number) => void;
  onDragEndEntry: () => void;
  onDragOverEntry: (sectionTitle: string, entryIndex: number) => void;
  onDragStartEntry: (sectionTitle: string, entryIndex: number) => void;
  onDropEntry: (sectionTitle: string, entryIndex: number) => void;
  onOpenChange: (isOpen: boolean) => void;
  onSectionEntryChange: (
    sectionTitle: string,
    entryIndex: number,
    fieldKey: string,
    value: string,
  ) => void;
}) {
  const templateId = inferTemplateIdFromEntry(entry) ?? fallbackTemplateId;
  const template = getTemplateById(templateId);
  const Icon = template.icon;
  const shouldReduceMotion = useReducedMotion();
  const entryRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isSelectedFromPdf) return;
    entryRef.current?.scrollIntoView({
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
      block: 'nearest',
    });
  }, [isSelectedFromPdf, shouldReduceMotion]);

  return (
    <motion.section
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      className="cv-entry-details rounded-[10px] border border-border bg-surface px-3 py-2"
      data-drag-target={isDragTarget ? 'true' : 'false'}
      data-dragging={isDragging ? 'true' : 'false'}
      data-open={isOpen ? 'true' : 'false'}
      data-pdf-selected={isSelectedFromPdf ? 'true' : 'false'}
      ref={entryRef}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      layout
      onDragOver={(event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDragOverEntry(sectionTitle, entryIndex);
      }}
      onDrop={(event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        onDropEntry(sectionTitle, entryIndex);
      }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          aria-label={`Arrastrar ${template.label} ${entryIndex + 1}`}
          className="cv-entry-drag-handle"
          draggable
          type="button"
          onDragEnd={onDragEndEntry}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', `${sectionTitle}:${entryIndex}`);
            onDragStartEntry(sectionTitle, entryIndex);
          }}
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
        <button
          aria-expanded={isOpen}
          className="cv-entry-summary flex min-w-0 flex-1 cursor-pointer list-none items-center gap-3 py-2 text-left"
          type="button"
          onClick={() => onOpenChange(!isOpen)}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">
              {template.label} {entryIndex + 1}
            </span>
            <span className="block truncate text-xs text-muted">
              {typeof entry === 'string'
                ? entry || 'Texto pendiente'
                : stringValue(isRecordLike(entry) ? entry.name ?? entry.company ?? entry.title : '') ||
                  'Campos editables'}
            </span>
          </span>
          <span className="rounded-full bg-default px-2 py-0.5 text-[11px] font-semibold text-muted">
            #{entryIndex + 1}
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface-secondary text-muted">
            <ChevronDown aria-hidden="true" className="cv-entry-chevron size-4" />
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            aria-label="Duplicar entrada"
            isIconOnly
            size="sm"
            variant="tertiary"
            onPress={() => onDuplicateEntry(sectionTitle, entryIndex)}
          >
            <Copy aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            aria-label="Eliminar entrada"
            isIconOnly
            size="sm"
            variant="danger"
            onPress={() => {
              if (window.confirm('¿Eliminar esta entrada del CV?')) {
                onDeleteEntry(sectionTitle, entryIndex);
              }
            }}
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, height: 'auto', y: 0 }
            }
            className="cv-entry-body mt-3 overflow-hidden border-t border-separator pt-3"
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {typeof entry === 'string' ? (
              <ListRow label="Texto">
                <CompactTextArea
                  ariaLabel={`${sectionTitle} texto ${entryIndex + 1}`}
                  value={entry}
                  onChange={(value) =>
                    onSectionEntryChange(sectionTitle, entryIndex, '$text', value)
                  }
                />
              </ListRow>
            ) : isRecordLike(entry) ? (
              Object.entries(entry).map(([fieldKey, value]) => (
                <SectionFieldEditor
                  entryIndex={entryIndex}
                  fieldKey={fieldKey}
                  key={`${sectionTitle}-${entryIndex}-${fieldKey}`}
                  sectionTitle={sectionTitle}
                  value={value}
                  onSectionEntryChange={onSectionEntryChange}
                />
              ))
            ) : (
              <p className="py-2 text-sm text-muted">Esta entrada no se puede editar desde la lista.</p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

function SectionList({
  yamlText,
  selectedFieldPath,
  onInsertEntry,
  onDeleteEntry,
  onDuplicateEntry,
  onReorderEntry,
  onReplaceTextSection,
  onRenameSection,
  onDeleteSection,
  onSectionEntryChange,
}: {
  yamlText: string;
  selectedFieldPath: CvFieldPath | null;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
  onDeleteEntry: (sectionTitle: string, entryIndex: number) => void;
  onDuplicateEntry: (sectionTitle: string, entryIndex: number) => void;
  onReorderEntry: (sectionTitle: string, fromIndex: number, toIndex: number) => void;
  onReplaceTextSection: (sectionTitle: string, value: string) => void;
  onRenameSection: (sectionTitle: string, nextTitle: string) => void;
  onDeleteSection: (sectionTitle: string) => void;
  onSectionEntryChange: (
    sectionTitle: string,
    entryIndex: number,
    fieldKey: string,
    value: string,
  ) => void;
}) {
  const data = parseYamlRecord(yamlText);
  const sections = data ? getCvSections(data) : null;
  const sectionEntries = Object.entries(sections ?? {});
  const [openEntries, setOpenEntries] = useState<Record<string, boolean>>({});
  const [draggedEntry, setDraggedEntry] = useState<{
    sectionTitle: string;
    entryIndex: number;
  } | null>(null);
  const [dragTarget, setDragTarget] = useState<{
    sectionTitle: string;
    entryIndex: number;
  } | null>(null);
  const selectedEntryKey = fieldPathToEntryKey(selectedFieldPath);

  const entryKeyFor = (sectionTitle: string, entryIndex: number): string =>
    `${sectionTitle}::${entryIndex}`;

  const setAllEntriesOpen = (isOpen: boolean): void => {
    const nextOpenEntries: Record<string, boolean> = {};
    sectionEntries.forEach(([sectionTitle, sectionValue]) => {
      if (!Array.isArray(sectionValue)) return;
      sectionValue.forEach((_entry, entryIndex) => {
        nextOpenEntries[entryKeyFor(sectionTitle, entryIndex)] = isOpen;
      });
    });
    setOpenEntries(nextOpenEntries);
  };

  const handleDropEntry = (sectionTitle: string, entryIndex: number): void => {
    if (
      draggedEntry &&
      draggedEntry.sectionTitle === sectionTitle &&
      draggedEntry.entryIndex !== entryIndex
    ) {
      onReorderEntry(sectionTitle, draggedEntry.entryIndex, entryIndex);
    }
    setDraggedEntry(null);
    setDragTarget(null);
  };

  if (!data) {
    return (
      <section className="rounded-[10px] border border-dashed border-danger/50 bg-danger/10 px-4 py-4">
        <h3 className="text-sm font-semibold text-danger">YAML no disponible</h3>
        <p className="mt-1 text-sm leading-6 text-muted">
          Corrige el YAML para volver a editar el CV en forma de lista.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[10px] border border-border bg-surface-secondary px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Secciones</h3>
          <p className="mt-1 text-xs text-muted">
            Edita cada bloque como una lista compacta.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip color="default" size="sm" variant="soft">
            {sectionEntries.length} secciones
          </Chip>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => setAllEntriesOpen(true)}
          >
            <ChevronsUpDown aria-hidden="true" className="size-3.5" />
            Expandir
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => setAllEntriesOpen(false)}
          >
            <ChevronsDownUp aria-hidden="true" className="size-3.5" />
            Contraer
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {sectionEntries.map(([sectionTitle, sectionValue]) => {
          const entries = Array.isArray(sectionValue) ? sectionValue : [];
          const templateId = inferSectionTemplateId(sectionValue) ?? 'text';
          const isUnifiedTextSection = isSingleBlockTextSection(sectionTitle, entries);
          return (
            <div
              className="rounded-[10px] border border-border bg-background/40 p-4"
              key={sectionTitle}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-separator pb-2">
                <div className="min-w-[220px] flex-1">
                  <EditableSectionTitle
                    title={sectionTitle}
                    onRenameSection={onRenameSection}
                  />
                  <p className="mt-1 text-xs text-muted">
                    {isUnifiedTextSection
                      ? '1 bloque editable · Texto'
                      : `${entries.length} entradas · ${getTemplateById(templateId).label}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isUnifiedTextSection ? null : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => onInsertEntry(sectionTitle, templateId)}
                    >
                      <Plus aria-hidden="true" className="size-3.5" />
                      Agregar
                    </Button>
                  )}
                  <Button
                    aria-label={`Eliminar sección ${sectionTitle}`}
                    isIconOnly
                    size="sm"
                    variant="danger"
                    onPress={() => {
                      if (window.confirm(`¿Eliminar la sección "${sectionTitle}"?`)) {
                        onDeleteSection(sectionTitle);
                      }
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </Button>
                </div>
              </div>

              {isUnifiedTextSection ? (
                <div className="rounded-[10px] border border-border bg-surface px-3 py-2">
                  <ListRow label="Texto">
                    <CompactTextArea
                      ariaLabel={`${sectionTitle} texto`}
                      value={textEntriesToParagraph(entries)}
                      onChange={(value) => onReplaceTextSection(sectionTitle, value)}
                    />
                  </ListRow>
                </div>
              ) : entries.length > 0 ? (
                <div className="space-y-2">
                  {entries.map((entry, entryIndex) => (
                    <EntryListEditor
                      entry={entry}
                      entryIndex={entryIndex}
                      fallbackTemplateId={templateId}
                      isOpen={
                        selectedEntryKey === entryKeyFor(sectionTitle, entryIndex) ||
                        (openEntries[entryKeyFor(sectionTitle, entryIndex)] ?? entryIndex === 0)
                      }
                      isSelectedFromPdf={
                        selectedEntryKey === entryKeyFor(sectionTitle, entryIndex)
                      }
                      isDragTarget={
                        dragTarget?.sectionTitle === sectionTitle &&
                        dragTarget.entryIndex === entryIndex &&
                        draggedEntry?.entryIndex !== entryIndex
                      }
                      isDragging={
                        draggedEntry?.sectionTitle === sectionTitle &&
                        draggedEntry.entryIndex === entryIndex
                      }
                      key={`${sectionTitle}-${entryIndex}`}
                      sectionTitle={sectionTitle}
                      onDeleteEntry={onDeleteEntry}
                      onDragEndEntry={() => {
                        setDraggedEntry(null);
                        setDragTarget(null);
                      }}
                      onDragOverEntry={(targetSectionTitle, targetEntryIndex) => {
                        if (!draggedEntry || draggedEntry.sectionTitle !== targetSectionTitle) return;
                        setDragTarget({
                          sectionTitle: targetSectionTitle,
                          entryIndex: targetEntryIndex,
                        });
                      }}
                      onDragStartEntry={(dragSectionTitle, dragEntryIndex) => {
                        setDraggedEntry({
                          sectionTitle: dragSectionTitle,
                          entryIndex: dragEntryIndex,
                        });
                      }}
                      onDropEntry={handleDropEntry}
                      onDuplicateEntry={onDuplicateEntry}
                      onOpenChange={(nextIsOpen) =>
                        setOpenEntries((currentOpenEntries) => ({
                          ...currentOpenEntries,
                          [entryKeyFor(sectionTitle, entryIndex)]: nextIsOpen,
                        }))
                      }
                      onSectionEntryChange={onSectionEntryChange}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-[10px] border border-dashed border-border px-3 py-3 text-sm text-muted">
                  Esta sección está vacía.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AddContentList({
  yamlText,
  onInsertEntry,
}: {
  yamlText: string;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
}) {
  return (
    <section className="rounded-[10px] border border-border bg-surface-secondary px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Agregar contenido</h3>
        <Chip color="default" size="sm" variant="soft">
          {entryTemplates.length} tipos
        </Chip>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
        {entryTemplates.map((template) => {
          const Icon = template.icon;
          const destination = resolveEntryDestinationSection(yamlText, '', '', template.id);
          return (
            <button
              className="flex min-w-0 items-center gap-2 rounded-[12px] border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-accent/70 hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              key={template.id}
              type="button"
              onClick={() => onInsertEntry(destination, template.id)}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {template.label}
              </span>
              <span className="hidden shrink-0 rounded-full bg-default px-2 py-0.5 text-[11px] font-semibold text-muted xl:inline">
                {destination}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function CvListEditor({
  yamlText,
  selectedFieldPath,
  onPersonalFieldChange,
  onSocialFieldChange,
  onSectionEntryChange,
  onInsertEntry,
  onDeleteEntry,
  onDuplicateEntry,
  onRenameSection,
  onReorderEntry,
  onReplaceTextSection,
  onDeleteSection,
}: {
  yamlText: string;
  selectedFieldPath: CvFieldPath | null;
  onPersonalFieldChange: (field: PersonalFieldKey, value: string) => void;
  onSocialFieldChange: (network: SocialNetworkKey, value: string) => void;
  onSectionEntryChange: (
    sectionTitle: string,
    entryIndex: number,
    fieldKey: string,
    value: string,
  ) => void;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
  onDeleteEntry: (sectionTitle: string, entryIndex: number) => void;
  onDuplicateEntry: (sectionTitle: string, entryIndex: number) => void;
  onRenameSection: (sectionTitle: string, nextTitle: string) => void;
  onReorderEntry: (sectionTitle: string, fromIndex: number, toIndex: number) => void;
  onReplaceTextSection: (sectionTitle: string, value: string) => void;
  onDeleteSection: (sectionTitle: string) => void;
}) {
  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2 rounded-[10px] border border-border bg-surface-secondary px-4 py-3">
        <ListTree aria-hidden="true" className="size-4 shrink-0 text-accent" />
        <p className="text-sm font-semibold text-foreground">
          Edición rápida en lista
        </p>
        <span className="ml-auto text-xs font-semibold text-muted">
          CV · secciones · entradas
        </span>
      </div>

      <PersonalList yamlText={yamlText} onFieldChange={onPersonalFieldChange} />
      <SocialList yamlText={yamlText} onSocialFieldChange={onSocialFieldChange} />
      <SectionList
        yamlText={yamlText}
        selectedFieldPath={selectedFieldPath}
        onDeleteEntry={onDeleteEntry}
        onDeleteSection={onDeleteSection}
        onDuplicateEntry={onDuplicateEntry}
        onInsertEntry={onInsertEntry}
        onReplaceTextSection={onReplaceTextSection}
        onReorderEntry={onReorderEntry}
        onRenameSection={onRenameSection}
        onSectionEntryChange={onSectionEntryChange}
      />
      <AddContentList yamlText={yamlText} onInsertEntry={onInsertEntry} />
    </div>
  );
}
