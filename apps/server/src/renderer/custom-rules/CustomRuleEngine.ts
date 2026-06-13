export interface CustomRule {
  name: string;
  version: string;
  apply(markdown: string): string;
}

export class CustomRuleError extends Error {
  constructor(
    message: string,
    readonly ruleName: string,
    readonly originalError?: unknown,
  ) {
    super(message);
    this.name = "CustomRuleError";
  }
}

export class CustomRuleEngine {
  constructor(private readonly rules: CustomRule[]) {}

  getVersion(): string {
    if (this.rules.length === 0) {
      return "none";
    }

    return this.rules.map((rule) => `${rule.name}@${rule.version}`).join("+");
  }

  apply(markdown: string): string {
    return this.rules.reduce((currentMarkdown, rule) => {
      try {
        return rule.apply(currentMarkdown);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown rule error";
        throw new CustomRuleError(`Custom Markdown rule "${rule.name}" failed: ${detail}`, rule.name, error);
      }
    }, markdown);
  }
}
