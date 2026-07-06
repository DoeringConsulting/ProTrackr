import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
// OAuth temporarily disabled - import { getLoginUrl } from "./const";
import "./index.css";
import "./i18n";
import { registerServiceWorker } from "./registerSW";
import { ensureCsrfToken, getCsrfHeaderName, getCsrfToken } from "./lib/csrf";
import { computeAppTitle } from "./lib/appTitle";

declare global {
  interface Window {
    /** Vom Server zur Laufzeit injiziert (siehe server/_core/envLabel.ts). */
    __APP_ENV_LABEL__?: string;
  }
}

// App-Titel zur LAUFZEIT aus dem vom Server injizierten Umgebungslabel
// (window.__APP_ENV_LABEL__ ← process.env.APP_ENV_LABEL) — NICHT mehr build-time
// (VITE_APP_TITLE). So zeigt EIN Production-Image in Dev/Prod den richtigen Titel
// (bit-identische Promotion). Leer/unset ⇒ Prod-Titel.
document.title = computeAppTitle(window.__APP_ENV_LABEL__);

const queryClient = new QueryClient();

// Weiterleitung zur Login-Seite bei UNAUTHORIZED (401)
const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (
    error instanceof TRPCClientError &&
    error.message === UNAUTHED_ERR_MSG
  ) {
    window.location.href = "/login";
  }
};

// Globale Fehlerbehandlung: bei 401 → Login-Redirect
queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

void ensureCsrfToken();

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        const csrfToken = getCsrfToken();
        const nextHeaders = new Headers(init?.headers ?? {});
        if (csrfToken) {
          nextHeaders.set(getCsrfHeaderName(), csrfToken);
        }
        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers: nextHeaders,
          credentials: "include",
        });
      },
    }),
  ],
});

// Register Service Worker for offline functionality
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
