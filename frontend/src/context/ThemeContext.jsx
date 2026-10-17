import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Dark by default (the 3D scene is designed for it); an explicit choice wins.
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("fraudex-theme") !== "light"; } catch { return true; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("fraudex-theme", dark ? "dark" : "light"); } catch { /* private mode */ }
  }, [dark]);

  const toggle = () => setDark(d => !d);

  return (
    <ThemeContext.Provider value={{ dark, toggle, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
