import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { CellSelection, TableMap, findTable, selectionCell } from "@tiptap/pm/tables";

const trailingNodeNames = new Set(["table", "codeBlock", "details"]);
const selectableBlockNames = new Set(["table", "codeBlock", "details"]);

type TableContext = {
  tableStart: number;
  tablePos: number;
  tableNode: Parameters<typeof TableMap.get>[0];
  map: TableMap;
  cellRect: ReturnType<TableMap["findCell"]>;
};

function getTableContext(editor: Editor): TableContext | null {
  try {
    const $cell = selectionCell(editor.state);
    const table = findTable($cell);
    if (!table) {
      return null;
    }

    const map = TableMap.get(table.node);
    return {
      tableStart: table.start,
      tablePos: table.pos,
      tableNode: table.node,
      map,
      cellRect: map.findCell($cell.pos - table.start)
    };
  } catch {
    return null;
  }
}

export function ensureTrailingParagraph(editor: Editor) {
  const last = editor.state.doc.lastChild;
  if (!last || !trailingNodeNames.has(last.type.name)) {
    return false;
  }

  const paragraph = editor.state.schema.nodes.paragraph?.create();
  if (!paragraph) {
    return false;
  }

  editor.view.dispatch(editor.state.tr.insert(editor.state.doc.content.size, paragraph));
  return true;
}

function ensureWritableTail(editor: Editor) {
  const paragraph = editor.state.schema.nodes.paragraph?.create();
  if (!paragraph) {
    return false;
  }

  if (!editor.state.doc.childCount) {
    editor.view.dispatch(editor.state.tr.insert(0, paragraph));
    return true;
  }

  return ensureTrailingParagraph(editor);
}

export function focusEditorAtEnd(editor: Editor) {
  ensureTrailingParagraph(editor);
  editor.commands.focus("end");
}

export function selectCurrentTableRow(editor: Editor) {
  const context = getTableContext(editor);
  if (!context) {
    return false;
  }

  const anchorCell = context.tableStart + context.map.positionAt(context.cellRect.top, 0, context.tableNode);
  const headCell =
    context.tableStart + context.map.positionAt(context.cellRect.top, context.map.width - 1, context.tableNode);
  return editor.chain().focus().setCellSelection({ anchorCell, headCell }).run();
}

export function selectCurrentTableColumn(editor: Editor) {
  const context = getTableContext(editor);
  if (!context) {
    return false;
  }

  const anchorCell = context.tableStart + context.map.positionAt(0, context.cellRect.left, context.tableNode);
  const headCell =
    context.tableStart + context.map.positionAt(context.map.height - 1, context.cellRect.left, context.tableNode);
  return editor.chain().focus().setCellSelection({ anchorCell, headCell }).run();
}

export function selectCurrentTable(editor: Editor) {
  const context = getTableContext(editor);
  if (!context) {
    return false;
  }

  const anchorCell = context.tableStart + context.map.positionAt(0, 0, context.tableNode);
  const headCell =
    context.tableStart + context.map.positionAt(context.map.height - 1, context.map.width - 1, context.tableNode);
  return editor.chain().focus().setCellSelection({ anchorCell, headCell }).run();
}

export function clearSelectedTableCells(editor: Editor) {
  const { state } = editor;
  if (!(state.selection instanceof CellSelection)) {
    return false;
  }

  const paragraph = state.schema.nodes.paragraph?.create();
  if (!paragraph) {
    return false;
  }

  const cells: Array<{ pos: number; size: number }> = [];
  state.selection.forEachCell((cell, pos) => {
    cells.push({ pos, size: cell.nodeSize });
  });

  cells.sort((a, b) => b.pos - a.pos);
  let tr = state.tr;
  for (const cell of cells) {
    tr = tr.replaceWith(cell.pos + 1, cell.pos + cell.size - 1, paragraph);
  }

  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

type ActiveBlock = {
  pos: number;
  node: ProseMirrorNode;
};

export function findActiveBlock(editor: Editor): ActiveBlock | null {
  const { selection } = editor.state;

  if (selection instanceof NodeSelection && selectableBlockNames.has(selection.node.type.name)) {
    return { pos: selection.from, node: selection.node };
  }

  const table = getTableContext(editor);
  if (table) {
    return { pos: table.tablePos, node: table.tableNode };
  }

  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (selectableBlockNames.has(node.type.name)) {
      return { pos: $from.before(depth), node };
    }
  }

  return null;
}

function selectNodeAt(editor: Editor, pos: number) {
  const selection = NodeSelection.create(editor.state.doc, Math.max(0, pos));
  editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
  editor.commands.focus();
  return true;
}

function deleteBlockAt(editor: Editor, pos: number, node: ProseMirrorNode) {
  const { state, view } = editor;
  let tr = state.tr.delete(pos, pos + node.nodeSize);
  const paragraph = state.schema.nodes.paragraph?.create();

  if (!tr.doc.childCount && paragraph) {
    tr = tr.insert(0, paragraph);
  }

  const safePos = Math.max(0, Math.min(pos, tr.doc.content.size));
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(safePos), -1)).scrollIntoView();
  view.dispatch(tr);
  ensureWritableTail(editor);
  editor.commands.focus();
  return true;
}

