/**
 * Theme Provider — manages light/dark/system mode.
 *
 * Three states:
 *   'light'  → forces light mode
 *   'dark'   → forces dark mode
 *   'system' → follows OS preference via prefers-color-scheme
 *
 * Persists choice to localStorage('tcf_theme').
 * Applies/removes the `dark` class on <html> — this is what Tailwind v4 reads.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;           // The user's preference (light | dark | system)
  resolvedTheme: 'light' | 'dark'; // What's actually applied right now
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void; // Convenience: light → dark → system → light
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'tcf_theme';
const CYCLE_ORDER: Theme[] = ['light', 'dark', 'system'];

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const pref = stored || 'system';
    return pref === 'system' ? getSystemTheme() : pref;
  });

  // Resolve and apply whenever theme preference changes
  useEffect(() => {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [theme]);

  // Listen for OS preference changes (only matters when theme === 'system')
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') {
        const resolved = getSystemTheme();
        setResolvedTheme(resolved);
        applyTheme(resolved);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, []);

  const cycleTheme = useCallback(() => {
    const idx = CYCLE_ORDER.indexOf(theme);
    const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
    setTheme(next);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
