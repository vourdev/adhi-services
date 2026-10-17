"use client";

import { Placeholder } from "@tiptap/extensions";
import {
  type Editor,
  EditorContent,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isRichText, plainTextToHtml, richTextToPlain } from "@/lib/rich-text";
import { cn } from "cn";

const MAX_TEXT = 5000;

function ToolbarButton({
  icon: IconComponent,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keeps the selection in the editor while the button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-7.5 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-muted text-foreground"
      )}
    >
      <IconComponent className="size-4" />
    </button>
  );
}

function Separator(): ReactNode {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}

function Toolbar({
  editor,
  onLink,
}: {
  editor: Editor;
  onLink: () => void;
}): ReactNode {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      paragraph: current.isActive("paragraph"),
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      quote: current.isActive("blockquote"),
      link: current.isActive("link"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="Format deskripsi"
      className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1"
    >
      <ToolbarButton
        icon={Pilcrow}
        label="Teks biasa"
        active={state.paragraph}
        onClick={() => chain().setParagraph().run()}
      />
      <ToolbarButton
        icon={Heading2}
        label="Judul"
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        icon={Heading3}
        label="Subjudul"
        active={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      />
      <Separator />
      <ToolbarButton
        icon={Bold}
        label="Tebal (Ctrl+B)"
        active={state.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolbarButton
        icon={Italic}
        label="Miring (Ctrl+I)"
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolbarButton
        icon={Underline}
        label="Garis bawah (Ctrl+U)"
        active={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      />
      <ToolbarButton
        icon={Strikethrough}
        label="Coret"
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      <Separator />
      <ToolbarButton
        icon={List}
        label="Daftar poin"
        active={state.bullet}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrdered}
        label="Daftar bernomor"
        active={state.ordered}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={Quote}
        label="Kutipan"
        active={state.quote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolbarButton
        icon={Minus}
        label="Garis pemisah"
        onClick={() => chain().setHorizontalRule().run()}
      />
      <ToolbarButton
        icon={Link2}
        label="Link"
        active={state.link}
        onClick={onLink}
      />
      <Separator />
      <ToolbarButton
        icon={Undo2}
        label="Batalkan (Ctrl+Z)"
        disabled={!state.canUndo}
        onClick={() => chain().undo().run()}
      />
      <ToolbarButton
        icon={Redo2}
        label="Ulangi (Ctrl+Shift+Z)"
        disabled={!state.canRedo}
        onClick={() => chain().redo().run()}
      />
    </div>
  );
}

/**
 * The product description editor. Works on HTML (sanitized again on the
 * server when saved); an older plain-text description opens as paragraphs
 * and lists. Only formatting the public page can show is offered.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  onBlur,
  invalid = false,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  placeholder?: string;
}): ReactNode {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [length, setLength] = useState(() => richTextToPlain(value).length);

  const editor = useEditor({
    // Rendered in the browser only; the server has no DOM for the editor.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["https", "http", "mailto"],
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value && !isRichText(value) ? plainTextToHtml(value) : value,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-invalid": String(invalid),
        class:
          "rich-text min-h-48 px-3.5 py-3 text-[15px] outline-none [&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-muted-foreground [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(current.isEmpty ? "" : current.getHTML());
      setLength(current.getText().length);
    },
    onBlur: () => onBlur?.(),
  });

  function openLink() {
    if (!editor) return;
    setLinkUrl(editor.getAttributes("link").href ?? "");
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({
          href: /^(https?:\/\/|mailto:)/i.test(url) ? url : `https://${url}`,
        })
        .run();
    setLinkOpen(false);
  }

  function onLinkKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      applyLink();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setLinkOpen(false);
      editor?.commands.focus();
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        invalid && "border-destructive ring-destructive/20"
      )}
    >
      {editor ? (
        <Toolbar editor={editor} onLink={openLink} />
      ) : (
        <div className="h-[41px] border-b" />
      )}
      {linkOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-2 py-2">
          <Input
            autoFocus
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={onLinkKey}
            placeholder="https://contoh.com"
            aria-label="Alamat link"
            className="h-8 min-w-0 flex-1"
          />
          <Button type="button" size="sm" onClick={applyLink}>
            {linkUrl.trim() ? "Pasang" : "Hapus link"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setLinkOpen(false)}
          >
            Batal
          </Button>
        </div>
      ) : null}
      <EditorContent editor={editor} />
      <div
        className={cn(
          "border-t px-3.5 py-1.5 text-right text-xs text-muted-foreground tabular-nums",
          length > MAX_TEXT && "text-destructive"
        )}
      >
        {length.toLocaleString("id-ID")} / {MAX_TEXT.toLocaleString("id-ID")}{" "}
        karakter
      </div>
    </div>
  );
}
