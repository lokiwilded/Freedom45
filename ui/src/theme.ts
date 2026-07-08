import { useEffect, useState } from "react";

// Validated dataviz palette (reference instance). Dark column is the same hues
// re-stepped for the dark surface, not an inversion.
export interface Palette {
  isDark: boolean;
  surface: string; ink: string; secondary: string; muted: string;
  grid: string; baseline: string; good: string; critical: string;
  cat: string[]; // categorical slots 1..8, fixed order
}

const LIGHT: Palette = {
  isDark: false,
  surface: "#fcfcfb", ink: "#0b0b0b", secondary: "#52514e", muted: "#898781",
  grid: "#e1e0d9", baseline: "#c3c2b7", good: "#0ca30c", critical: "#d03b3b",
  cat: ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"],
};
const DARK: Palette = {
  isDark: true,
  surface: "#1a1a19", ink: "#ffffff", secondary: "#c3c2b7", muted: "#898781",
  grid: "#2c2c2a", baseline: "#383835", good: "#0ca30c", critical: "#d03b3b",
  cat: ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767", "#d55181", "#d95926"],
};

export function useTheme(): Palette {
  const [dark, setDark] = useState(
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark ? DARK : LIGHT;
}
