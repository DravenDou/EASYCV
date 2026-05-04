'use client';

import { Chip, ScrollShadow, Tabs } from '@heroui/react';
import { ClipboardCheck, Palette, ShieldCheck, TerminalSquare } from 'lucide-react';

import type { EntryTemplateId, ExperienceEntryForm, PersonalFieldKey, RenderFormatSelection, SocialNetworkKey, ThemeId } from '@/lib/types';
import { WorkspacePanel } from './ui-primitives';
import { YamlEditor } from './yaml-editor';
import { PersonalInfoForm } from './personal-info-form';
import { SocialNetworksForm } from './social-networks-form';
import { ExperienceEntriesForm } from './experience-entries-form';
import { SectionsBuilder } from './sections-builder';
import { DesignPanel } from './design-panel';

function formatNumber(n: number): string {
  return n.toLocaleString('es-ES');
}

export function EditorPanel({
  yamlText,
  yamlLineCount,
  selectedThemeId,
  formatSelection,
  customDesignYaml,
  canUndo,
  canRedo,
  onYamlChange,
  onPersonalFieldChange,
  onSocialFieldChange,
  onExperienceEntryChange,
  onSectionEntryChange,
  onInsertEntry,
  onThemeChange,
  onFormatChange,
  onCustomDesignYamlChange,
  onCopyYaml,
  onUndo,
  onRedo,
}: {
  yamlText: string;
  yamlLineCount: number;
  selectedThemeId: ThemeId;
  formatSelection: RenderFormatSelection;
  customDesignYaml: string;
  canUndo: boolean;
  canRedo: boolean;
  onYamlChange: (value: string) => void;
  onPersonalFieldChange: (field: PersonalFieldKey, value: string) => void;
  onSocialFieldChange: (network: SocialNetworkKey, value: string) => void;
  onExperienceEntryChange: (
    sectionTitle: string,
    index: number,
    updates: Partial<Omit<ExperienceEntryForm, 'sectionTitle' | 'index'>>,
  ) => void;
  onSectionEntryChange: (sectionTitle: string, entryIndex: number, fieldKey: string, value: string) => void;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
  onThemeChange: (theme: ThemeId) => void;
  onFormatChange: (formats: RenderFormatSelection) => void;
  onCustomDesignYamlChange: (yaml: string) => void;
  onCopyYaml: () => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <WorkspacePanel
      actions={
        <Chip color="accent" size="sm" variant="soft">
          {formatNumber(yamlLineCount)} líneas
        </Chip>
      }
      className="min-h-[640px] overflow-hidden xl:h-[calc(100vh-6rem)] xl:min-h-[680px]"
      eyebrow="Área principal"
      title="Contenido del CV"
    >
      <Tabs className="flex min-h-0 flex-1 flex-col" defaultSelectedKey="yaml" variant="secondary">
        <div className="border-b border-separator px-4 pt-3">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Vistas de edición">
              <Tabs.Tab id="yaml">
                <TerminalSquare aria-hidden="true" className="mr-2 size-4" />
                YAML
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="formulario">
                <ClipboardCheck aria-hidden="true" className="mr-2 size-4" />
                Formulario
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="diseno">
                <Palette aria-hidden="true" className="mr-2 size-4" />
                Diseño
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </div>

        {/* YAML tab */}
        <Tabs.Panel className="min-h-0 p-3 sm:p-4" id="yaml">
          <YamlEditor
            canRedo={canRedo}
            canUndo={canUndo}
            onCopyYaml={onCopyYaml}
            onInsertEntry={onInsertEntry}
            onRedo={onRedo}
            onUndo={onUndo}
            onYamlChange={onYamlChange}
            yamlLineCount={yamlLineCount}
            yamlText={yamlText}
          />
        </Tabs.Panel>

        {/* Form tab */}
        <Tabs.Panel className="min-h-0 flex-1 overflow-hidden p-0" id="formulario">
          <ScrollShadow className="max-h-[720px] p-3 sm:p-4 xl:h-full xl:max-h-none" hideScrollBar>
            <div className="space-y-6 pb-4">
              <section aria-labelledby="personal-info-heading" className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground" id="personal-info-heading">
                    Información personal
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Datos visibles en la cabecera del CV.
                  </p>
                </div>
                <PersonalInfoForm yamlText={yamlText} onFieldChange={onPersonalFieldChange} />
              </section>

              <section aria-labelledby="social-info-heading" className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground" id="social-info-heading">
                    Redes profesionales
                  </h3>
                </div>
                <SocialNetworksForm yamlText={yamlText} onSocialFieldChange={onSocialFieldChange} />
              </section>

              <section aria-labelledby="experience-info-heading">
                <ExperienceEntriesForm
                  onExperienceEntryChange={onExperienceEntryChange}
                  onInsertEntry={onInsertEntry}
                  yamlText={yamlText}
                />
              </section>

              <section aria-labelledby="sections-info-heading">
                <SectionsBuilder
                  onInsertEntry={onInsertEntry}
                  onSectionEntryChange={onSectionEntryChange}
                  yamlText={yamlText}
                />
              </section>

              <div className="rounded-[20px] border border-border bg-surface-secondary p-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck aria-hidden="true" className="size-5 text-success" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Estructura compatible</p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      Contenido, diseño, idioma y salida en capas separadas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollShadow>
        </Tabs.Panel>

        {/* Design tab */}
        <Tabs.Panel className="p-3 sm:p-4" id="diseno">
          <DesignPanel
            customDesignYaml={customDesignYaml}
            formatSelection={formatSelection}
            selectedThemeId={selectedThemeId}
            onCustomDesignYamlChange={onCustomDesignYamlChange}
            onFormatChange={onFormatChange}
            onThemeChange={onThemeChange}
          />
        </Tabs.Panel>
      </Tabs>
    </WorkspacePanel>
  );
}
