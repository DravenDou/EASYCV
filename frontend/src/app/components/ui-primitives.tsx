'use client';

import { Button, Switch, Tooltip } from '@heroui/react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const af = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(af);
  }, []);

  const isDark = mounted ? resolvedTheme !== 'light' : true;

  return (
    <Tooltip delay={0}>
      <Switch
        aria-label="Cambiar tema visual"
        isSelected={isDark}
        size="sm"
        onChange={(isSelected) => setTheme(isSelected ? 'dark' : 'light')}
      >
        {({ isSelected }) => (
          <Switch.Control
            className={`h-9 w-16 rounded-full border border-border-tertiary transition-colors ${
              isSelected ? 'bg-accent' : 'bg-surface-tertiary'
            }`}
          >
            <Switch.Thumb
              className={`size-8 rounded-full transition-[margin,transform] ${
                isSelected ? 'ms-7 bg-accent-foreground' : 'ms-0.5 bg-foreground'
              }`}
            >
              <Switch.Icon>
                {isSelected ? (
                  <Moon aria-hidden="true" className="size-4 text-accent" />
                ) : (
                  <Sun aria-hidden="true" className="size-4 text-background" />
                )}
              </Switch.Icon>
            </Switch.Thumb>
          </Switch.Control>
        )}
      </Switch>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        <p>{isDark ? 'Tema oscuro' : 'Tema claro'}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

export function WorkspacePanel({
  title,
  eyebrow,
  actions,
  children,
  className = '',
}: {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`animate-panel-in flex min-w-0 flex-col rounded-[20px] border border-border bg-surface shadow-surface ${className}`}
    >
      <header className="flex min-h-14 flex-col justify-between gap-3 border-b border-separator px-4 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-semibold text-muted">{eyebrow}</p> : null}
          <h2 className="mt-1 truncate text-base font-semibold text-foreground">{title}</h2>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>

      {children}
    </section>
  );
}

export function ToolButton({
  label,
  icon: Icon,
  variant = 'tertiary',
  isDisabled,
  onPress,
}: {
  label: string;
  icon: React.ComponentType<{ 'aria-hidden'?: boolean | 'true'; className?: string }>;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger';
  isDisabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Tooltip delay={0}>
      <Button
        aria-label={label}
        className="shrink-0"
        isDisabled={isDisabled}
        isIconOnly
        size="sm"
        variant={variant}
        onPress={onPress}
      >
        <Icon aria-hidden="true" className="size-4" />
      </Button>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

type RenderedArtifact = { format: string; filename: string; media_type: string; encoding: string; content: string };

function artifactHrefLocal(a: RenderedArtifact): string {
  if (a.encoding === 'base64') return `data:${a.media_type};base64,${a.content}`;
  return `data:${a.media_type};charset=utf-8,${encodeURIComponent(a.content)}`;
}

function downloadArtifacts(artifacts: RenderedArtifact[]): void {
  artifacts.forEach((a) => {
    const link = document.createElement('a');
    link.href = artifactHrefLocal(a);
    link.download = a.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  });
}

export function DownloadButton({
  label,
  artifacts,
  compactLabel,
  icon: Icon,
}: {
  label: string;
  artifacts: RenderedArtifact[];
  compactLabel: string;
  icon: React.ComponentType<{ 'aria-hidden'?: boolean | 'true'; className?: string }>;
}) {
  return (
    <Tooltip delay={0}>
      <Button
        aria-label={label}
        isDisabled={artifacts.length === 0}
        size="sm"
        variant="outline"
        onPress={() => downloadArtifacts(artifacts)}
      >
        <Icon aria-hidden="true" className="size-4" />
        <span className="hidden xl:inline">{compactLabel}</span>
      </Button>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}
