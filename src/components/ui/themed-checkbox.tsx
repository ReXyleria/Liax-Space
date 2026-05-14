import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemedCheckbox({
  name,
  value,
  label,
  description,
  defaultChecked,
  checked,
  onCheckedChange,
  disabled,
  className,
  children
}: {
  name: string;
  value?: string;
  label?: string;
  description?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer gap-3 rounded-md border bg-background p-3 text-sm transition hover:border-primary/40 hover:bg-primary/5",
        "has-[:checked]:border-primary/50 has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/25",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      <input
        className="peer sr-only"
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
        disabled={disabled}
      />
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-input bg-card text-transparent transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
        <Check className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        {label ? <span className="block font-medium">{label}</span> : null}
        {description ? <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span> : null}
        {children}
      </div>
    </label>
  );
}
