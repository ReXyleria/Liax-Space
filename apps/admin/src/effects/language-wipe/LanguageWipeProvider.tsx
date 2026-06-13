import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from "react";
import type { SupportedLocale } from "../../../../../packages/shared/src/locales";

import { settingsApi } from "../../api/settingsApi";
import { LocaleProvider } from "../../i18n/LocaleProvider";
import { resolveInitialLocale, writeStoredLocale } from "../../i18n/localeStorage";
import { authStore } from "../../stores/authStore";
import {
  LanguageWipeOverlay,
  type AdminLanguageWipeTransition
} from "./LanguageWipeOverlay";
import "./languageWipe.css";

export type LanguageWipeRequest = {
  locale: SupportedLocale;
  origin?: {
    x: number;
    y: number;
  };
};

export type LanguageWipeContextValue = {
  currentLocale: SupportedLocale;
  isTransitioning: boolean;
  targetLocale: SupportedLocale | null;
  switchLocale: (request: LanguageWipeRequest) => void;
};

export type LanguageWipeProviderProps = {
  children: ReactNode;
};

type UiDebugApi = {
  setLanguageWipeProgress: (progress: number) => void;
};

declare global {
  interface Window {
    __uiDebug?: UiDebugApi;
  }
}

const LanguageWipeContext = createContext<LanguageWipeContextValue | null>(null);

function isUiDebugMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("uiDebug") === "1";
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progress));
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function viewportCenter(): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 };
  }

  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;

  return {
    x: viewportWidth / 2,
    y: viewportHeight / 2
  };
}

function radiusForViewport(origin: { x: number; y: number }): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const farthestX = Math.max(origin.x, viewportWidth - origin.x);
  const farthestY = Math.max(origin.y, viewportHeight - origin.y);

  return Math.ceil(Math.hypot(farthestX, farthestY));
}

function persistLocale(locale: SupportedLocale): void {
  writeStoredLocale(locale);

  if (authStore.getSnapshot().status === "authenticated") {
    void settingsApi.updateUserPreferences({ locale }).catch(() => {
      // Locale has already been applied locally; preference sync can retry on a later user action.
    });
  }
}

export function LanguageWipeProvider({ children }: LanguageWipeProviderProps): ReactElement {
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>(() => resolveInitialLocale());
  const [transition, setTransition] = useState<AdminLanguageWipeTransition | null>(null);
  const [debugProgress, setDebugProgress] = useState(0);
  const isDebugMode = useMemo(() => isUiDebugMode(), []);
  const transitionRef = useRef<AdminLanguageWipeTransition | null>(null);
  const transitionIdRef = useRef(0);

  const commitLocale = useCallback((locale: SupportedLocale) => {
    setCurrentLocale(locale);
    persistLocale(locale);
  }, []);

  const finishTransition = useCallback(() => {
    const activeTransition = transitionRef.current;

    if (!activeTransition) {
      return;
    }

    commitLocale(activeTransition.toLocale);
    transitionRef.current = null;
    setDebugProgress(0);
    setTransition(null);
  }, [commitLocale]);

  useEffect(() => {
    transitionRef.current = transition;
  }, [transition]);

  const switchLocale = useCallback((request: LanguageWipeRequest) => {
    if (request.locale === currentLocale || transition) {
      return;
    }

    if (prefersReducedMotion()) {
      commitLocale(request.locale);
      return;
    }

    const origin = request.origin ?? viewportCenter();
    const radius = radiusForViewport(origin);

    transitionIdRef.current += 1;
    const nextTransition: AdminLanguageWipeTransition = {
      fromLocale: currentLocale,
      id: transitionIdRef.current,
      origin: {
        radius,
        x: origin.x,
        y: origin.y
      },
      state: "entering",
      toLocale: request.locale
    };

    transitionRef.current = nextTransition;
    setDebugProgress(0);
    setTransition(nextTransition);
  }, [commitLocale, currentLocale, transition]);

  const setLanguageWipeProgress = useCallback((progress: number) => {
    if (!isDebugMode || !transitionRef.current) {
      return;
    }

    const nextProgress = clampProgress(progress);
    setDebugProgress(nextProgress);

    if (nextProgress >= 1) {
      finishTransition();
    }
  }, [finishTransition, isDebugMode]);

  useEffect(() => {
    if (!isDebugMode || typeof window === "undefined") {
      if (typeof window !== "undefined") {
        delete window.__uiDebug;
      }

      return;
    }

    window.__uiDebug = {
      setLanguageWipeProgress
    };

    return () => {
      if (window.__uiDebug?.setLanguageWipeProgress === setLanguageWipeProgress) {
        delete window.__uiDebug;
      }
    };
  }, [isDebugMode, setLanguageWipeProgress]);

  const contextValue = useMemo<LanguageWipeContextValue>(() => ({
    currentLocale,
    isTransitioning: transition !== null,
    switchLocale,
    targetLocale: transition?.toLocale ?? null
  }), [currentLocale, switchLocale, transition]);

  return (
    <LanguageWipeContext.Provider value={contextValue}>
      <div className="admin-language-wipe" data-transitioning={transition ? "true" : "false"}>
        <LocaleProvider locale={currentLocale} onLocaleChange={(locale) => switchLocale({ locale })} persistOnChange={false}>
          <div className="admin-language-wipe__layer">
            {children}
          </div>
        </LocaleProvider>

        {transition ? (
          <LanguageWipeOverlay
            debugProgress={isDebugMode ? debugProgress : null}
            key={transition.id}
            onComplete={finishTransition}
            transition={transition}
          >
            <LocaleProvider locale={transition.toLocale} onLocaleChange={(locale) => switchLocale({ locale })} persistOnChange={false}>
              <div className="admin-language-wipe__layer admin-language-wipe__layer--overlay">
                {children}
              </div>
            </LocaleProvider>
          </LanguageWipeOverlay>
        ) : null}
      </div>
    </LanguageWipeContext.Provider>
  );
}

export function useLanguageWipe(): LanguageWipeContextValue {
  const context = useContext(LanguageWipeContext);

  if (!context) {
    throw new Error("useLanguageWipe must be used inside LanguageWipeProvider.");
  }

  return context;
}
