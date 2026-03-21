/**
 * TabNoData — Shared empty state for tournament tabs during phases
 * where data doesn't exist yet or isn't applicable to display.
 *
 * Used by: Players (C1), Teams (D1), Matches (E1–E4), Staff (I1)
 */

import type { LucideIcon } from 'lucide-react';

interface TabNoDataProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  /** Optional extra context line (e.g. a date or phase name) */
  hint?: string;
}

export function TabNoData({ icon: Icon, title, subtitle, hint }: TabNoDataProps) {
  return (
    <div className="bg-card rounded-2xl border-2 border-border p-10 sm:p-14 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{subtitle}</p>
      {hint && (
        <p className="mt-3 text-xs text-muted-foreground/70 font-medium uppercase tracking-wide">
          {hint}
        </p>
      )}
    </div>
  );
}
