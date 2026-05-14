import type { SettingType } from "@prisma/client";

export type SettingDefinition = {
  key: string;
  label: string;
  group: string;
  type: SettingType;
  defaultValue: string;
};

export type SettingsMap = Record<string, string>;
