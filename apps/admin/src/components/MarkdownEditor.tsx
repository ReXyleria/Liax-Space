import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement
} from "react";

import { useT } from "../i18n/useT";

export type MarkdownEditorProps = {
  disabled?: boolean;
  forcePlainTextMode?: boolean;
  onDraftChange?: (value: string) => void;
  onUploadImage?: (file: File) => Promise<{ markdown: string; previewUrl: string }>;
  value: string;
  onChange: (value: string) => void;
};

export type EditorHeading = {
  id: string;
  level: number;
  text: string;
};

type SelectedTableContext = {
  columnIndex: number;
  rowIndex: number;
  toolbarLeft: number;
  toolbarTop: number;
  toolbarWidth: number;
};

type SlashMenuItemId = "image" | "heading1" | "heading2" | "heading3" | "heading4" | "table" | "code" | "quote" | "math";

type SlashMenuState = {
  activeIndex: number;
  left: number;
  query: string;
  top: number;
};

type EditorMode = "source" | "visual";

export type SlashMenuOption = {
  description: string;
  id: SlashMenuItemId;
  keywords: string[];
  label: string;
};

export const largeMarkdownDocumentThreshold = 512 * 1024;

export function shouldUsePlainMarkdownEditor(markdown: string): boolean {
  return markdown.length >= largeMarkdownDocumentThreshold;
}

export function filterSlashMenuOptions<T extends SlashMenuOption>(options: T[], query: string): T[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return options;
  }

  return options.filter((option) =>
    [option.label, option.description, ...option.keywords].some((value) => value.toLowerCase().includes(normalizedQuery))
  );
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const codeKeywordPattern = /\b(abstract|async|await|boolean|break|case|catch|class|const|continue|default|else|enum|export|extends|false|finally|for|from|function|if|import|interface|let|new|null|number|private|protected|public|return|string|switch|throw|true|try|type|undefined|while)\b/g;

function renderHighlightedCode(value: string): string {
  return escapeHtml(value).replace(codeKeywordPattern, '<span class="admin-code-keyword">$1</span>');
}

export function extractImageSourceFromMarkdown(value: string): string | null {
  const match = /^!\[[^\]]*\]\(([^)]+)\)$/u.exec(value.trim());
  return match?.[1] ?? null;
}

function plainHeadingText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~$]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function createEditorHeadingId(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `heading-${index}-${slug || "section"}`;
}

export function extractHeadingsFromMarkdown(markdown: string): EditorHeading[] {
  const headings: EditorHeading[] = [];

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);

    if (!match) {
      continue;
    }

    const text = plainHeadingText(match[2]);

    if (!text) {
      continue;
    }

    headings.push({
      id: createEditorHeadingId(text, headings.length),
      level: match[1].length,
      text
    });
  }

  return headings;
}

