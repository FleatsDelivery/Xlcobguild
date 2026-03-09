/**
 * Theme Toggle — cycles through light → dark → system.
 * Designed to sit in the top nav bar alongside the avatar/logout buttons.
 */
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/app/components/theme-provider';

const THEME_META: Record<string, { icon: typeof Sun; label: string; title: string }> = {
  light:  { icon: Sun,     label: 'Light', title: 'Light mode — click for dark' },
  dark:   { icon: Moon,    label: 'Dark',  title: 'Dark mode — click for system' },
  system: { icon: Monitor, label: 'Auto',  title: 'System mode — click for light' },
};

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  const meta = THEME_META[theme];
  const Icon = meta.icon;

  return (
    <button
      onClick={cycleTheme}
      title={meta.title}
      className="p-1.5 rounded-lg text-silk/50 hover:text-silk hover:bg-white/10 transition-colors"
      aria-label={meta.title}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
