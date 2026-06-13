import { CustomRuleEngine } from "./CustomRuleEngine.js";
import { TocRule } from "./TocRule.js";
import { WarningBlockRule } from "./WarningBlockRule.js";

export const defaultCustomRules = [new WarningBlockRule(), new TocRule()];

export const defaultCustomRuleEngine = new CustomRuleEngine(defaultCustomRules);
