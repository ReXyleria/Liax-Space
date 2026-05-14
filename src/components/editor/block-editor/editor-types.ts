import type { Editor } from "@tiptap/react";

export type BlockEditorLocale = "zh-CN" | "en";

export type BlockCommandKey =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "quote"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "image"
  | "divider"
  | "codeBlock"
  | "table"
  | "details";

export type BlockCommand = {
  key: BlockCommandKey;
  label: string;
  description: string;
  keywords: string[];
  run: (editor: Editor) => void;
};

export type SlashMenuState = {
  open: boolean;
  x: number;
  y: number;
  query: string;
  selected: number;
  range: { from: number; to: number } | null;
  placement: "top" | "bottom";
};

export type EditorTocItem = {
  id: string;
  title: string;
  level: 1 | 2 | 3 | 4;
  pos: number;
};

export type EditorTexts = {
  titlePlaceholder: string;
  bodyPlaceholder: string;
  paragraph: string;
  heading1: string;
  heading2: string;
  heading3: string;
  heading4: string;
  quote: string;
  bulletList: string;
  orderedList: string;
  taskList: string;
  codeBlock: string;
  table: string;
  image: string;
  divider: string;
  details: string;
  bold: string;
  italic: string;
  strike: string;
  inlineCode: string;
  link: string;
  unlink: string;
  clearFormat: string;
  textColor: string;
  backgroundColor: string;
  uploadImage: string;
  uploadFailed: string;
  uploadDone: string;
  noHeadings: string;
  saving: string;
  saved: string;
  unsaved: string;
  slashHint: string;
  insertBlock: string;
  searchBlocks: string;
  addRow: string;
  deleteRow: string;
  addColumn: string;
  deleteColumn: string;
  widerColumn: string;
  narrowerColumn: string;
  cellBackground: string;
  copy: string;
  copied: string;
  removeImage: string;
  replaceImage: string;
  resetImage: string;
  tableTextColor: string;
  tableBorderColor: string;
  tableBorderWidth: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  alignTop: string;
  alignMiddle: string;
  alignBottom: string;
  rowShorter: string;
  rowTaller: string;
  undo: string;
  redo: string;
  selectTable: string;
  selectRow: string;
  selectColumn: string;
  headerRow: string;
  headerColumn: string;
  mergeCells: string;
  splitCell: string;
  deleteTable: string;
  linkPlaceholder: string;
  apply: string;
};