function inlineMarkdownToHtml(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\$([^$\n]+)\$/g, '<span class="admin-editor-math" data-md-math="$1">$1</span>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, altText: string, sourceUrl: string) => {
      if (sourceUrl.startsWith("attachment://")) {
        return `<span class="admin-attachment-chip" data-md-image-alt="${altText}" data-md-image-source="${sourceUrl}">Image: ${altText || sourceUrl}</span>`;
      }

      return `<img alt="${altText}" data-md-source="${sourceUrl}" src="${sourceUrl}">`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;
  let headingIndex = 0;

  function isTableSeparator(line: string): boolean {
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
    return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  }

  function isTableRow(line: string): boolean {
    return line.trim().includes("|");
  }

  function splitTableRow(line: string): string[] {
    return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  }

  function shouldMergeTableCell(value: string): boolean {
    return value.trim() !== "";
  }

  function renderMergedTableRows(rows: string[][], tagName: "td" | "th"): string {
    if (rows.length === 0) {
      return "";
    }

    const width = Math.max(...rows.map((row) => row.length), 1);
    const matrix = rows.map((row) => Array.from({ length: width }, (_item, cellIndex) => row[cellIndex] ?? ""));
    const skipped = matrix.map((row) => row.map(() => false));
    const renderedRows: string[] = [];

    for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
      const renderedCells: string[] = [];

      for (let cellIndex = 0; cellIndex < width; cellIndex += 1) {
        if (skipped[rowIndex][cellIndex]) {
          continue;
        }

        const value = matrix[rowIndex][cellIndex] ?? "";
        const canMerge = shouldMergeTableCell(value);
        let colSpan = 1;
        let rowSpan = 1;

        if (canMerge) {
          while (cellIndex + colSpan < width && matrix[rowIndex][cellIndex + colSpan] === value && !skipped[rowIndex][cellIndex + colSpan]) {
            colSpan += 1;
          }
        }

        if (colSpan > 1) {
          for (let spanIndex = 1; spanIndex < colSpan; spanIndex += 1) {
            skipped[rowIndex][cellIndex + spanIndex] = true;
          }
        } else if (canMerge) {
          while (
            rowIndex + rowSpan < matrix.length &&
            matrix[rowIndex + rowSpan][cellIndex] === value &&
            !skipped[rowIndex + rowSpan][cellIndex]
          ) {
            rowSpan += 1;
          }

          for (let spanIndex = 1; spanIndex < rowSpan; spanIndex += 1) {
            skipped[rowIndex + spanIndex][cellIndex] = true;
          }
        }

        const colSpanAttribute = colSpan > 1 ? ` colspan="${colSpan}"` : "";
        const rowSpanAttribute = rowSpan > 1 ? ` rowspan="${rowSpan}"` : "";
        renderedCells.push(`<${tagName}${colSpanAttribute}${rowSpanAttribute}>${inlineMarkdownToHtml(value)}</${tagName}>`);
      }

      renderedRows.push(`<tr>${renderedCells.join("")}</tr>`);
    }

    return renderedRows.join("");
  }

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim().split(/\s+/)[0]?.replace(/[^A-Za-z0-9_-]/g, "");
      const classAttribute = language ? ` class="language-${language}"` : "";
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      blocks.push(`<pre><code${classAttribute}>${renderHighlightedCode(codeLines.join("\n"))}</code></pre>`);
      index += 1;
      continue;
    }

    if (isTableRow(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1] ?? "")) {
      const headerCells = splitTableRow(line);
      const bodyRows: string[][] = [];
      index += 2;

      while (index < lines.length && isTableRow(lines[index] ?? "") && !isTableSeparator(lines[index] ?? "")) {
        bodyRows.push(splitTableRow(lines[index] ?? ""));
        index += 1;
      }

      blocks.push(`<table><thead>${renderMergedTableRows([headerCells], "th")}</thead><tbody>${renderMergedTableRows(bodyRows, "td")}</tbody></table>`);
      continue;
    }

    if (line.trim() === "[[toc]]") {
      blocks.push('<div class="admin-editor-toc" data-md-block="toc">Table of contents</div>');
      index += 1;
      continue;
    }

    const warningStart = /^:::\s*warning\s*(.*)$/.exec(line.trim());

    if (warningStart) {
      const warningLines: string[] = [];
      const inlineWarning = /^(.*)\s+:::$/u.exec(warningStart[1].trim());

      if (inlineWarning) {
        warningLines.push(inlineWarning[1]);
        index += 1;
      } else {
        if (warningStart[1].trim()) {
          warningLines.push(warningStart[1].trim());
        }

        index += 1;

        while (index < lines.length && (lines[index] ?? "").trim() !== ":::") {
          warningLines.push(lines[index] ?? "");
          index += 1;
        }

        if ((lines[index] ?? "").trim() === ":::") {
          index += 1;
        }
      }

      blocks.push(`<aside class="admin-editor-warning" data-md-block="warning">${inlineMarkdownToHtml(warningLines.join(" "))}</aside>`);
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);

    if (heading) {
      const headingText = plainHeadingText(heading[2]);
      const headingId = createEditorHeadingId(headingText, headingIndex);
      headingIndex += 1;
      blocks.push(
        `<h${heading[1].length} data-editor-heading-id="${escapeHtml(headingId)}">${inlineMarkdownToHtml(heading[2])}</h${heading[1].length}>`
      );
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index] ?? "")) {
        items.push(`<li>${inlineMarkdownToHtml((lines[index] ?? "").replace(/^[-*]\s+/, ""))}</li>`);
        index += 1;
      }

      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];

      while (index < lines.length && (lines[index] ?? "").startsWith("> ")) {
        quoteLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }

      blocks.push(`<blockquote>${inlineMarkdownToHtml(quoteLines.join(" "))}</blockquote>`);
      continue;
    }

    const paragraphLines: string[] = [];

    while (
      index < lines.length &&
      (lines[index] ?? "").trim() &&
      !/^(#{1,6})\s+/.test(lines[index] ?? "") &&
      !/^[-*]\s+/.test(lines[index] ?? "") &&
      !(isTableRow(lines[index] ?? "") && index + 1 < lines.length && isTableSeparator(lines[index + 1] ?? "")) &&
      !(lines[index] ?? "").startsWith("> ") &&
      !(lines[index] ?? "").startsWith("```")
    ) {
      paragraphLines.push(lines[index] ?? "");
      index += 1;
    }

    blocks.push(`<p>${inlineMarkdownToHtml(paragraphLines.join(" "))}</p>`);
  }

  if (blocks.length === 0) {
    return "<p><br></p>";
  }

  const lastBlock = blocks[blocks.length - 1] ?? "";

  if (/^<(pre|table)\b/.test(lastBlock)) {
    blocks.push("<p><br></p>");
  }

  return blocks.join("");
}

function normalizeText(value: string | null): string {
  return (value ?? "").replace(/\u00a0/g, " ").trim();
}

function inlineNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const content = Array.from(node.childNodes).map(inlineNodeToMarkdown).join("");
  const tagName = node.tagName.toLowerCase();

  if (tagName === "strong" || tagName === "b") {
    return content.trim() ? `**${content}**` : "";
  }

  if (tagName === "em" || tagName === "i") {
    return content.trim() ? `*${content}*` : "";
  }

  if (tagName === "code") {
    return content.trim() ? `\`${content}\`` : "";
  }

  if (tagName === "a") {
    const href = node.getAttribute("href") ?? "";
    return href ? `[${content || href}](${href})` : content;
  }

  if (tagName === "img") {
    const alt = node.getAttribute("alt") ?? "";
    const src = node.getAttribute("data-md-source") ?? node.getAttribute("src") ?? "";
    return src ? `![${alt}](${src})` : "";
  }

  if (tagName === "span" && node.hasAttribute("data-md-image-source")) {
    const alt = node.getAttribute("data-md-image-alt") ?? "";
    const src = node.getAttribute("data-md-image-source") ?? "";
    return src ? `![${alt}](${src})` : "";
  }

  if (tagName === "span" && node.hasAttribute("data-md-math")) {
    const math = node.getAttribute("data-md-math") ?? content;
    return math.trim() ? `$${math}$` : "";
  }

  if (tagName === "br") {
    return "\n";
  }

  return content;
}

