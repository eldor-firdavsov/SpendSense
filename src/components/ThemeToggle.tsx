'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';

export type ThemeMode = 'light' | 'dark' | 'system';

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  } else if (mode === 'light') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    media.removeEventListener('change', callback);
  };
}

function getSnapshot(): ThemeMode {
  try {
    return (localStorage.getItem('spendsense_theme') as ThemeMode) || 'system';
  } catch {
    return 'system';
  }
}

function getServerSnapshot(): ThemeMode {
  return 'system';
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleSelect = (mode: ThemeMode) => {
    try {
      localStorage.setItem('spendsense_theme', mode);
    } catch {
      // ignore
    }
    applyTheme(mode);
    window.dispatchEvent(new Event('storage'));
    setIsOpen(false);
  };

  const currentIcon =
    theme === 'light' ? (
      <Sun className="h-4 w-4 text-amber-400" />
    ) : theme === 'dark' ? (
      <Moon className="h-4 w-4 text-emerald-400" />
    ) : (
      <Laptop className="h-4 w-4 text-zinc-300" />
    );

  return (
    <div className="relative inline-block text-left">
      <button
        id="theme-toggle-button"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 transition-colors shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        title="Tashqi ko‘rinish rejimini tanlash"
        aria-label="Tashqi ko‘rinish rejimini tanlash"
      >
        {currentIcon}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 shadow-xl shadow-black/50 z-50">
            <button
              type="button"
              id="theme-light-btn"
              onClick={() => handleSelect('light')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                theme === 'light'
                  ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Sun className="h-4 w-4 text-amber-400" />
              <span>Yorug‘ rejim</span>
            </button>

            <button
              type="button"
              id="theme-dark-btn"
              onClick={() => handleSelect('dark')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Moon className="h-4 w-4 text-emerald-400" />
              <span>Qorong‘i rejim</span>
            </button>

            <button
              type="button"
              id="theme-system-btn"
              onClick={() => handleSelect('system')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                theme === 'system'
                  ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Laptop className="h-4 w-4 text-zinc-400" />
              <span>Tizim sozlamasi bo‘yicha</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
