'use client';

import { Input, Label, TextField } from '@heroui/react';
import type { SocialNetworkKey } from '@/lib/types';
import { socialFields } from '@/constants/fields';
import { extractSocialUsername } from '@/lib/yaml-helpers';

export function SocialNetworksForm({
  yamlText,
  onSocialFieldChange,
}: {
  yamlText: string;
  onSocialFieldChange: (network: SocialNetworkKey, value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {socialFields.map((field) => {
        const Icon = field.icon;
        return (
          <TextField fullWidth key={field.network} name={field.network}>
            <Label className="text-xs font-semibold text-muted">{field.label}</Label>
            <div className="relative">
              <Icon
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                className="pl-9"
                placeholder={field.placeholder}
                value={extractSocialUsername(yamlText, field.network)}
                variant="secondary"
                onChange={(e) => onSocialFieldChange(field.network, e.target.value)}
              />
            </div>
          </TextField>
        );
      })}
    </div>
  );
}
