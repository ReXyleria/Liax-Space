import sanitizeHtml from "sanitize-html";

export function sanitizeArticleHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "strong",
      "em",
      "s",
      "blockquote",
      "code",
      "pre",
      "ul",
      "ol",
      "li",
      "mark",
      "span",
      "table",
      "colgroup",
      "col",
      "tbody",
      "thead",
      "tr",
      "td",
      "th",
      "details",
      "summary",
      "div",
      "a",
      "img",
      "hr",
      "br"
    ],
    allowedAttributes: {
      h1: ["id", "style"],
      h2: ["id", "style"],
      h3: ["id", "style"],
      h4: ["id", "style"],
      p: ["style"],
      span: ["style"],
      mark: ["style"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "style"],
      div: ["data-details-content"],
      details: ["open"],
      table: ["style"],
      colgroup: ["style"],
      col: ["style"],
      tr: ["style"],
      td: ["style", "colspan", "rowspan", "colwidth", "data-colwidth"],
      th: ["style", "colspan", "rowspan", "colwidth", "data-colwidth"]
    },
    allowedStyles: {
      "*": {
        "text-align": [/^(left|center|right|justify)$/],
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
        "vertical-align": [/^(top|middle|bottom)$/]
      },
      span: {
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
        "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
        "font-size": [/^\d+(px|rem|em)$/],
        "font-family": [/^[a-zA-Z0-9\s,",'-]+$/]
      },
      mark: {
        "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/]
      },
      td: {
        "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
        width: [/^\d+(px|%)$/],
        "border-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
        "border-width": [/^\d+(px|rem|em)$/]
      },
      th: {
        "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
        width: [/^\d+(px|%)$/],
        "border-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
        "border-width": [/^\d+(px|rem|em)$/]
      },
      table: {
        width: [/^\d+(px|%)$/],
        "min-width": [/^\d+(px|%)$/]
      },
      col: {
        width: [/^\d+(px|%)$/],
        "min-width": [/^\d+(px|%)$/]
      },
      tr: {
        height: [/^\d+(px|rem|em)$/]
      },
      img: {
        width: [/^\d+(px|%)$/],
        height: [/^\d+(px|%)$/],
        "max-width": [/^100%$/]
      }
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank"
      })
    }
  });
}