function selectAdjacentBlock(editor: Editor, event: KeyboardEvent) {
  const { selection } = editor.state;
  if (!selection.empty) {
    return false;
  }

  const { $from } = selection;

  if ($from.parent.type.name === "codeBlock") {
    const atStart = $from.parentOffset === 0;
    const atEnd = $from.parentOffset === $from.parent.content.size;
    if ((event.key === "Backspace" && atStart) || (event.key === "Delete" && atEnd)) {
      event.preventDefault();
      return selectNodeAt(editor, $from.before($from.depth));
    }
  }

  if ($from.parent.type.name !== "paragraph" || $from.parent.content.size !== 0) {
    return false;
  }

  const paragraphPos = $from.before($from.depth);
  const parent = $from.node($from.depth - 1);
  const index = $from.index($from.depth - 1);

  if (event.key === "Backspace" && $from.parentOffset === 0 && index > 0) {
    const previous = parent.child(index - 1);
    if (selectableBlockNames.has(previous.type.name)) {
      event.preventDefault();
      return selectNodeAt(editor, paragraphPos - previous.nodeSize);
    }
  }

  if (event.key === "Delete" && $from.parentOffset === 0 && index < parent.childCount - 1) {
    const current = parent.child(index);
    const next = parent.child(index + 1);
    if (selectableBlockNames.has(next.type.name)) {
      event.preventDefault();
      return selectNodeAt(editor, paragraphPos + current.nodeSize);
    }
  }

  return false;
}

export function guardBlockBoundaryEditing(editor: Editor, event: KeyboardEvent) {
  if (event.key !== "Backspace" && event.key !== "Delete") {
    return false;
  }

  const { selection } = editor.state;
  if (selection instanceof CellSelection) {
    event.preventDefault();
    return clearSelectedTableCells(editor);
  }

  if (selection instanceof NodeSelection && selectableBlockNames.has(selection.node.type.name)) {
    event.preventDefault();
    return deleteBlockAt(editor, selection.from, selection.node);
  }

  if (
    selection instanceof NodeSelection &&
    (selection.node.type.name === "tableCell" || selection.node.type.name === "tableHeader")
  ) {
    const paragraph = editor.state.schema.nodes.paragraph?.create();
    if (!paragraph) {
      event.preventDefault();
      return true;
    }
    event.preventDefault();
    editor.view.dispatch(
      editor.state.tr
        .replaceWith(selection.from + 1, selection.from + selection.node.nodeSize - 1, paragraph)
        .scrollIntoView()
    );
    return true;
  }

  if (selectAdjacentBlock(editor, event)) {
    return true;
  }

  if (selection.empty && getTableContext(editor)) {
    const parent = selection.$from.parent;
    const isEmptyCellParagraph = parent.type.name === "paragraph" && parent.content.size === 0;
    const atParagraphEdge =
      event.key === "Backspace" ? selection.$from.parentOffset === 0 : selection.$from.parentOffset === parent.content.size;

    if (isEmptyCellParagraph && atParagraphEdge) {
      event.preventDefault();
      return true;
    }
  }

  return false;
}

export const guardTableDeletion = guardBlockBoundaryEditing;

export function deleteCurrentTable(editor: Editor) {
  const deleted = editor.chain().focus().deleteTable().run();
  if (deleted) {
    ensureTrailingParagraph(editor);
    editor.commands.focus("end");
  }
  return deleted;
}

export function deleteActiveBlock(editor: Editor) {
  const block = findActiveBlock(editor);
  if (!block) {
    return false;
  }

  return deleteBlockAt(editor, block.pos, block.node);
}

export function moveActiveBlock(editor: Editor, direction: "up" | "down") {
  const block = findActiveBlock(editor);
  if (!block) {
    return false;
  }

  const { state, view } = editor;
  const $pos = state.doc.resolve(block.pos);
  const parent = $pos.parent;
  const index = $pos.index();
  const from = block.pos;
  const to = block.pos + block.node.nodeSize;
  let insertPos: number | null = null;

  if (direction === "up") {
    if (index <= 0) {
      return false;
    }
    const previous = parent.child(index - 1);
    insertPos = from - previous.nodeSize;
  } else {
    if (index >= parent.childCount - 1) {
      return false;
    }
    const next = parent.child(index + 1);
    insertPos = from + next.nodeSize;
  }

  const movedNode = block.node.copy(block.node.content);
  let tr = state.tr.delete(from, to);
  if (insertPos === null) {
    return false;
  }
  const mappedInsertPos = insertPos;
  tr = tr.insert(mappedInsertPos, movedNode);
  tr = tr.setSelection(NodeSelection.create(tr.doc, mappedInsertPos)).scrollIntoView();
  view.dispatch(tr);
  ensureWritableTail(editor);
  editor.commands.focus();
  return true;
}

export function placeCursorFromPaperClick(editor: Editor, x: number, y: number) {
  const coords = editor.view.posAtCoords({ left: x, top: y });
  if (coords) {
    const selection = TextSelection.create(editor.state.doc, coords.pos);
    editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
    editor.commands.focus();
    return true;
  }

  focusEditorAtEnd(editor);
  return true;
}
