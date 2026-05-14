import type { Editor } from "@tiptap/react";
import type { BlockCommand, EditorTexts } from "./editor-types";

export type EditorNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: EditorNode[];
  text?: string;
  [key: string]: unknown;
};

export function detailsContent(texts: EditorTexts): EditorNode {
  return {
    type: "details",
    attrs: { open: true },
    content: [
      {
        type: "detailsSummary",
        content: [{ type: "text", text: texts.details }]
      },
      {
        type: "detailsContent",
        content: [{ type: "paragraph", content: [] }]
      }
    ]
  };
}

export function createBlockCommands(texts: EditorTexts, openImagePicker: () => void): BlockCommand[] {
  return [
    {
      key: "paragraph",
      label: texts.paragraph,
      description: texts.bodyPlaceholder,
      keywords: ["text", "paragraph", "wenben", "duanluo", "文本", "段落"],
      run: (editor) => editor.chain().focus().setParagraph().run()
    },
    {
      key: "heading1",
      label: texts.heading1,
      description: "H1",
      keywords: ["h1", "heading", "title", "yiji", "一级", "标题"],
      run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run()
    },
    {
      key: "heading2",
      label: texts.heading2,
      description: "H2",
      keywords: ["h2", "heading", "erji", "二级", "标题"],
      run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run()
    },
    {
      key: "heading3",
      label: texts.heading3,
      description: "H3",
      keywords: ["h3", "heading", "sanji", "三级", "标题"],
      run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run()
    },
    {
      key: "heading4",
      label: texts.heading4,
      description: "H4",
      keywords: ["h4", "heading", "siji", "四级", "标题"],
      run: (editor) => editor.chain().focus().toggleHeading({ level: 4 }).run()
    },
    {
      key: "quote",
      label: texts.quote,
      description: texts.quote,
      keywords: ["quote", "blockquote", "yinyong", "引用"],
      run: (editor) => editor.chain().focus().toggleBlockquote().run()
    },
    {
      key: "bulletList",
      label: texts.bulletList,
      description: texts.bulletList,
      keywords: ["bullet", "list", "ul", "wuxu", "列表", "无序"],
      run: (editor) => editor.chain().focus().toggleBulletList().run()
    },
    {
      key: "orderedList",
      label: texts.orderedList,
      description: texts.orderedList,
      keywords: ["ordered", "number", "ol", "youxu", "列表", "有序"],
      run: (editor) => editor.chain().focus().toggleOrderedList().run()
    },
    {
      key: "taskList",
      label: texts.taskList,
      description: texts.taskList,
      keywords: ["task", "todo", "renwu", "任务"],
      run: (editor) => editor.chain().focus().toggleBulletList().run()
    },
    {
      key: "image",
      label: texts.image,
      description: texts.uploadImage,
      keywords: ["image", "picture", "photo", "tupian", "图片"],
      run: () => openImagePicker()
    },
    {
      key: "divider",
      label: texts.divider,
      description: texts.divider,
      keywords: ["divider", "hr", "line", "fengexian", "分割线"],
      run: (editor) => editor.chain().focus().setHorizontalRule().run()
    },
    {
      key: "codeBlock",
      label: texts.codeBlock,
      description: texts.codeBlock,
      keywords: ["code", "pre", "daima", "代码"],
      run: (editor) => editor.chain().focus().toggleCodeBlock().run()
    },
    {
      key: "table",
      label: texts.table,
      description: "3 × 3",
      keywords: ["table", "biaoge", "表格"],
      run: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run()
    },
    {
      key: "details",
      label: texts.details,
      description: texts.details,
      keywords: ["toggle", "details", "fold", "zhedie", "折叠"],
      run: (editor) => editor.chain().focus().insertContent(detailsContent(texts)).run()
    }
  ];
}

export function runCommandAfterDeletingRange(
  editor: Editor,
  command: BlockCommand,
  range: { from: number; to: number } | null
) {
  const chain = editor.chain().focus();
  if (range) {
    chain.deleteRange(range);
  }
  chain.run();
  command.run(editor);
}

export function safeJsonString(value: unknown) {
  try {
    return JSON.stringify(value ?? { type: "doc", content: [] });
  } catch {
    return JSON.stringify({ type: "doc", content: [] });
  }
}
