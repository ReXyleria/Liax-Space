import { Extension, Node, mergeAttributes, type AnyExtension } from "@tiptap/core";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";
import { Plugin } from "@tiptap/pm/state";
import {
  CellSelection,
  addColumnAfter,
  addRowAfter,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  tableEditing,
  toggleHeaderColumn,
  toggleHeaderRow
} from "@tiptap/pm/tables";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    table: {
      insertTable: (options?: { rows?: number; cols?: number; withHeaderRow?: boolean }) => ReturnType;
      addRowAfter: () => ReturnType;
      deleteRow: () => ReturnType;
      addColumnAfter: () => ReturnType;
      deleteColumn: () => ReturnType;
      toggleHeaderRow: () => ReturnType;
      toggleHeaderColumn: () => ReturnType;
      deleteTable: () => ReturnType;
      setCellSelection: (options: { anchorCell: number; headCell: number }) => ReturnType;
    };
  }
}

const trailingNodeNames = new Set(["table", "codeBlock", "details"]);

function parseColWidth(value: string | null) {
  if (!value) {
    return null;
  }

  const widths = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);

  return widths.length ? widths : null;
}

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => (
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {}
            )
          }
        }
      }
    ];
  }
});

const TableRowNode = Node.create({
  name: "tableRow",
  content: "(tableCell | tableHeader)+",
  tableRole: "row",
  parseHTML() {
    return [{ tag: "tr" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["tr", mergeAttributes(HTMLAttributes), 0];
  }
});

const TableNode = Node.create({
  name: "table",
  group: "block",
  content: "tableRow+",
  tableRole: "table",
  isolating: true,
  parseHTML() {
    return [{ tag: "table" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "table",
      mergeAttributes(HTMLAttributes, { class: "editor-table" }),
      ["tbody", 0]
    ];
  },
  addCommands() {
    return {
      insertTable:
        (options = {}) =>
        ({ state, dispatch }) => {
          const rows = Math.max(1, options.rows ?? 3);
          const cols = Math.max(1, options.cols ?? 3);
          const { schema } = state;
          const table = schema.nodes.table;
          const tableRow = schema.nodes.tableRow;
          const tableCell = schema.nodes.tableCell;
          const tableHeader = schema.nodes.tableHeader;
          const paragraph = schema.nodes.paragraph;

          if (!table || !tableRow || !tableCell || !tableHeader || !paragraph) {
            return false;
          }

          const rowNodes = Array.from({ length: rows }, (_rowValue, rowIndex) => {
            const cellType = options.withHeaderRow && rowIndex === 0 ? tableHeader : tableCell;
            const cells = Array.from({ length: cols }, () =>
              cellType.create(null, paragraph.create())
            );
            return tableRow.create(null, cells);
          });

          const tableNode = table.create(null, rowNodes);
          if (dispatch) {
            dispatch(state.tr.replaceSelectionWith(tableNode).scrollIntoView());
          }
          return true;
        },
      addRowAfter:
        () =>
        ({ state, dispatch }) =>
          addRowAfter(state, dispatch),
      deleteRow:
        () =>
        ({ state, dispatch }) =>
          deleteRow(state, dispatch),
      addColumnAfter:
        () =>
        ({ state, dispatch }) =>
          addColumnAfter(state, dispatch),
      deleteColumn:
        () =>
        ({ state, dispatch }) =>
          deleteColumn(state, dispatch),
      toggleHeaderRow:
        () =>
        ({ state, dispatch }) =>
          toggleHeaderRow(state, dispatch),
      toggleHeaderColumn:
        () =>
        ({ state, dispatch }) =>
          toggleHeaderColumn(state, dispatch),
      deleteTable:
        () =>
        ({ state, dispatch }) =>
          deleteTable(state, dispatch),
      setCellSelection:
        ({ anchorCell, headCell }) =>
        ({ state, dispatch }) => {
          if (!dispatch) {
            return true;
          }
          dispatch(state.tr.setSelection(CellSelection.create(state.doc, anchorCell, headCell)).scrollIntoView());
          return true;
        }
    };
  },
  addProseMirrorPlugins() {
    return [
      columnResizing({
        lastColumnResizable: false,
        cellMinWidth: 80
      }),
      tableEditing({ allowTableNodeSelection: true })
    ];
  }
});

const TableCellNode = Node.create({
  name: "tableCell",
  content: "block+",
  tableRole: "cell",
  isolating: true,
  addAttributes() {
    return {
      colspan: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute("colspan") || 1)
      },
      rowspan: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute("rowspan") || 1)
      },
      colwidth: {
        default: null,
        parseHTML: (element) => parseColWidth(element.getAttribute("data-colwidth"))
      }
    };
  },
  parseHTML() {
    return [{ tag: "td" }];
  },
  renderHTML({ HTMLAttributes }) {
    const { colwidth, ...rest } = HTMLAttributes;
    const colspan = typeof rest.colspan === "number" && rest.colspan > 1 ? rest.colspan : undefined;
    const rowspan = typeof rest.rowspan === "number" && rest.rowspan > 1 ? rest.rowspan : undefined;

    return [
      "td",
      mergeAttributes(
        rest,
        colspan ? { colspan } : {},
        rowspan ? { rowspan } : {},
        Array.isArray(colwidth) && colwidth.length ? { "data-colwidth": colwidth.join(",") } : {}
      ),
      0
    ];
  }
});

