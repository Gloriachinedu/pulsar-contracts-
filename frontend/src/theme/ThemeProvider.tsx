import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const STORAGE_KEY = "pulsar-theme";

/** Read theme from localStorage; returns null when absent or storage is unavailable. */
function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "dark" || value === "light") return value;
  } catch {
    // Storage unavailable (e.g. private mode quota exceeded)
  }
  return null;
}

/** Write theme to localStorage; silently no-ops when storage is unavailable. */
function writeStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage unavailable
  }
}

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // localStorage takes precedence over system preference (AC: theme restored before system pref)
    return readStoredTheme() ?? getSystemTheme();
  });

  // Apply class and persist to localStorage whenever theme changes
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    writeStoredTheme(theme);
  }, [theme]);

  // Follow OS-level changes only when the user has not set a manual preference.
  // Also handles the case where the user cleared site data mid-session: once
  // localStorage no longer holds a value we fall back to system preference again.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      if (!readStoredTheme()) {
        setTheme(e.matches ? "dark" : "light");
      }
    };

    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // Detect external storage changes (e.g. user cleared site data in another tab,
  // or another tab toggled the theme).
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;

      if (e.newValue === null) {
        // Storage was cleared — fall back to system preference
        setTheme(getSystemTheme());
      } else if (e.newValue === "dark" || e.newValue === "light") {
        setTheme(e.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggle = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    []
  );

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
