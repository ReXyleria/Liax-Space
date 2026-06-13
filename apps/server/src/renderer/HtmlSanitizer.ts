const blockedElementNames = ["script", "iframe"];
const urlAttributeNames = new Set(["href", "src", "xlink:href", "action", "formaction"]);

function removeBlockedElements(html: string): string {
  return blockedElementNames.reduce((currentHtml, elementName) => {
    const pairedElementPattern = new RegExp(`<${elementName}\\b[^>]*>[\\s\\S]*?<\\/${elementName}\\s*>`, "gi");
    const standaloneElementPattern = new RegExp(`<\\/?${elementName}\\b[^>]*>`, "gi");

    return currentHtml.replace(pairedElementPattern, "").replace(standaloneElementPattern, "");
  }, html);
}

const namedCharacterReferences: Record<string, string> = {
  colon: ":",
  newline: "\n",
  tab: "\t",
};

function decodeBasicHtmlEntities(value: string): string {
  return value.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|([a-z][a-z0-9]+));?/gi,
    (match: string, decimalCode: string | undefined, hexCode: string | undefined, namedCode: string | undefined) => {
      if (decimalCode !== undefined || hexCode !== undefined) {
        const rawCode = hexCode ?? decimalCode;

        if (rawCode === undefined) {
          return match;
        }

        const codePoint = Number.parseInt(rawCode, hexCode === undefined ? 10 : 16);

        if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
          return match;
        }

        return String.fromCodePoint(codePoint);
      }

      return namedCode === undefined ? match : namedCharacterReferences[namedCode.toLowerCase()] ?? match;
    },
  );
}

function normalizeUrlScheme(value: string): string {
  return decodeBasicHtmlEntities(value).replace(/[\u0000-\u001F\u007F\s]+/g, "").toLowerCase();
}

function isUnsafeUrlAttribute(name: string, value: string | null): boolean {
  if (value === null || !urlAttributeNames.has(name.toLowerCase())) {
    return false;
  }

  const normalizedScheme = normalizeUrlScheme(value);

  return normalizedScheme.startsWith("javascript:") || normalizedScheme.startsWith("java:script:");
}

function escapeAttributeValue(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function sanitizeAttributes(rawAttributes: string): string {
  const attributes: string[] = [];
  const attributePattern = /\s+([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(rawAttributes)) !== null) {
    const name = match[1];

    if (name === undefined) {
      continue;
    }

    const lowerName = name.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? null;

    if (lowerName.startsWith("on") || lowerName === "style" || isUnsafeUrlAttribute(lowerName, value)) {
      continue;
    }

    if (value === null) {
      attributes.push(name);
      continue;
    }

    attributes.push(`${name}="${escapeAttributeValue(value)}"`);
  }

  return attributes.length > 0 ? ` ${attributes.join(" ")}` : "";
}

export function sanitizeHtml(html: string): string {
  return removeBlockedElements(html).replace(/<([A-Za-z][A-Za-z0-9:-]*)([^<>]*)>/g, (_match, tagName: string, rawAttributes: string) => {
    if (blockedElementNames.includes(tagName.toLowerCase())) {
      return "";
    }

    return `<${tagName}${sanitizeAttributes(rawAttributes)}>`;
  });
}
