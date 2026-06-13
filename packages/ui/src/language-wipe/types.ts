export type LanguageWipeOrigin = {
  x: number;
  y: number;
  radius: number;
};

export type LanguageWipeState = "idle" | "entering" | "settled" | "cancelled";

export type LanguageWipeTransition<TLocale extends string = string> = {
  fromLocale: TLocale;
  toLocale: TLocale;
  origin: LanguageWipeOrigin;
  state: LanguageWipeState;
};

