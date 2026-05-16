'use client';

import { ScrollShadow } from '@heroui/react';
import { ListTree, Palette, TerminalSquare } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

import type {
  EditorTabId,
  EntryTemplateId,
  PersonalFieldKey,
  RenderFormatSelection,
  CvFieldPath,
  SocialNetworkKey,
  ThemeId,
} from '@/lib/types';
import { WorkspacePanel } from './ui-primitives';
import { YamlEditor } from './yaml-editor';
import { DesignPanel } from './design-panel';
import { CvListEditor } from './cv-list-editor';

function formatNumber(n: number): string {
  return n.toLocaleString('es-ES');
}

function AnimatedTabPanel({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className: string;
  id: EditorTabId;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      className={className}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
      id={id}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      key={id}
      role="tabpanel"
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function EditorTabButton({
  id,
  isSelected,
  children,
  onSelect,
}: {
  id: EditorTabId;
  isSelected: boolean;
  children: ReactNode;
  onSelect: (id: EditorTabId) => void;
}) {
  return (
    <button
      aria-selected={isSelected}
      className={`relative flex h-8 items-center overflow-hidden rounded-full px-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        isSelected
          ? 'text-accent-foreground'
          : 'text-muted hover:bg-surface-secondary hover:text-foreground'
      }`}
      role="tab"
      type="button"
      onClick={() => onSelect(id)}
    >
      {isSelected ? (
        <motion.span
          className="absolute inset-0 rounded-full bg-accent"
          layoutId="editor-active-tab"
          transition={{ duration: 0.18, ease: 'easeOut' }}
        />
      ) : null}
      <span className="relative z-10 flex items-center">{children}</span>
    </button>
  );
}

export function EditorPanel({
  yamlText,
  yamlLineCount,
  selectedThemeId,
  formatSelection,
  customDesignYaml,
  isYamlEnabled,
  selectedFieldPath,
  selectedTab,
  canUndo,
  canRedo,
  onYamlChange,
  onPersonalFieldChange,
  onSocialFieldChange,
  onSectionEntryChange,
  onInsertEntry,
  onDeleteEntry,
  onDuplicateEntry,
  onReorderEntry,
  onReplaceTextSection,
  onRenameSection,
  onDeleteSection,
  onThemeChange,
  onFormatChange,
  onCustomDesignYamlChange,
  onTabChange,
  onCopyYaml,
  onUndo,
  onRedo,
}: {
  yamlText: string;
  yamlLineCount: number;
  selectedThemeId: ThemeId;
  formatSelection: RenderFormatSelection;
  customDesignYaml: string;
  isYamlEnabled: boolean;
  selectedFieldPath: CvFieldPath | null;
  selectedTab: EditorTabId;
  canUndo: boolean;
  canRedo: boolean;
  onYamlChange: (value: string) => void;
  onPersonalFieldChange: (field: PersonalFieldKey, value: string) => void;
  onSocialFieldChange: (network: SocialNetworkKey, value: string) => void;
  onSectionEntryChange: (sectionTitle: string, entryIndex: number, fieldKey: string, value: string) => void;
  onInsertEntry: (sectionTitle: string, templateId: EntryTemplateId) => void;
  onDeleteEntry: (sectionTitle: string, entryIndex: number) => void;
  onDuplicateEntry: (sectionTitle: string, entryIndex: number) => void;
  onReorderEntry: (sectionTitle: string, fromIndex: number, toIndex: number) => void;
  onReplaceTextSection: (sectionTitle: string, value: string) => void;
  onRenameSection: (sectionTitle: string, nextTitle: string) => void;
  onDeleteSection: (sectionTitle: string) => void;
  onThemeChange: (theme: ThemeId) => void;
  onFormatChange: (formats: RenderFormatSelection) => void;
  onCustomDesignYamlChange: (yaml: string) => void;
  onTabChange: (tab: EditorTabId) => void;
  onCopyYaml: () => void;
  onUndo: () => void;
  onRedo: () => void;
  }) {
  const activeTab = selectedTab === 'yaml' && !isYamlEnabled ? 'lista' : selectedTab;
  const activePanel = (() => {
    if (activeTab === 'lista') {
      return (
        <AnimatedTabPanel
          className="min-h-0 flex-1 overflow-hidden p-0"
          id="lista"
          key="lista"
        >
          <ScrollShadow className="max-h-[720px] p-3 sm:p-4 xl:h-full xl:max-h-none" hideScrollBar>
            <CvListEditor
              onDeleteEntry={onDeleteEntry}
              onDeleteSection={onDeleteSection}
              onDuplicateEntry={onDuplicateEntry}
              onInsertEntry={onInsertEntry}
              onPersonalFieldChange={onPersonalFieldChange}
              onReplaceTextSection={onReplaceTextSection}
              onReorderEntry={onReorderEntry}
              onRenameSection={onRenameSection}
              onSectionEntryChange={onSectionEntryChange}
              onSocialFieldChange={onSocialFieldChange}
              yamlText={yamlText}
              selectedFieldPath={selectedFieldPath}
            />
          </ScrollShadow>
        </AnimatedTabPanel>
      );
    }

    if (isYamlEnabled && activeTab === 'yaml') {
      return (
        <AnimatedTabPanel className="min-h-0 p-3 sm:p-4" id="yaml" key="yaml">
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
        </AnimatedTabPanel>
      );
    }

    return (
      <AnimatedTabPanel
        className="min-h-0 flex-1 overflow-hidden p-0"
        id="diseno"
        key="diseno"
      >
        <ScrollShadow className="max-h-[720px] p-3 sm:p-4 xl:h-full xl:max-h-none">
          <DesignPanel
            customDesignYaml={customDesignYaml}
            formatSelection={formatSelection}
            selectedThemeId={selectedThemeId}
            onCustomDesignYamlChange={onCustomDesignYamlChange}
            onFormatChange={onFormatChange}
            onThemeChange={onThemeChange}
          />
        </ScrollShadow>
      </AnimatedTabPanel>
    );
  })();

  return (
    <WorkspacePanel
      actions={
        <span className="rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs font-semibold tabular-nums text-muted">
          {formatNumber(yamlLineCount)} líneas
        </span>
      }
      className="min-h-[640px] overflow-hidden xl:h-[calc(100vh-6rem)] xl:min-h-[680px]"
      title="Editor"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-separator px-4 pt-3">
          <div
            aria-label="Vistas de edición"
            className="flex flex-wrap gap-1 rounded-full pb-3"
            role="tablist"
          >
              <EditorTabButton
                id="lista"
                isSelected={activeTab === 'lista'}
                onSelect={onTabChange}
              >
                <ListTree aria-hidden="true" className="mr-2 size-4" />
                CV
              </EditorTabButton>
              {isYamlEnabled ? (
                <EditorTabButton
                  id="yaml"
                  isSelected={activeTab === 'yaml'}
                  onSelect={onTabChange}
                >
                  <TerminalSquare aria-hidden="true" className="mr-2 size-4" />
                  YAML
                </EditorTabButton>
              ) : null}
              <EditorTabButton
                id="diseno"
                isSelected={activeTab === 'diseno'}
                onSelect={onTabChange}
              >
                <Palette aria-hidden="true" className="mr-2 size-4" />
                Design
              </EditorTabButton>
          </div>
        </div>


        <AnimatePresence initial={false} mode="wait">
          {activePanel}
        </AnimatePresence>
      </div>
    </WorkspacePanel>
  );
}