function blockNodeToMarkdown(node: Node): string {
  if (!(node instanceof HTMLElement)) {
    return normalizeText(node.textContent);
  }

  const tagName = node.tagName.toLowerCase();

  if (node.getAttribute("data-md-block") === "toc") {
    return "[[toc]]";
  }

  if (node.getAttribute("data-md-block") === "warning") {
    const warningContent = normalizeText(inlineNodeToMarkdown(node));
    return warningContent ? `::: warning\n${warningContent}\n:::` : "::: warning\n:::";
  }

  if (/^h[1-6]$/.test(tagName)) {
    const level = Number(tagName.slice(1));
    return `${"#".repeat(Math.min(level, 6))} ${normalizeText(inlineNodeToMarkdown(node))}`;
  }

  if (tagName === "ul") {
    return Array.from(node.children)
      .filter((child) => child instanceof HTMLElement && child.tagName.toLowerCase() === "li")
      .map((child) => `- ${normalizeText(inlineNodeToMarkdown(child))}`)
      .filter((line) => line !== "-")
      .join("\n");
  }

  if (tagName === "ol") {
    return Array.from(node.children)
      .filter((child) => child instanceof HTMLElement && child.tagName.toLowerCase() === "li")
      .map((child, index) => `${index + 1}. ${normalizeText(inlineNodeToMarkdown(child))}`)
      .filter((line) => !/^\d+\.\s*$/.test(line))
      .join("\n");
  }

  if (tagName === "blockquote") {
    return normalizeText(inlineNodeToMarkdown(node))
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }

  if (tagName === "pre") {
    const codeElement = node.querySelector("code");
    const languageClass = Array.from(codeElement?.classList ?? []).find((className) => className.startsWith("language-"));
    const language = languageClass?.replace(/^language-/, "") ?? "";
    return `\`\`\`${language}\n${node.textContent?.replace(/\n+$/g, "") ?? ""}\n\`\`\``;
  }

  if (tagName === "table") {
    const rows = Array.from(node.querySelectorAll("tr"));

    if (rows.length === 0) {
      return "";
    }

    const grid: string[][] = [];

    rows.forEach((row, rowIndex) => {
      const gridRow = grid[rowIndex] ?? [];
      grid[rowIndex] = gridRow;
      let columnIndex = 0;

      Array.from(row.children)
        .filter((child) => child instanceof HTMLElement && ["td", "th"].includes(child.tagName.toLowerCase()))
        .forEach((child) => {
          while (gridRow[columnIndex] !== undefined) {
            columnIndex += 1;
          }

          const cell = child as HTMLTableCellElement;
          const content = normalizeText(inlineNodeToMarkdown(cell));
          const colSpan = Math.max(1, Number(cell.colSpan) || 1);
          const rowSpan = Math.max(1, Number(cell.rowSpan) || 1);

          for (let rowSpanIndex = 0; rowSpanIndex < rowSpan; rowSpanIndex += 1) {
            const targetRowIndex = rowIndex + rowSpanIndex;
            const targetRow = grid[targetRowIndex] ?? [];
            grid[targetRowIndex] = targetRow;

            for (let colSpanIndex = 0; colSpanIndex < colSpan; colSpanIndex += 1) {
              targetRow[columnIndex + colSpanIndex] = content;
            }
          }

          columnIndex += colSpan;
        });
    });
    const width = Math.max(...grid.map((row) => row.length), 1);
    const markdownRows = grid.map((row) => `| ${Array.from({ length: width }, (_item, cellIndex) => row[cellIndex] ?? "").join(" | ")} |`);

    if (markdownRows.length === 1) {
      markdownRows.push("| --- |");
    }

    const separatorCells = splitTableCells(markdownRows[0]).map(() => "---");
    return [
      markdownRows[0],
      `| ${separatorCells.join(" | ")} |`,
      ...markdownRows.slice(1)
    ].join("\n");
  }

  return normalizeText(inlineNodeToMarkdown(node));
}

