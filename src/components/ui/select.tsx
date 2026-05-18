"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
};

export function Select({
  name,
  options,
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  disabled = false
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const initial = defaultValue ?? options[0]?.value ?? "";
  const [internalValue, setInternalValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const value = controlledValue ?? internalValue;
  const selected = options.find((option) => option.value === value) ?? options[0];

  function setNextValue(nextValue: string) {
    if (controlledValue === undefined) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
  }

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [disabled]);

  return (
    <div ref={rootRef} className={cn("relative", open && "z-[120]", className)}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 text-left text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15",
          disabled
            ? "cursor-not-allowed border-border/70 bg-muted/40 text-muted-foreground opacity-70"
            : "hover:border-primary/40 hover:bg-muted/35"
        )}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute z-[130] mt-2 max-h-64 w-full overflow-auto rounded-lg border bg-card p-1 shadow-xl shadow-primary/10"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={disabled}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition",
                disabled ? "cursor-not-allowed opacity-70" : "hover:bg-muted",
                option.value === value && "bg-primary/10 text-primary"
              )}
              onClick={() => {
                setNextValue(option.value);
                setOpen(false);
              }}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value ? <Check className="h-4 w-4" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
