import { useEffect, useState } from "react";

type ColorMode = "light" | "dark";

const currentColorMode = (): ColorMode =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

export function useColorMode() {
  const [colorMode, setColorMode] = useState<ColorMode>(currentColorMode);

  useEffect(() => {
    const observer = new MutationObserver(() =>
      setColorMode(currentColorMode()),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return colorMode;
}
