'use client';

import { Input, Label, TextField } from '@heroui/react';
import type { PersonalFieldKey } from '@/lib/types';
import { personalFields } from '@/constants/fields';
import { extractCvValue } from '@/lib/yaml-helpers';

export function PersonalInfoForm({
  yamlText,
  onFieldChange,
}: {
  yamlText: string;
  onFieldChange: (field: PersonalFieldKey, value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {personalFields.map((field) => {
        const Icon = field.icon;
        return (
          <TextField fullWidth key={field.key} name={field.key} type={field.type ?? 'text'}>
            <Label className="text-xs font-semibold text-muted">{field.label}</Label>
            <div className="relative">
              <Icon
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                className="pl-9"
                placeholder={field.placeholder}
                value={extractCvValue(yamlText, field.key)}
                variant="secondary"
                onChange={(e) => onFieldChange(field.key, e.target.value)}
              />
            </div>
          </TextField>
        );
      })}
    </div>
  );
}
