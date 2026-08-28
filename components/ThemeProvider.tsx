"use client";

import { createContext, useContext, useEffect } from "react";

// Dark mode removed — app is locked to light theme for production.
const ThemeContext = createContext<{ theme: "light"; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Always force light mode: clear any persisted dark preference
    localStorage.removeItem("ca-theme");
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "light", toggle: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
