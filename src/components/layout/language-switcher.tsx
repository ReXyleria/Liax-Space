import { localeLabels, type Locale } from "@/lib/i18n-messages";
import { setLocaleAction } from "@/features/i18n/actions";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ locale, transparent }: { locale: Locale; transparent?: boolean }) {
  return (
    <form action={setLocaleAction} className="flex rounded-full border border-white/20 p-0.5 text-xs">
      {(["zh-CN", "en"] as Locale[]).map((item) => (
        <button
          key={item}
          type="submit"
          name="locale"
          value={item}
          className={cn(
            "rounded-full px-2 py-1 transition",
            locale === item
              ? transparent ? "bg-white text-slate-950" : "bg-primary text-primary-foreground"
              : transparent ? "text-white/80 hover:text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {localeLabels[item]}
        </button>
      ))}
    </form>
  );
}
