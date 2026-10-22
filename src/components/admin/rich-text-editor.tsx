"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Undo,
  Redo,
  RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Minimal mode: only bold, italic, underline, link (for short text like quotes) */
  minimal?: boolean;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors",
        active
          ? "bg-brand-orange/20 text-brand-orange"
          : "text-brand-cream/60 hover:text-brand-cream hover:bg-brand-cream/10",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-brand-cream/10 mx-1" />;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  className,
  minimal = false,
}: RichTextEditorProps) {
  const isInternalUpdate = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: minimal ? false : { levels: [1, 2, 3] },
        bulletList: minimal ? false : undefined,
        orderedList: minimal ? false : undefined,
        blockquote: minimal ? false : undefined,
        horizontalRule: false,
        codeBlock: false,
        code: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-brand-orange underline hover:text-brand-gold transition-colors",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value || "",
    // The page is rendered on the server first. Waiting until the browser to build the
    // editor keeps the server and browser HTML identical (Tiptap's advice for Next.js).
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[120px] px-3 py-2",
          "prose-headings:text-brand-cream prose-headings:font-display",
          "prose-p:text-brand-cream/80 prose-p:leading-relaxed",
          "prose-strong:text-brand-cream prose-em:text-brand-cream/80",
          "prose-ul:text-brand-cream/80 prose-ol:text-brand-cream/80",
          "prose-blockquote:border-brand-orange/40 prose-blockquote:text-brand-cream/70",
          "prose-a:text-brand-orange prose-a:no-underline hover:prose-a:text-brand-gold",
          minimal && "min-h-[80px]"
        ),
      },
    },
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true;
      const html = editor.getHTML();
      // If editor is empty, return empty string instead of "<p></p>"
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  // Sync external value changes (e.g., form reset)
  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const currentHTML = editor.getHTML();
    if (value !== currentHTML && !(value === "" && currentHTML === "<p></p>")) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) return null;

  const iconSize = 16;

  return (
    <div
      className={cn(
        "border border-brand-cream/10 rounded-lg overflow-hidden bg-card",
        "focus-within:border-brand-orange/40 transition-colors",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-brand-cream/10 bg-brand-cream/5">
        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough size={iconSize} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Links */}
        <ToolbarButton
          onClick={setLink}
          active={editor.isActive("link")}
          title="Add link"
        >
          <LinkIcon size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive("link")}
          title="Remove link"
        >
          <Unlink size={iconSize} />
        </ToolbarButton>

        {!minimal && (
          <>
            <ToolbarDivider />

            {/* Headings */}
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              active={editor.isActive("heading", { level: 1 })}
              title="Heading 1"
            >
              <Heading1 size={iconSize} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              active={editor.isActive("heading", { level: 2 })}
              title="Heading 2"
            >
              <Heading2 size={iconSize} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
              active={editor.isActive("heading", { level: 3 })}
              title="Heading 3"
            >
              <Heading3 size={iconSize} />
            </ToolbarButton>

            <ToolbarDivider />

            {/* Lists */}
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleBulletList().run()
              }
              active={editor.isActive("bulletList")}
              title="Bullet list"
            >
              <List size={iconSize} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleOrderedList().run()
              }
              active={editor.isActive("orderedList")}
              title="Numbered list"
            >
              <ListOrdered size={iconSize} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleBlockquote().run()
              }
              active={editor.isActive("blockquote")}
              title="Blockquote"
            >
              <Quote size={iconSize} />
            </ToolbarButton>
          </>
        )}

        <ToolbarDivider />

        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo size={iconSize} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Clear formatting */}
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().clearNodes().unsetAllMarks().run()
          }
          title="Clear formatting"
        >
          <RemoveFormatting size={iconSize} />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}
