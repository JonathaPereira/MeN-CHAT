"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <div className="theme-switch" role="group" aria-label="Aparência">
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label="Ativar modo claro"
        className="theme-light"
      >
        <Sun size={17} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label="Ativar modo escuro"
        className="theme-dark"
      >
        <Moon size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
