'use client';

import { Button, Chip, Input, Label, TextArea, TextField } from '@heroui/react';
import { Plus } from 'lucide-react';
import type { EntryTemplateId, ExperienceEntryForm } from '@/lib/types';
import { extractExperienceEntries } from '@/lib/yaml-helpers';

export function ExperienceEntriesForm({
  yamlText,
  onExperienceEntryChange,
  onInsertEntry,
}: {
  yamlText: string;
  onExperienceEntryChange: (
    sectionTitle: string,
    index: number,
    updates: Partial<Omit<ExperienceEntryForm, 'sectionTitle' | 'index'>>,
  ) => void;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
}) {
  const entries = extractExperienceEntries(yamlText);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground" id="experience-info-heading">
            Experiencia
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Edita empresas, cargos, fechas y logros sin tocar el YAML manualmente.
          </p>
        </div>
        <Button size="sm" variant="secondary" onPress={() => onInsertEntry('Experiencia', 'experience')}>
          <Plus aria-hidden="true" className="size-4" />
          Agregar
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-border bg-surface-secondary p-4">
          <p className="text-sm font-semibold text-foreground">No hay entradas de experiencia.</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Agrega una entrada para empezar a editarla desde el formulario.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              className="rounded-[20px] border border-border bg-surface-secondary p-4"
              key={`${entry.sectionTitle}-${entry.index}`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {entry.company || 'Nueva experiencia'}
                  </p>
                  <p className="truncate text-xs text-muted">{entry.position || 'Cargo por definir'}</p>
                </div>
                <Chip color="default" size="sm" variant="soft">
                  #{entry.index + 1}
                </Chip>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextField fullWidth name={`company-${entry.index}`}>
                  <Label className="text-xs font-semibold text-muted">Empresa</Label>
                  <Input
                    value={entry.company}
                    variant="secondary"
                    onChange={(e) =>
                      onExperienceEntryChange(entry.sectionTitle, entry.index, { company: e.target.value })
                    }
                  />
                </TextField>
                <TextField fullWidth name={`position-${entry.index}`}>
                  <Label className="text-xs font-semibold text-muted">Cargo</Label>
                  <Input
                    value={entry.position}
                    variant="secondary"
                    onChange={(e) =>
                      onExperienceEntryChange(entry.sectionTitle, entry.index, { position: e.target.value })
                    }
                  />
                </TextField>
                <TextField fullWidth name={`location-${entry.index}`}>
                  <Label className="text-xs font-semibold text-muted">Ubicación</Label>
                  <Input
                    value={entry.location}
                    variant="secondary"
                    onChange={(e) =>
                      onExperienceEntryChange(entry.sectionTitle, entry.index, { location: e.target.value })
                    }
                  />
                </TextField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField fullWidth name={`start-date-${entry.index}`}>
                    <Label className="text-xs font-semibold text-muted">Inicio</Label>
                    <Input
                      placeholder="2024-01"
                      value={entry.start_date}
                      variant="secondary"
                      onChange={(e) =>
                        onExperienceEntryChange(entry.sectionTitle, entry.index, { start_date: e.target.value })
                      }
                    />
                  </TextField>
                  <TextField fullWidth name={`end-date-${entry.index}`}>
                    <Label className="text-xs font-semibold text-muted">Fin</Label>
                    <Input
                      placeholder="present"
                      value={entry.end_date}
                      variant="secondary"
                      onChange={(e) =>
                        onExperienceEntryChange(entry.sectionTitle, entry.index, { end_date: e.target.value })
                      }
                    />
                  </TextField>
                </div>
              </div>

              <TextField fullWidth className="mt-4" name={`highlights-${entry.index}`}>
                <Label className="text-xs font-semibold text-muted">Logros</Label>
                <TextArea
                  className="min-h-28 resize-y font-mono text-[13px] leading-5"
                  rows={5}
                  value={entry.highlightsText}
                  variant="secondary"
                  onChange={(e) =>
                    onExperienceEntryChange(entry.sectionTitle, entry.index, { highlightsText: e.target.value })
                  }
                />
              </TextField>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
