"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type ThemeColor = "blue" | "emerald" | "orange" | "purple" | "rose" | "indigo";
type AppearanceMode = "light" | "dark" | "neutral" | "system";

interface ThemeContextType {
  primaryColor: ThemeColor;
  setPrimaryColor: (color: ThemeColor) => void;
  appearance: AppearanceMode;
  setAppearance: (mode: AppearanceMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [primaryColor, setPrimaryColor] = useState<ThemeColor>("blue");
  const [appearance, setAppearance] = useState<AppearanceMode>("system");

  useEffect(() => {
    const savedColor = localStorage.getItem("salesscore-primary-color") as ThemeColor;
    const savedMode = localStorage.getItem("salesscore-appearance") as AppearanceMode;
    if (savedColor) setPrimaryColor(savedColor);
    if (savedMode) setAppearance(savedMode);
  }, []);

  useEffect(() => {
    localStorage.setItem("salesscore-primary-color", primaryColor);
    localStorage.setItem("salesscore-appearance", appearance);
    
    const root = document.documentElement;
    
    // Primary Colors
    const colors: Record<ThemeColor, string> = {
      blue: "221 83% 53%",
      emerald: "160 84% 39%",
      orange: "24 95% 53%",
      purple: "271 91% 65%",
      rose: "346 84% 61%",
      indigo: "239 84% 67%",
    };

    // Appearance Variables
    const modes = {
      light: {
        background: "210 40% 98%",
        foreground: "222 47% 11%",
        card: "0 0% 100%",
        border: "214 32% 91%",
        muted: "210 40% 96.1%",
        mutedForeground: "215.4 16.3% 46.9%",
        input: "214 32% 91%",
      },
      dark: {
        background: "222 47% 4%",
        foreground: "210 40% 98%",
        card: "222 47% 7%",
        border: "217 33% 17%",
        muted: "217 33% 17%",
        mutedForeground: "215 20.2% 65.1%",
        input: "217 33% 17%",
      },
      neutral: {
        background: "0 0% 100%",
        foreground: "222 47% 11%",
        card: "0 0% 100%",
        border: "214 32% 91%",
        muted: "210 40% 96.1%",
        mutedForeground: "215.4 16.3% 46.9%",
        input: "214 32% 91%",
      }
    };

    root.style.setProperty("--primary", colors[primaryColor]);
    
    let activeMode = appearance;
    if (appearance === "system") {
      activeMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    const currentMode = modes[activeMode as keyof typeof modes] || modes.light;
    root.style.setProperty("--background", currentMode.background);
    root.style.setProperty("--foreground", currentMode.foreground);
    root.style.setProperty("--card", currentMode.card);
    root.style.setProperty("--border", currentMode.border);
    root.style.setProperty("--muted", currentMode.muted);
    root.style.setProperty("--muted-foreground", currentMode.mutedForeground);
    root.style.setProperty("--input", currentMode.input);

    if (activeMode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Listener for system changes if mode is system
    if (appearance === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        const newMode = mediaQuery.matches ? "dark" : "light";
        const theme = modes[newMode];
        root.style.setProperty("--background", theme.background);
        root.style.setProperty("--foreground", theme.foreground);
        root.style.setProperty("--card", theme.card);
        root.style.setProperty("--border", theme.border);
        root.style.setProperty("--muted", theme.muted);
        root.style.setProperty("--muted-foreground", theme.mutedForeground);
        root.style.setProperty("--input", theme.input);
        if (newMode === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
      };
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [primaryColor, appearance]);

  return (
    <ThemeContext.Provider value={{ primaryColor, setPrimaryColor, appearance, setAppearance }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