const TableHeaderNode = Node.create({
  name: "tableHeader",
  content: "block+",
  tableRole: "header_cell",
  isolating: true,
  addAttributes() {
    return {
      colspan: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute("colspan") || 1)
      },
      rowspan: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute("rowspan") || 1)
      },
      colwidth: {
        default: null,
        parseHTML: (element) => parseColWidth(element.getAttribute("data-colwidth"))
      }
    };
  },
  parseHTML() {
    return [{ tag: "th" }];
  },
  renderHTML({ HTMLAttributes }) {
    const { colwidth, ...rest } = HTMLAttributes;
    const colspan = typeof rest.colspan === "number" && rest.colspan > 1 ? rest.colspan : undefined;
    const rowspan = typeof rest.rowspan === "number" && rest.rowspan > 1 ? rest.rowspan : undefined;

    return [
      "th",
      mergeAttributes(
        rest,
        colspan ? { colspan } : {},
        rowspan ? { rowspan } : {},
        Array.isArray(colwidth) && colwidth.length ? { "data-colwidth": colwidth.join(",") } : {}
      ),
      0
    ];
  }
});

const DetailsNode = Node.create({
  name: "details",
  group: "block",
  content: "detailsSummary detailsContent",
  defining: true,
  selectable: true,
  isolating: true,
  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element) => element.hasAttribute("open"),
        renderHTML: (attributes) => (attributes.open ? { open: "" } : {})
      }
    };
  },
  parseHTML: () => [{ tag: "details" }],
  renderHTML: ({ HTMLAttributes }) => [
    "details",
    mergeAttributes(HTMLAttributes, { class: "editor-details" }),
    0
  ],
  addKeyboardShortcuts() {
    const removePreviousDetails = () => {
      const { state, view } = this.editor;
      const { selection } = state;

      if (!selection.empty) {
        return false;
      }

      const before = selection.$from.nodeBefore;
      if (!before || before.type.name !== this.name) {
        return false;
      }

      const to = selection.from;
      const from = to - before.nodeSize;
      view.dispatch(state.tr.delete(from, to).scrollIntoView());
      return true;
    };

    return {
      Backspace: removePreviousDetails,
      Delete: removePreviousDetails
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleClickOn: (view, _pos, node, nodePos, event) => {
            const target = event.target;
            if (node.type.name !== this.name || !(target instanceof Element)) {
              return false;
            }

            if (!target.closest("summary")) {
              return false;
            }

            event.preventDefault();
            event.stopPropagation();
            view.dispatch(
              view.state.tr.setNodeMarkup(nodePos, undefined, {
                ...node.attrs,
                open: !node.attrs.open
              })
            );
            return true;
          }
        }
      })
    ];
  }
});

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width") || element.style.width || null,
        renderHTML: (attributes) => (attributes.width ? { width: attributes.width } : {})
      },
      height: {
        default: null,
        parseHTML: (element) => element.getAttribute("height") || element.style.height || null,
        renderHTML: (attributes) => (attributes.height ? { height: attributes.height } : {})
      }
    };
  },
  renderHTML({ HTMLAttributes }) {
    const { width, height, style, ...attrs } = HTMLAttributes;
    const styles = [
      typeof style === "string" ? style : "",
      width ? `width: ${width}` : "",
      height ? `height: ${height}` : "",
      "max-width: 100%"
    ].filter(Boolean).join("; ");

    return [
      "img",
      mergeAttributes(
        attrs,
        width ? { width } : {},
        height ? { height } : {},
        { style: styles }
      )
    ];
  }
});

const DetailsSummaryNode = Node.create({
  name: "detailsSummary",
  content: "inline*",
  defining: true,
  parseHTML: () => [{ tag: "summary" }],
  renderHTML: ({ HTMLAttributes }) => ["summary", mergeAttributes(HTMLAttributes), 0]
});

const DetailsContentNode = Node.create({
  name: "detailsContent",
  content: "block+",
  defining: true,
  parseHTML: () => [{ tag: "div[data-details-content]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-details-content": "" }),
    0
  ]
});

const TrailingParagraph = Extension.create({
  name: "trailingParagraph",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }

          const last = newState.doc.lastChild;
          if (!last || !trailingNodeNames.has(last.type.name)) {
            return null;
          }

          const paragraph = newState.schema.nodes.paragraph.create();
          return newState.tr.insert(newState.doc.content.size, paragraph);
        }
      })
    ];
  }
});

export function createEditorExtensions(placeholder: string): AnyExtension[] {
  const extensions: Array<AnyExtension | null | undefined> = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] }
    }),
    TextStyle,
    FontSize,
    Color,
    FontFamily,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph", "tableCell", "tableHeader"] }),
    Link.configure({ openOnClick: false }),
    ResizableImage.configure({ allowBase64: true }),
    TableRowNode,
    TableHeaderNode,
    TableCellNode,
    TableNode,
    DetailsNode,
    DetailsSummaryNode,
    DetailsContentNode,
    TrailingParagraph,
    Placeholder.configure({ placeholder })
  ];

  return extensions.filter((extension, index): extension is AnyExtension => {
    const name = (extension as { name?: unknown } | null | undefined)?.name;
    if (typeof name === "string" && name.length > 0) {
      return true;
    }

    console.error("[block-editor] invalid Tiptap extension skipped", {
      index,
      valueType: typeof extension,
      value: extension
    });
    return false;
  });
}
