import { useEffect, type AnimationEvent, type CSSProperties, type ReactElement, type ReactNode } from "react";
import type { LanguageWipeTransition } from "../../../../../packages/ui/src/language-wipe/types";
import type { SupportedLocale } from "../../../../../packages/shared/src/locales";

export type AdminLanguageWipeTransition = LanguageWipeTransition<SupportedLocale> & {
  id: number;
};

export type LanguageWipeOverlayProps = {
  children: ReactNode;
  debugProgress?: number | null;
  transition: AdminLanguageWipeTransition;
  onComplete: () => void;
};

type LanguageWipeStyle = CSSProperties & {
  "--admin-language-wipe-current-radius"?: string;
  "--admin-language-wipe-radius": string;
  "--admin-language-wipe-x": string;
  "--admin-language-wipe-y": string;
};

export function LanguageWipeOverlay({
  children,
  debugProgress = null,
  onComplete,
  transition
}: LanguageWipeOverlayProps): ReactElement {
  const progressRadius = debugProgress === null
    ? undefined
    : `${Math.max(0, Math.min(1, debugProgress)) * transition.origin.radius}px`;
  const style: LanguageWipeStyle = {
    "--admin-language-wipe-current-radius": progressRadius,
    "--admin-language-wipe-radius": `${transition.origin.radius}px`,
    "--admin-language-wipe-x": `${transition.origin.x}px`,
    "--admin-language-wipe-y": `${transition.origin.y}px`
  };

  function handleAnimationDone(event: AnimationEvent<HTMLDivElement>): void {
    if (event.currentTarget === event.target) {
      onComplete();
    }
  }

  useEffect(() => {
    if (debugProgress !== null) {
      return undefined;
    }

    const timeout = window.setTimeout(onComplete, 1120);

    return () => window.clearTimeout(timeout);
  }, [debugProgress, onComplete]);

  return (
    <div
      aria-hidden="true"
      className="admin-language-wipe__overlay"
      data-ui-debug={debugProgress === null ? undefined : "true"}
      data-wipe-progress={debugProgress === null ? undefined : debugProgress.toFixed(2)}
      data-wipe-state={transition.state}
      onAnimationEnd={handleAnimationDone}
      style={style}
    >
      <span className="admin-language-wipe__ripple admin-language-wipe__ripple--one" />
      <span className="admin-language-wipe__ripple admin-language-wipe__ripple--two" />
      {children}
    </div>
  );
}
