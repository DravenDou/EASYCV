import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import {
  deleteSection,
  deleteSectionEntry,
  duplicateSectionEntry,
  moveSectionEntry,
  moveSectionEntryToIndex,
  normalizeWrappedNormalSections,
  renameSection,
  replaceTextSectionEntries,
} from './yaml-helpers';

const yamlText = `cv:
  name: Ana
  sections:
    Experience:
      - company: A
        position: Dev
      - company: B
        position: Lead
    Skills:
      - label: Languages
        details: TypeScript, Python
    Summary:
      - Line one from PDF
      - Line two from PDF
    Projects:
      - name: AI Agent Platform for WhatsApp Customer Support
        highlights:
          - Built a WhatsApp AI assistant for a Bolivian bus ticketing company to automate customer
      - name: support and booking-related conversations.
      - name: Internal Dashboard
        highlights:
          - Reduced reporting time.
`;

function parsedSections(yaml: string): Record<string, unknown[]> {
  const parsed = parse(yaml) as { cv: { sections: Record<string, unknown[]> } };
  return parsed.cv.sections;
}

describe('section entry helpers', () => {
  it('deleteSectionEntry removes an entry without removing the section', () => {
    const result = deleteSectionEntry(yamlText, 'Experience', 0);
    const sections = parsedSections(result);

    expect(sections.Experience).toHaveLength(1);
    expect(sections.Experience[0]).toMatchObject({ company: 'B' });
  });

  it('duplicateSectionEntry inserts a cloned entry after the source entry', () => {
    const result = duplicateSectionEntry(yamlText, 'Experience', 0);
    const sections = parsedSections(result);

    expect(sections.Experience).toHaveLength(3);
    expect(sections.Experience[1]).toMatchObject({ company: 'A', position: 'Dev' });
  });

  it('moveSectionEntry moves entries within section bounds', () => {
    const result = moveSectionEntry(yamlText, 'Experience', 1, -1);
    const sections = parsedSections(result);

    expect(sections.Experience[0]).toMatchObject({ company: 'B' });
    expect(sections.Experience[1]).toMatchObject({ company: 'A' });
  });

  it('moveSectionEntryToIndex moves entries to a dragged target position', () => {
    const result = moveSectionEntryToIndex(yamlText, 'Experience', 0, 1);
    const sections = parsedSections(result);

    expect(sections.Experience[0]).toMatchObject({ company: 'B' });
    expect(sections.Experience[1]).toMatchObject({ company: 'A' });
  });

  it('replaceTextSectionEntries rewrites wrapped PDF text as one entry', () => {
    const result = replaceTextSectionEntries(yamlText, 'Summary', 'One editable paragraph');
    const sections = parsedSections(result);

    expect(sections.Summary).toEqual(['One editable paragraph']);
  });

  it('normalizeWrappedNormalSections merges wrapped project highlights', () => {
    const result = normalizeWrappedNormalSections(yamlText);
    const sections = parsedSections(result);

    expect(sections.Projects).toHaveLength(2);
    expect(sections.Projects[0]).toMatchObject({
      highlights: [
        'Built a WhatsApp AI assistant for a Bolivian bus ticketing company to automate customer support and booking-related conversations.',
      ],
      name: 'AI Agent Platform for WhatsApp Customer Support',
    });
    expect(sections.Projects[1]).toMatchObject({ name: 'Internal Dashboard' });
  });
});

describe('section helpers', () => {
  it('renameSection preserves entries under the new section name', () => {
    const result = renameSection(yamlText, 'Experience', 'Work');
    const sections = parsedSections(result);

    expect(sections.Experience).toBeUndefined();
    expect(sections.Work).toHaveLength(2);
  });

  it('deleteSection removes the entire section', () => {
    const result = deleteSection(yamlText, 'Skills');
    const sections = parsedSections(result);

    expect(sections.Skills).toBeUndefined();
    expect(sections.Experience).toHaveLength(2);
  });
});