function splitTableCells(markdownRow: string): string[] {
  return markdownRow.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function htmlToMarkdown(root: HTMLElement): string {
  return Array.from(root.childNodes)
    .map(blockNodeToMarkdown)
    .map((block) => block.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function MarkdownEditor({
  disabled = false,
  forcePlainTextMode = false,
  onChange,
  onDraftChange,
  onUploadImage,
  value
}: MarkdownEditorProps): ReactElement {
  const t = useT();
  const editorShellRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const slashImageInputRef = useRef<HTMLInputElement | null>(null);
  const slashInsertRangeRef = useRef<Range | null>(null);
  const lastMarkdownRef = useRef<string | null>(null);
  const selectedMathRef = useRef<HTMLElement | null>(null);
  const selectedTableCellRef = useRef<HTMLTableCellElement | null>(null);
  const syncFrameRef = useRef<number | null>(null);
  const sourceSyncTimerRef = useRef<number | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [isPastingImage, setIsPastingImage] = useState(false);
  const [selectedMathExpression, setSelectedMathExpression] = useState<string | null>(null);
  const [selectedTableContext, setSelectedTableContext] = useState<SelectedTableContext | null>(null);
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const isLargeDocument = forcePlainTextMode || shouldUsePlainMarkdownEditor(value);
  const isSourceMode = editorMode === "source" || isLargeDocument;
  const selectedTableToolbarStyle: CSSProperties | undefined = selectedTableContext
    ? {
        left: selectedTableContext.toolbarLeft,
        top: selectedTableContext.toolbarTop,
        width: selectedTableContext.toolbarWidth
      }
    : undefined;
  const slashMenuStyle: CSSProperties | undefined = slashMenu
    ? {
        left: slashMenu.left,
        top: slashMenu.top
      }
    : undefined;
  const slashMenuOptions = ([
    {
      description: t("article.slashImageDescription"),
      id: "image",
      keywords: ["image", "photo", "picture", "图片", "附件"],
      label: t("article.slashImage")
    },
    {
      description: t("article.slashHeading1Description"),
      id: "heading1",
      keywords: ["heading", "title", "h1", "一级标题", "标题"],
      label: t("article.slashHeading1")
    },
    {
      description: t("article.slashHeading2Description"),
      id: "heading2",
      keywords: ["heading", "title", "h2", "二级标题", "小标题"],
      label: t("article.slashHeading2")
    },
    {
      description: t("article.slashHeading3Description"),
      id: "heading3",
      keywords: ["heading", "title", "h3", "三级标题", "小标题"],
      label: t("article.slashHeading3")
    },
    {
      description: t("article.slashHeading4Description"),
      id: "heading4",
      keywords: ["heading", "title", "h4", "四级标题", "小标题"],
      label: t("article.slashHeading4")
    },
    {
      description: t("article.slashTableDescription"),
      id: "table",
      keywords: ["table", "表格"],
      label: t("article.slashTable")
    },
    {
      description: t("article.slashCodeDescription"),
      id: "code",
      keywords: ["code", "pre", "代码"],
      label: t("article.slashCode")
    },
    {
      description: t("article.slashQuoteDescription"),
      id: "quote",
      keywords: ["quote", "引用"],
      label: t("article.slashQuote")
    },
    {
      description: t("article.slashMathDescription"),
      id: "math",
      keywords: ["math", "formula", "公式"],
      label: t("article.slashMath")
    }
  ] satisfies SlashMenuOption[]).filter((option) => option.id !== "image" || Boolean(onUploadImage));
  const visibleSlashMenuOptions = slashMenu ? filterSlashMenuOptions(slashMenuOptions, slashMenu.query) : [];

  useEffect(() => {
    if (isLargeDocument) {
      setEditorMode("source");
    }
  }, [isLargeDocument]);

  useEffect(() => {
    if (!isSourceMode) {
      return;
    }

    selectedTableCellRef.current?.classList.remove("admin-visual-editor__table-cell--selected");
    selectedTableCellRef.current = null;
    selectedMathRef.current?.classList.remove("admin-editor-math--selected");
    selectedMathRef.current = null;
    setSelectedMathExpression(null);
    setSelectedTableContext(null);
    setSlashMenu(null);
  }, [isSourceMode]);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    if (isSourceMode) {
      editor.innerHTML = "";
      lastMarkdownRef.current = value;
      return;
    }

    if (value === lastMarkdownRef.current) {
      return;
    }

    editor.innerHTML = markdownToHtml(value);
    lastMarkdownRef.current = value;
  }, [isSourceMode, value]);

  useEffect(() => {
    const textarea = sourceTextareaRef.current;

    if (!isSourceMode || !textarea || value === lastMarkdownRef.current || document.activeElement === textarea) {
      return;
    }

    textarea.value = value;
    lastMarkdownRef.current = value;
  }, [isSourceMode, value]);

  useEffect(() => {
    return () => {
      if (syncFrameRef.current !== null) {
        window.cancelAnimationFrame(syncFrameRef.current);
      }

      if (sourceSyncTimerRef.current !== null) {
        window.clearTimeout(sourceSyncTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedTableContext) {
      return;
    }

    const updateFloatingToolbar = (): void => {
      const cell = selectedTableCellRef.current;

      if (!cell) {
        setSelectedTableContext(null);
        return;
      }

      const nextContext = createSelectedTableContext(cell);

      if (!nextContext) {
        clearTableContext();
        return;
      }

      setSelectedTableContext(nextContext);
    };

    const editor = editorRef.current;
    window.addEventListener("resize", updateFloatingToolbar);
    editor?.addEventListener("scroll", updateFloatingToolbar, { passive: true });

    return () => {
      window.removeEventListener("resize", updateFloatingToolbar);
      editor?.removeEventListener("scroll", updateFloatingToolbar);
    };
  }, [selectedTableContext !== null]);

  function syncMarkdownFromEditor(): void {
    if (syncFrameRef.current !== null) {
      window.cancelAnimationFrame(syncFrameRef.current);
      syncFrameRef.current = null;
    }

    if (sourceSyncTimerRef.current !== null) {
      window.clearTimeout(sourceSyncTimerRef.current);
      sourceSyncTimerRef.current = null;
    }

    if (isSourceMode) {
      const nextMarkdown = sourceTextareaRef.current?.value ?? value;
      lastMarkdownRef.current = nextMarkdown;
      onChange(nextMarkdown);
      return;
    }

    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    const nextMarkdown = htmlToMarkdown(editor);
    lastMarkdownRef.current = nextMarkdown;
    onChange(nextMarkdown);
  }

  function syncSourceMarkdown(nextMarkdown: string, options: { defer?: boolean } = {}): void {
    lastMarkdownRef.current = nextMarkdown;
    onDraftChange?.(nextMarkdown);

    if (sourceSyncTimerRef.current !== null) {
      window.clearTimeout(sourceSyncTimerRef.current);
      sourceSyncTimerRef.current = null;
    }

    if (options.defer) {
      sourceSyncTimerRef.current = window.setTimeout(() => {
        sourceSyncTimerRef.current = null;
        onChange(nextMarkdown);
      }, 700);
      return;
    }

    onChange(nextMarkdown);
  }

  function handleSourceInput(nextMarkdown: string): void {
    syncSourceMarkdown(nextMarkdown, { defer: true });
  }

  function focusSourceEditor(): void {
    sourceTextareaRef.current?.focus();
  }

  function updateSourceSelection(selectionStart: number, selectionEnd = selectionStart): void {
    window.requestAnimationFrame(() => {
      const textarea = sourceTextareaRef.current;

      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function applySourceSelectionTransform(transform: (selection: string) => { cursorEnd?: number; cursorStart?: number; text: string }): void {
    const textarea = sourceTextareaRef.current;

    if (!textarea || disabled) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentMarkdown = textarea.value;
    const selection = currentMarkdown.slice(start, end);
    const replacement = transform(selection);
    const nextMarkdown = `${currentMarkdown.slice(0, start)}${replacement.text}${currentMarkdown.slice(end)}`;
    const cursorStart = start + (replacement.cursorStart ?? replacement.text.length);
    const cursorEnd = start + (replacement.cursorEnd ?? replacement.cursorStart ?? replacement.text.length);

    textarea.value = nextMarkdown;
    syncSourceMarkdown(nextMarkdown, { defer: true });
    updateSourceSelection(cursorStart, cursorEnd);
  }

  function insertSourceBlock(markdown: string, cursorOffset = markdown.length): void {
    applySourceSelectionTransform(() => ({
      cursorStart: cursorOffset,
      text: markdown
    }));
  }

  function wrapSourceSelection(prefix: string, suffix: string, placeholder: string): void {
    applySourceSelectionTransform((selection) => {
      const content = selection || placeholder;
      return {
        cursorStart: prefix.length,
        cursorEnd: prefix.length + content.length,
        text: `${prefix}${content}${suffix}`
      };
    });
  }

  function prefixSourceLines(prefix: string, placeholder: string): void {
    applySourceSelectionTransform((selection) => {
      const content = selection || placeholder;
      const prefixed = content
        .split("\n")
        .map((line) => `${prefix}${line}`)
        .join("\n");

      return {
        cursorStart: prefixed.length,
        text: prefixed
      };
    });
  }

  function insertSourceMarkdown(markdown: string): void {
    insertSourceBlock(markdown);
  }

  function clearTableContext(): void {
    selectedTableCellRef.current?.classList.remove("admin-visual-editor__table-cell--selected");
    selectedTableCellRef.current = null;
    setSelectedTableContext(null);
  }

  function scheduleMarkdownSync(): void {
    if (syncFrameRef.current !== null) {
      return;
    }

    syncFrameRef.current = window.requestAnimationFrame(() => {
      syncFrameRef.current = null;
      syncMarkdownFromEditor();
    });
  }

  function runCommand(command: string, valueForCommand?: string): void {
    if (disabled) {
      return;
    }

    editorRef.current?.focus();
    document.execCommand(command, false, valueForCommand);
    syncMarkdownFromEditor();
  }

  function insertHtml(html: string): void {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    syncMarkdownFromEditor();
  }

  function saveCurrentInsertRange(): void {
    const selection = window.getSelection();
    slashInsertRangeRef.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  }

  function restoreSavedInsertRange(): void {
    const range = slashInsertRangeRef.current;

    if (!range) {
      return;
    }

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editorRef.current?.focus();
  }

  function readSlashQueryFromSelection(): string | null {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || !selection.isCollapsed || selection.rangeCount === 0) {
      return null;
    }

    const anchorNode = selection.anchorNode;

    if (!anchorNode || !editor.contains(anchorNode)) {
      return null;
    }

    if (anchorNode.nodeType !== Node.TEXT_NODE) {
      return null;
    }

    const textBeforeCaret = (anchorNode.textContent ?? "").slice(0, selection.anchorOffset);
    const match = /(?:^|\s)\/([^\s/]*)$/u.exec(textBeforeCaret);
    return match?.[1] ?? null;
  }

  function readSlashMenuState(): SlashMenuState | null {
    const query = readSlashQueryFromSelection();
    const editor = editorRef.current;
    const shell = editorShellRef.current;
    const selection = window.getSelection();

    if (query === null || !editor || !shell || !selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const shellRect = shell.getBoundingClientRect();
    const fallbackRect = editor.getBoundingClientRect();
    const rangeRect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    const rawLeft = rangeRect.width || rangeRect.height ? rangeRect.left : fallbackRect.left + 18;
    const rawTop = rangeRect.width || rangeRect.height ? rangeRect.bottom : fallbackRect.top + 48;
    const menuWidth = Math.min(320, Math.max(240, shellRect.width - 16));
    const minLeft = 8;
    const maxLeft = Math.max(minLeft, shellRect.width - menuWidth - 8);

    return {
      activeIndex: 0,
      left: Math.round(Math.min(Math.max(rawLeft - shellRect.left, minLeft), maxLeft)),
      query,
      top: Math.round(Math.max(rawTop - shellRect.top + 8, 8))
    };
  }

  function updateSlashMenuFromSelection(): void {
    if (disabled) {
      setSlashMenu(null);
      return;
    }

    setSlashMenu(readSlashMenuState());
  }

  function removeSlashTrigger(): void {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || !selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const anchorNode = selection.anchorNode;

    if (!anchorNode || !editor.contains(anchorNode) || anchorNode.nodeType !== Node.TEXT_NODE) {
      return;
    }

    const originalText = anchorNode.textContent ?? "";
    const offset = selection.anchorOffset;
    const beforeCaret = originalText.slice(0, offset);
    const match = /(^|\s)\/[^\s/]*$/u.exec(beforeCaret);

    if (!match) {
      return;
    }

    const nextOffset = match.index + match[1].length;
    anchorNode.textContent = `${originalText.slice(0, nextOffset)}${originalText.slice(offset)}`;

    const range = document.createRange();
    range.setStart(anchorNode, nextOffset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function tableCellFromTarget(target: EventTarget | null): HTMLTableCellElement | null {
    if (!(target instanceof Element)) {
      return null;
    }

    const cell = target.closest("td, th");

    if (!(cell instanceof HTMLTableCellElement) || !editorRef.current?.contains(cell)) {
      return null;
    }

    return cell;
  }

  function createSelectedTableContext(cell: HTMLTableCellElement): SelectedTableContext | null {
    const row = cell.parentElement;
    const table = cell.closest("table");
    const shell = editorShellRef.current;

    if (!(row instanceof HTMLTableRowElement) || !(table instanceof HTMLTableElement) || !shell || !editorRef.current?.contains(table)) {
      return null;
    }

    const shellRect = shell.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const rowIndex = Array.from(table.rows).indexOf(row);
    const maxToolbarWidth = Math.max(220, shellRect.width - 16);
    const toolbarWidth = Math.min(Math.max(280, tableRect.width), maxToolbarWidth);
    const minLeft = 8;
    const maxLeft = Math.max(minLeft, shellRect.width - toolbarWidth - 8);
    const tableLeft = tableRect.left - shellRect.left;
    const tableTop = tableRect.top - shellRect.top;

    return {
      columnIndex: cell.cellIndex + 1,
      rowIndex: rowIndex + 1,
      toolbarLeft: Math.round(Math.min(Math.max(tableLeft, minLeft), maxLeft)),
      toolbarTop: Math.round(Math.max(tableTop, 48)),
      toolbarWidth: Math.round(toolbarWidth)
    };
  }

  function mathNodeFromTarget(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) {
      return null;
    }

    const mathNode = target.closest(".admin-editor-math");

    if (!(mathNode instanceof HTMLElement) || !editorRef.current?.contains(mathNode)) {
      return null;
    }

    return mathNode;
  }

  function selectTableCell(cell: HTMLTableCellElement | null): void {
    selectedTableCellRef.current?.classList.remove("admin-visual-editor__table-cell--selected");
    selectedTableCellRef.current = cell;

    if (!cell) {
      setSelectedTableContext(null);
      return;
    }

    cell.classList.add("admin-visual-editor__table-cell--selected");
    setSelectedTableContext(createSelectedTableContext(cell));
  }

  function selectMathNode(mathNode: HTMLElement | null): void {
    selectedMathRef.current?.classList.remove("admin-editor-math--selected");
    selectedMathRef.current = mathNode;

    if (!mathNode) {
      setSelectedMathExpression(null);
      return;
    }

    mathNode.classList.add("admin-editor-math--selected");
    setSelectedMathExpression(mathNode.getAttribute("data-md-math") ?? mathNode.textContent ?? "");
  }

  function updateContextFromTarget(target: EventTarget | null): void {
    const nextMathNode = mathNodeFromTarget(target);
    selectMathNode(nextMathNode);
    selectTableCell(nextMathNode ? null : tableCellFromTarget(target));
  }

  function updateContextFromSelection(): void {
    const anchorNode = window.getSelection()?.anchorNode ?? null;
    const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement ?? null;
    updateContextFromTarget(anchorElement);
  }

  function handleEditorClick(target: EventTarget | null): void {
    updateContextFromTarget(target);
    updateSlashMenuFromSelection();
  }

  function selectedTableDetails(): { cell: HTMLTableCellElement; row: HTMLTableRowElement; table: HTMLTableElement } | null {
    const cell = selectedTableCellRef.current;
    const row = cell?.parentElement;
    const table = cell?.closest("table");

    if (!cell || !(row instanceof HTMLTableRowElement) || !(table instanceof HTMLTableElement) || !editorRef.current?.contains(table)) {
      clearTableContext();
      return null;
    }

    return { cell, row, table };
  }

  function createTableCell(row: HTMLTableRowElement): HTMLTableCellElement {
    const cell = document.createElement(row.closest("thead") ? "th" : "td");
    cell.innerHTML = "<br>";
    return cell;
  }

  function refreshTableSelection(cell: HTMLTableCellElement | null): void {
    selectTableCell(cell);
    editorRef.current?.focus();
    syncMarkdownFromEditor();
  }

  function insertTableRowAfter(): void {
    const details = selectedTableDetails();

    if (!details || disabled) {
      return;
    }

    const cells = Array.from(details.row.cells);
    const newRow = document.createElement("tr");
    cells.forEach(() => newRow.append(document.createElement("td")));
    Array.from(newRow.cells).forEach((cell) => {
      cell.innerHTML = "<br>";
    });

    if (details.row.closest("thead")) {
      const body = details.table.tBodies[0] ?? details.table.createTBody();
      body.insertBefore(newRow, body.firstElementChild);
    } else {
      details.row.after(newRow);
    }

    refreshTableSelection(newRow.cells[Math.min(details.cell.cellIndex, newRow.cells.length - 1)] ?? null);
  }

  function deleteTableRow(): void {
    const details = selectedTableDetails();

    if (!details || disabled || details.table.rows.length <= 1) {
      return;
    }

    const rowIndex = Array.from(details.table.rows).indexOf(details.row);
    details.row.remove();
    const nextRow = details.table.rows[Math.min(rowIndex, details.table.rows.length - 1)] ?? null;
    refreshTableSelection(nextRow?.cells[Math.min(details.cell.cellIndex, (nextRow?.cells.length ?? 1) - 1)] ?? null);
  }

  function insertTableColumnAfter(): void {
    const details = selectedTableDetails();

    if (!details || disabled) {
      return;
    }

    const targetIndex = details.cell.cellIndex + 1;
    let selectedCell: HTMLTableCellElement | null = null;

    Array.from(details.table.rows).forEach((row) => {
      const newCell = createTableCell(row);
      row.insertBefore(newCell, row.cells[targetIndex] ?? null);

      if (row === details.row) {
        selectedCell = newCell;
      }
    });

    refreshTableSelection(selectedCell);
  }

  function deleteTableColumn(): void {
    const details = selectedTableDetails();

    if (!details || disabled) {
      return;
    }

    const targetIndex = details.cell.cellIndex;

    Array.from(details.table.rows).forEach((row) => {
      if (row.cells.length <= 1) {
        return;
      }

      const cell = row.cells[Math.min(targetIndex, row.cells.length - 1)] ?? null;

      if (!cell) {
        return;
      }

      if (cell.colSpan > 1) {
        cell.colSpan -= 1;
      } else {
        cell.remove();
      }
    });

    const nextRow = details.table.rows[Math.min(details.row.rowIndex, details.table.rows.length - 1)] ?? details.table.rows[0] ?? null;
    refreshTableSelection(nextRow?.cells[Math.min(targetIndex, (nextRow?.cells.length ?? 1) - 1)] ?? null);
  }

  function applyMathExpression(): void {
    if (!selectedMathRef.current || selectedMathExpression === null || disabled) {
      return;
    }

    const nextExpression = selectedMathExpression.trim() || "E=mc^2";
    selectedMathRef.current.setAttribute("data-md-math", nextExpression);
    selectedMathRef.current.textContent = nextExpression;
    syncMarkdownFromEditor();
  }

  function insertSourceHeading(level: 1 | 2 | 3 | 4): void {
    applySourceSelectionTransform((selection) => {
      const prefix = `\n\n${"#".repeat(level)} `;
      const content = selection || "Heading";
      const suffix = "\n\n";

      return {
        cursorStart: prefix.length,
        cursorEnd: prefix.length + content.length,
        text: `${prefix}${content}${suffix}`
      };
    });
  }

  function insertTable(): void {
    if (isSourceMode) {
      insertSourceMarkdown("\n\n| Title | Title | Value |\n| --- | --- | --- |\n| Same | Same | Other |\n| A | B | B |\n\n");
      return;
    }

    insertHtml(
      "<table><thead><tr><th>Title</th><th>Title</th><th>Value</th></tr></thead><tbody><tr><td>Same</td><td>Same</td><td>Other</td></tr><tr><td>A</td><td>B</td><td>B</td></tr></tbody></table><p><br></p>"
    );
  }

  function insertCodeBlock(): void {
    if (isSourceMode) {
      applySourceSelectionTransform((selection) => {
        const prefix = "\n\n```ts\n";
        const content = selection || "code";
        const suffix = "\n```\n\n";

        return {
          cursorStart: prefix.length,
          cursorEnd: prefix.length + content.length,
          text: `${prefix}${content}${suffix}`
        };
      });
      return;
    }

    insertHtml("<pre><code>code</code></pre><p><br></p>");
  }

  function insertMath(): void {
    if (isSourceMode) {
      wrapSourceSelection("$", "$", "E=mc^2");
      return;
    }

    insertHtml('<span class="admin-editor-math" data-md-math="E=mc^2">E=mc^2</span> ');
  }

  function insertHeadingBlock(level: 1 | 2 | 3 | 4 = 2): void {
    if (isSourceMode) {
      insertSourceHeading(level);
      return;
    }

    insertHtml(`<h${level}>Heading</h${level}><p><br></p>`);
  }

  function insertQuoteBlock(): void {
    if (isSourceMode) {
      prefixSourceLines("> ", "Quote");
      return;
    }

    insertHtml("<blockquote>Quote</blockquote><p><br></p>");
  }

  function applySlashMenuOption(option: SlashMenuOption): void {
    if (disabled) {
      return;
    }

    removeSlashTrigger();
    setSlashMenu(null);

    if (option.id === "image") {
      saveCurrentInsertRange();
      slashImageInputRef.current?.click();
      return;
    }

    if (option.id === "heading1") {
      insertHeadingBlock(1);
    } else if (option.id === "heading2") {
      insertHeadingBlock(2);
    } else if (option.id === "heading3") {
      insertHeadingBlock(3);
    } else if (option.id === "heading4") {
      insertHeadingBlock(4);
    } else if (option.id === "table") {
      insertTable();
    } else if (option.id === "code") {
      insertCodeBlock();
    } else if (option.id === "quote") {
      insertQuoteBlock();
    } else if (option.id === "math") {
      insertMath();
    }
  }

  function chooseImageFile(): void {
    if (disabled || !onUploadImage) {
      return;
    }

    if (!isSourceMode) {
      saveCurrentInsertRange();
    }

    slashImageInputRef.current?.click();
  }

  function handleEditorInput(): void {
    scheduleMarkdownSync();
    updateSlashMenuFromSelection();
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!slashMenu || visibleSlashMenuOptions.length === 0) {
      if (event.key === "Escape") {
        setSlashMenu(null);
      }

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setSlashMenu(null);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setSlashMenu((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          activeIndex: (current.activeIndex + direction + visibleSlashMenuOptions.length) % visibleSlashMenuOptions.length
        };
      });
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const selectedOption = visibleSlashMenuOptions[Math.min(slashMenu.activeIndex, visibleSlashMenuOptions.length - 1)];

      if (selectedOption) {
        applySlashMenuOption(selectedOption);
      }
    }
  }

  async function handleSlashImageFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";

    if (!file || !onUploadImage) {
      return;
    }

    restoreSavedInsertRange();
    setIsPastingImage(true);

    try {
      const image = await onUploadImage(file);
      const markdownSource = extractImageSourceFromMarkdown(image.markdown) ?? image.previewUrl;

      if (isSourceMode) {
        insertSourceMarkdown(`![${file.name}](${markdownSource})\n\n`);
        return;
      }

      insertHtml(
        `<img alt="${escapeHtml(file.name)}" data-md-source="${escapeHtml(markdownSource)}" src="${escapeHtml(image.previewUrl)}"><p><br></p>`
      );
    } finally {
      slashInsertRangeRef.current = null;
      setIsPastingImage(false);
    }
  }

  async function handlePaste(event: ClipboardEvent<HTMLDivElement>): Promise<void> {
    const imageFiles = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length > 0 && onUploadImage) {
      event.preventDefault();
      setIsPastingImage(true);

      try {
        for (const file of imageFiles) {
          const image = await onUploadImage(file);
          const markdownSource = extractImageSourceFromMarkdown(image.markdown) ?? image.previewUrl;

          insertHtml(
            `<img alt="${escapeHtml(file.name)}" data-md-source="${escapeHtml(markdownSource)}" src="${escapeHtml(image.previewUrl)}"><p><br></p>`
          );
        }
      } finally {
        setIsPastingImage(false);
      }

      return;
    }

    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    syncMarkdownFromEditor();
  }

  return (
    <section className="admin-visual-editor" aria-label={t("article.markdownContent")} ref={editorShellRef}>
      <div className="admin-visual-editor__toolbar" aria-label={t("article.editorToolbar")}>
        <div className="admin-visual-editor__mode-toggle" aria-label={t("article.editorViewMode")}>
          <button
            aria-pressed={!isSourceMode}
            className={!isSourceMode ? "admin-visual-editor__mode-button admin-visual-editor__mode-button--active" : "admin-visual-editor__mode-button"}
            disabled={disabled || isLargeDocument}
            onClick={() => setEditorMode("visual")}
            type="button"
          >
            {t("article.editorVisual")}
          </button>
          <button
            aria-pressed={isSourceMode}
            className={isSourceMode ? "admin-visual-editor__mode-button admin-visual-editor__mode-button--active" : "admin-visual-editor__mode-button"}
            disabled={disabled}
            onClick={() => setEditorMode("source")}
            type="button"
          >
            {t("article.editorSource")}
          </button>
        </div>
        {isLargeDocument ? <span className="admin-visual-editor__status">{t("article.editorLargeDocumentMode")}</span> : null}
        <button disabled={disabled} onClick={() => isSourceMode ? focusSourceEditor() : runCommand("formatBlock", "p")} type="button">
          {t("article.editorParagraph")}
        </button>
        <button disabled={disabled} onClick={() => isSourceMode ? insertSourceHeading(2) : runCommand("formatBlock", "h2")} type="button">
          H2
        </button>
        <button disabled={disabled} onClick={() => isSourceMode ? insertSourceHeading(3) : runCommand("formatBlock", "h3")} type="button">
          H3
        </button>
        <button disabled={disabled} onClick={() => isSourceMode ? wrapSourceSelection("**", "**", "bold text") : runCommand("bold")} type="button">
          B
        </button>
        <button disabled={disabled} onClick={() => isSourceMode ? wrapSourceSelection("*", "*", "emphasis") : runCommand("italic")} type="button">
          I
        </button>
        <button disabled={disabled} onClick={() => isSourceMode ? prefixSourceLines("- ", "List item") : runCommand("insertUnorderedList")} type="button">
          {t("article.editorList")}
        </button>
        <button disabled={disabled} onClick={() => isSourceMode ? insertQuoteBlock() : runCommand("formatBlock", "blockquote")} type="button">
          {t("article.editorQuote")}
        </button>
        <button disabled={disabled} onClick={insertCodeBlock} type="button">
          {t("article.editorCode")}
        </button>
        <button disabled={disabled} onClick={insertTable} type="button">
          {t("article.editorTable")}
        </button>
        <button disabled={disabled} onClick={insertMath} type="button">
          {t("article.editorMath")}
        </button>
        <button disabled={disabled || !onUploadImage} onClick={chooseImageFile} type="button">
          {t("article.slashImage")}
        </button>
        {isPastingImage ? <span className="admin-visual-editor__status">{t("attachment.uploading")}</span> : null}
      </div>
      {!isSourceMode && selectedTableContext ? (
        <div
          className="admin-visual-editor__context-toolbar admin-visual-editor__context-toolbar--table"
          aria-label={t("article.editorTableTools")}
          style={selectedTableToolbarStyle}
        >
          <span>{t("article.editorTableTools")} R{selectedTableContext.rowIndex} C{selectedTableContext.columnIndex}</span>
          <button disabled={disabled} onClick={insertTableRowAfter} type="button">
            {t("article.editorTableAddRow")}
          </button>
          <button disabled={disabled} onClick={deleteTableRow} type="button">
            {t("article.editorTableDeleteRow")}
          </button>
          <button disabled={disabled} onClick={insertTableColumnAfter} type="button">
            {t("article.editorTableAddColumn")}
          </button>
          <button disabled={disabled} onClick={deleteTableColumn} type="button">
            {t("article.editorTableDeleteColumn")}
          </button>
        </div>
      ) : null}
      {!isSourceMode && selectedMathExpression !== null ? (
        <div className="admin-visual-editor__context-toolbar" aria-label={t("article.editorFormulaTools")}>
          <label className="admin-visual-editor__formula-field">
            <span>{t("article.editorFormulaTools")}</span>
            <input
              disabled={disabled}
              onChange={(event) => setSelectedMathExpression(event.target.value)}
              value={selectedMathExpression}
            />
          </label>
          <button disabled={disabled} onClick={applyMathExpression} type="button">
            {t("article.editorFormulaApply")}
          </button>
        </div>
      ) : null}
      {!isSourceMode && slashMenu ? (
        <div
          className="admin-visual-editor__slash-menu"
          aria-label={t("article.slashMenu")}
          role="listbox"
          style={slashMenuStyle}
        >
          {visibleSlashMenuOptions.length > 0 ? (
            visibleSlashMenuOptions.map((option, index) => (
              <button
                aria-selected={index === slashMenu.activeIndex}
                className={index === slashMenu.activeIndex ? "admin-visual-editor__slash-item admin-visual-editor__slash-item--active" : "admin-visual-editor__slash-item"}
                key={option.id}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applySlashMenuOption(option);
                }}
                role="option"
                type="button"
              >
                <span>{option.label}</span>
                <small>{option.description}</small>
              </button>
            ))
          ) : (
            <p className="admin-visual-editor__slash-empty">{t("article.slashEmpty")}</p>
          )}
        </div>
      ) : null}
      <input
        accept="image/jpeg,image/png,image/webp,image/gif"
        aria-hidden="true"
        className="admin-visual-editor__hidden-file"
        onChange={(event) => void handleSlashImageFile(event)}
        ref={slashImageInputRef}
        tabIndex={-1}
        type="file"
      />
      {isSourceMode ? (
        <textarea
          className="admin-visual-editor__source"
          defaultValue={value}
          disabled={disabled}
          onBlur={syncMarkdownFromEditor}
          onInput={(event) => handleSourceInput(event.currentTarget.value)}
          ref={sourceTextareaRef}
          spellCheck
        />
      ) : (
        <div
          className="admin-visual-editor__surface"
          contentEditable={!disabled}
          onBlur={syncMarkdownFromEditor}
          onClick={(event) => handleEditorClick(event.target)}
          onInput={handleEditorInput}
          onKeyDown={handleEditorKeyDown}
          onKeyUp={updateContextFromSelection}
          onPaste={handlePaste}
          ref={editorRef}
          role="textbox"
          spellCheck
          suppressContentEditableWarning
          tabIndex={disabled ? -1 : 0}
        />
      )}
    </section>
  );
}
