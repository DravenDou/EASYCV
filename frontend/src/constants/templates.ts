/**
 * Theme cards and entry templates registry.
 * These are pure data — no React, no side effects.
 */
import {
  Award,
  BookOpen,
  BriefcaseBusiness,
  FileText,
  GraduationCap,
  Hash,
  ListPlus,
  Type,
} from 'lucide-react';
import type { EntryTemplate, EntryTemplateId, TemplateCard, ThemeId } from '@/lib/types';

export const templateCards: TemplateCard[] = [
  {
    id: 'classic',
    name: 'Classic',
    status: 'Activo',
    accentClassName: 'bg-accent',
    description: 'Tipografía sobria para perfiles académicos y técnicos.',
  },
  {
    id: 'moderncv',
    name: 'ModernCV',
    status: 'Activo',
    accentClassName: 'bg-warning',
    description: 'Cabecera visual y estructura moderna de dos columnas.',
  },
  {
    id: 'sb2nov',
    name: 'SB2Nov',
    status: 'Activo',
    accentClassName: 'bg-success',
    description: 'Formato compacto optimizado para ATS y reclutadores.',
  },
  {
    id: 'engineeringresumes',
    name: 'Engineering Resumes',
    status: 'Activo',
    accentClassName: 'bg-success',
    description: 'Estilo técnico directo con alta densidad de contenido.',
  },
  {
    id: 'engineeringclassic',
    name: 'Engineering Classic',
    status: 'Activo',
    accentClassName: 'bg-success',
    description: 'Variante clásica enfocada en ingeniería y proyectos.',
  },
  {
    id: 'harvard',
    name: 'Harvard',
    status: 'Activo',
    accentClassName: 'bg-danger',
    description: 'Diseño formal para carrera académica y publicaciones.',
  },
  {
    id: 'ink',
    name: 'Ink',
    status: 'Nuevo',
    accentClassName: 'bg-foreground',
    description: 'Composición limpia con énfasis editorial.',
  },
  {
    id: 'opal',
    name: 'Opal',
    status: 'Nuevo',
    accentClassName: 'bg-accent',
    description: 'Presentación suave con detalles contemporáneos.',
  },
  {
    id: 'ember',
    name: 'Ember',
    status: 'Nuevo',
    accentClassName: 'bg-warning',
    description: 'Contraste cálido para perfiles con narrativa visual.',
  },
];

export const entryTemplates: EntryTemplate[] = [
  {
    id: 'text',
    label: 'Texto',
    sectionTitle: 'Resumen',
    description: 'Párrafo o viñeta simple para resumen, perfil o introducción.',
    icon: Type,
    buildEntry: () =>
      '      - Resume tu perfil, especialidad y el valor que aportas en 2 o 3 líneas.',
  },
  {
    id: 'experience',
    label: 'Experiencia',
    sectionTitle: 'Experiencia',
    description: 'Empresa, cargo, fechas, ubicación y logros medibles.',
    icon: BriefcaseBusiness,
    buildEntry: () => `      - company: Empresa
        position: Cargo
        location: Ciudad o remoto
        start_date: 2024-01
        end_date: present
        highlights:
          - Describe un logro medible o una responsabilidad clave.
          - Incluye tecnología, impacto o alcance cuando sea relevante.`,
  },
  {
    id: 'education',
    label: 'Educación',
    sectionTitle: 'Educación',
    description: 'Institución, área, título, fechas y detalles académicos.',
    icon: GraduationCap,
    buildEntry: () => `      - institution: Universidad o institución
        area: Área de estudio
        degree: Título
        location: Ciudad
        start_date: 2020-01
        end_date: 2024-12
        highlights:
          - Curso, distinción o proyecto académico relevante.`,
  },
  {
    id: 'normal',
    label: 'Proyectos',
    sectionTitle: 'Proyectos',
    description: 'Proyecto, evento, premio o elemento con nombre y logros.',
    icon: BookOpen,
    buildEntry: () => `      - name: Nombre del proyecto
        location: Remoto
        date: 2025
        highlights:
          - Explica el problema, tu rol y el resultado.
          - Menciona stack, métricas o usuarios si aplica.`,
  },
  {
    id: 'publication',
    label: 'Publicaciones',
    sectionTitle: 'Publicaciones',
    description: 'Título, autores, revista/conferencia, fecha y DOI.',
    icon: FileText,
    buildEntry: () => `      - title: Título de la publicación
        authors:
          - "*Tu Nombre*"
          - Coautor
        journal: Revista o conferencia
        date: 2025-01
        doi: 10.0000/example`,
  },
  {
    id: 'bullet',
    label: 'Reconocimientos',
    sectionTitle: 'Reconocimientos',
    description: 'Premios, certificaciones o reconocimientos breves.',
    icon: Award,
    buildEntry: () => '      - bullet: Premio, certificación o reconocimiento relevante.',
  },
  {
    id: 'numbered',
    label: 'Logros',
    sectionTitle: 'Logros',
    description: 'Resultados ordenados por prioridad o secuencia.',
    icon: Hash,
    buildEntry: () => '      - number: Logro o resultado ordenado por prioridad.',
  },
  {
    id: 'reversedNumbered',
    label: 'Charlas',
    sectionTitle: 'Charlas',
    description: 'Ponencias, charlas o actividades recientes.',
    icon: ListPlus,
    buildEntry: () => '      - reversed_number: Charla, ponencia o actividad reciente.',
  },
  {
    id: 'oneLine',
    label: 'Habilidades',
    sectionTitle: 'Habilidades',
    description: 'Categorías con detalles breves en una sola línea.',
    icon: ListPlus,
    buildEntry: () => `      - label: Lenguajes
        details: Python, TypeScript, SQL`,
  },
];

export function themeById(themeId: ThemeId): TemplateCard {
  return templateCards.find((t) => t.id === themeId) ?? templateCards[0];
}

export function getTemplateById(templateId: EntryTemplateId): EntryTemplate {
  return entryTemplates.find((t) => t.id === templateId) ?? entryTemplates[0];
}
