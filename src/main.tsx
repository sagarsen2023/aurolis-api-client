import "./desktop/install-bridge";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import "./index.css";
import { routeTree } from "./routeTree.gen";
import { ThemeProvider } from "./context/theme-context";
import { TooltipProvider } from "./components/ui/tooltip";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <TooltipProvider>
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
          <RouterProvider router={router} />
        </ThemeProvider>
      </TooltipProvider>
    </StrictMode>,
  );
}
