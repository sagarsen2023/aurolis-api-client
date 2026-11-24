import type { CSSProperties } from "react";
import { Toaster, type ToasterProps } from "sonner";
import { useTheme } from "@/context/theme-context";

const TITLE_BAR_OFFSET = 48;

function ThemeToast() {
  const { theme } = useTheme();
  return (
    <Toaster
      richColors
      position="top-center"
      offset={TITLE_BAR_OFFSET}
      theme={(theme as ToasterProps["theme"]) ?? "system"}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-lg)",
          fontFamily: "var(--font-sans)",
        } as CSSProperties
      }
    />
  );
}

export default ThemeToast;
