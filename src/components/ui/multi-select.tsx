"use client";

import { Check, ChevronDown, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
};

export function MultiSelect({
  name,
  options,
  defaultValues = [],
  value: controlledValue,
  onValueChange,
  placeholder = "选择项目",
  allowCreate = false,
  className
}: {
  name: string;
  options: MultiSelectOption[];
  defaultValues?: string[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  allowCreate?: boolean;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValues);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const value = controlledValue ?? internalValue;
  const optionMap = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);
  const filteredOptions = options.filter((option) => (
    option.label.toLowerCase().includes(query.toLowerCase()) ||
    option.value.toLowerCase().includes(query.toLowerCase())
  ));
  const canCreate = allowCreate && query.trim() && !value.includes(query.trim());

  function commit(nextValue: string[]) {
    const uniqueValues = Array.from(new Set(nextValue.map((item) => item.trim()).filter(Boolean)));

    if (controlledValue === undefined) {
      setInternalValue(uniqueValues);
    }

    onValueChange?.(uniqueValues);
  }

  function toggle(nextValue: string) {
    commit(value.includes(nextValue) ? value.filter((item) => item !== nextValue) : [...value, nextValue]);
  }

  useEffect(() => {
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
  }, []);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {value.map((item) => (
        <input key={item} type="hidden" name={name} value={item} />
      ))}
      <button
        type="button"
        className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left text-sm outline-none transition-all hover:border-primary/40 hover:bg-muted/35 focus:border-primary focus:ring-2 focus:ring-primary/15"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-2">
          {value.length ? (
            value.map((item) => (
              <span
                key={item}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
              >
                <span className="truncate">{optionMap.get(item)?.label ?? item}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="rounded-full p-0.5 hover:bg-primary/15"
                  onClick={(event) => {
                    event.stopPropagation();
                    commit(value.filter((selected) => selected !== item));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      commit(value.filter((selected) => selected !== item));
                    }
                  }}
                  aria-label={`移除 ${item}`}
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-lg border bg-card p-2 shadow-xl shadow-primary/10"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索或新建"
            className="mb-2 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <div className="space-y-1">
            {filteredOptions.map((option) => {
              const selected = value.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted",
                    selected && "bg-primary/10 text-primary"
                  )}
                  onClick={() => toggle(option.value)}
                >
                  <span className="truncate">{option.label}</span>
                  {selected ? <Check className="h-4 w-4" /> : null}
                </button>
              );
            })}
            {canCreate ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-primary transition hover:bg-primary/10"
                onClick={() => {
                  toggle(query.trim());
                  setQuery("");
                }}
              >
                <Plus className="h-4 w-4" />
                新建「{query.trim()}」
              </button>
            ) : null}
            {!filteredOptions.length && !canCreate ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">没有可选项</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
