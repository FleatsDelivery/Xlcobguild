/**
 * Reusable empty state component for tournament hub tabs
 */

import type { LucideIcon } from '@/lib/icons';

interface TournamentHubEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function TournamentHubEmptyState({ icon: Icon, title, description }: TournamentHubEmptyStateProps) {
  return (
    <div className="bg-card rounded-2xl border-2 border-dashed border-border p-12 text-center space-y-3">
      <Icon className="w-16 h-16 text-muted-foreground/20 mx-auto" />
      <h3 className="text-xl font-bold text-foreground">{title}</h3>
      <p className="text-muted-foreground max-w-md mx-auto">{description}</p>
    </div>
  );
}