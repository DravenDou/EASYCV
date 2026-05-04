/**
 * Static field definitions for personal info and social networks.
 * Separated from page.tsx so individual form components can import
 * without depending on the entire app module.
 */
import {
  Code2,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import type { PersonalField, SocialField } from '@/lib/types';

export const personalFields: PersonalField[] = [
  {
    key: 'name',
    label: 'Nombre',
    placeholder: 'Tu nombre completo',
    icon: UserRound,
  },
  {
    key: 'headline',
    label: 'Titular',
    placeholder: 'Rol principal o propuesta profesional',
    icon: Sparkles,
  },
  {
    key: 'location',
    label: 'Ubicación',
    placeholder: 'Ciudad, país',
    icon: MapPin,
  },
  {
    key: 'email',
    label: 'Correo',
    placeholder: 'correo@dominio.com',
    icon: Mail,
    type: 'email',
  },
  {
    key: 'phone',
    label: 'Teléfono',
    placeholder: '+00 000 000 000',
    icon: Phone,
    type: 'tel',
  },
  {
    key: 'website',
    label: 'Sitio web',
    placeholder: 'https://',
    icon: ExternalLink,
    type: 'url',
  },
];

export const socialFields: SocialField[] = [
  {
    network: 'LinkedIn',
    label: 'LinkedIn',
    placeholder: 'usuario-linkedin',
    icon: Users,
  },
  {
    network: 'GitHub',
    label: 'GitHub',
    placeholder: 'usuario-github',
    icon: Code2,
  },
];
