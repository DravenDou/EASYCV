import { describe, expect, it } from 'vitest';

import {
  cvDocumentToYaml,
  updateCvDocumentAtPath,
  updateYamlAtPath,
  yamlToCvDocument,
} from './cv-document';

const yamlText = `cv:
  name: Ana
  email: ana@example.com
  sections:
    Summary:
      - Original summary
    Experience:
      - company: A
        position: Dev
        highlights:
          - Built the app.
`;

describe('CvDocument helpers', () => {
  it('round-trips YAML through the visual document model', () => {
    const document = yamlToCvDocument(yamlText);

    expect(document?.cv?.name).toBe('Ana');
    expect(yamlToCvDocument(cvDocumentToYaml(document!))?.cv?.email).toBe('ana@example.com');
  });

  it('updates nested object fields without mutating the original document', () => {
    const document = yamlToCvDocument(yamlText)!;
    const nextDocument = updateCvDocumentAtPath(
      document,
      ['cv', 'sections', 'Experience', '0', 'position'],
      'Lead',
    );

    const sections = nextDocument.cv?.sections as Record<string, Array<Record<string, unknown>>>;
    const originalSections = document.cv?.sections as Record<string, Array<Record<string, unknown>>>;
    expect(sections.Experience[0].position).toBe('Lead');
    expect(originalSections.Experience[0].position).toBe('Dev');
  });

  it('updates YAML from a PDF field path', () => {
    const nextYaml = updateYamlAtPath(yamlText, ['cv', 'name'], 'Ana Garcia');
    const document = yamlToCvDocument(nextYaml);

    expect(document?.cv?.name).toBe('Ana Garcia');
  });
});
