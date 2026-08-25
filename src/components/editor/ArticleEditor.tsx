"use client";

import { memo, useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

import { getApiErrorMessage, unwrapApiData } from "../apiResponse";
import { MARKDOWN_ALLOWED_HTML_TAGS, MarkdownContent } from "../markdown";
import { classNames } from "../ui/classNames";

export interface ArticleEditorProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  minRows?: number;
  imageUploadEndpoint?: string;
}

type EditorView = "write" | "split" | "preview";
const PREVIEW_DELAY_MS = 300;
const MAX_EDITOR_IMAGE_BYTES = 8 * 1024 * 1024;
const EDITOR_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const tokenPattern = /(!\[[^\]\n]*\]\(https?:\/\/[^\s)]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${tokenIndex}`;

    if (token.startsWith("![")) {
      const image = token.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
      nodes.push(image ? <img key={key} src={image[2]} alt={image[1]} loading="lazy" /> : token);
    } else if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (link) {
        nodes.push(
          <a key={key} href={link[2]} target="_blank" rel="noreferrer noopener">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    cursor = match.index + token.length;
    tokenIndex += 1;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function renderLines(lines: string[], keyPrefix: string) {
  return lines.flatMap((line, index) => [
    ...(index > 0 ? [<br key={`${keyPrefix}-break-${index}`} />] : []),
    ...renderInline(line, `${keyPrefix}-line-${index}`),
  ]);
}

const MarkdownPreview = memo(function MarkdownPreview({ markdown }: { markdown: string }) {
  if (markdown.includes("<")) return <MarkdownContent>{markdown}</MarkdownContent>;

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={`code-${index}`} data-language={language || undefined}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const content = renderInline(heading[2], `heading-${index}`);
      if (level === 1) blocks.push(<h1 key={`heading-${index}`}>{content}</h1>);
      else if (level === 2) blocks.push(<h2 key={`heading-${index}`}>{content}</h2>);
      else if (level === 3) blocks.push(<h3 key={`heading-${index}`}>{content}</h3>);
      else if (level === 4) blocks.push(<h4 key={`heading-${index}`}>{content}</h4>);
      else if (level === 5) blocks.push(<h5 key={`heading-${index}`}>{content}</h5>);
      else blocks.push(<h6 key={`heading-${index}`}>{content}</h6>);
      index += 1;
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`list-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{renderInline(item, `list-${index}-${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`ordered-list-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{renderInline(item, `ordered-${index}-${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${index}`}>{renderLines(quote, `quote-${index}`)}</blockquote>,
      );
      continue;
    }

    if (/^\s*((-{3,})|(\*{3,})|(_{3,}))\s*$/.test(line)) {
      blocks.push(<hr key={`rule-${index}`} />);
      index += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !/^>\s?/.test(lines[index]) &&
      !lines[index].trim().startsWith("```")
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{renderLines(paragraph, `paragraph-${index}`)}</p>);
  }

  return <>{blocks}</>;
});

export function ArticleEditor({
  value,
  onChange,
  id,
  name = "body",
  label = "本文",
  hint = "Markdownと安全なHTMLタグを利用できます。記法や利用できるタグについて、詳しくはヘルプをご覧ください。",
  error,
  disabled = false,
  minRows = 20,
  imageUploadEndpoint = "/api/images",
}: ArticleEditorProps) {
  const generatedId = useId();
  const editorId = id ?? generatedId;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const helpCloseButtonRef = useRef<HTMLButtonElement>(null);
  const scrollSyncFrameRef = useRef<number | null>(null);
  const syncingScrollRef = useRef(false);
  const lastScrollSourceRef = useRef<"input" | "preview">("input");
  const [view, setView] = useState<EditorView>("write");
  const [previewValue, setPreviewValue] = useState(value);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const errorId = error ? `${editorId}-error` : undefined;
  const hintId = `${editorId}-hint`;

  useEffect(() => {
    if (view === "write" || previewValue === value) return;
    const timer = window.setTimeout(() => setPreviewValue(value), PREVIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [previewValue, value, view]);

  useEffect(() => () => {
    if (scrollSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollSyncFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (!helpOpen) return;
    helpCloseButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHelpOpen(false);
        window.requestAnimationFrame(() => helpButtonRef.current?.focus());
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [helpOpen]);

  function closeHelp() {
    setHelpOpen(false);
    window.requestAnimationFrame(() => helpButtonRef.current?.focus());
  }

  function syncSplitScroll(
    source: HTMLElement,
    target: HTMLElement | null,
    sourceName: "input" | "preview",
  ) {
    if (view !== "split" || !target || syncingScrollRef.current) return;
    lastScrollSourceRef.current = sourceName;
    const sourceRange = source.scrollHeight - source.clientHeight;
    const targetRange = target.scrollHeight - target.clientHeight;
    const progress = sourceRange > 0 ? source.scrollTop / sourceRange : 0;

    syncingScrollRef.current = true;
    target.scrollTop = Math.max(0, targetRange) * progress;
    scrollSyncFrameRef.current = window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
      scrollSyncFrameRef.current = null;
    });
  }

  function resyncAfterPreviewResize() {
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview) return;
    if (lastScrollSourceRef.current === "preview") {
      syncSplitScroll(preview, textarea, "preview");
    } else {
      syncSplitScroll(textarea, preview, "input");
    }
  }

  function selectView(nextView: EditorView) {
    setView(nextView);
    if (nextView !== "write") setPreviewValue(value);
  }

  function insert(before: string, after = before, placeholder = "テキスト") {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const nextValue = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  async function uploadArticleImage(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0 || disabled) return;
    setImageError(null);
    if (files.some((file) => !EDITOR_IMAGE_TYPES.has(file.type))) {
      setImageError("JPEG、PNG、WebP形式の画像を選んでください。");
      return;
    }
    if (files.some((file) => file.size > MAX_EDITOR_IMAGE_BYTES)) {
      setImageError("画像サイズは8MB以下にしてください。");
      return;
    }

    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    setUploadingImage(true);
    try {
      const uploadedImages: Array<{ file: File; url: string }> = [];
      for (const file of files) {
        const form = new FormData();
        form.append("image", file);
        const response = await fetch(imageUploadEndpoint, {
          method: "POST",
          body: form,
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response, "画像をアップロードできませんでした。"));
        }
        const payload: unknown = await response.json();
        const uploaded = unwrapApiData<{ id: string; url: string }>(payload);
        if (!uploaded?.url) throw new Error("アップロードした画像URLを取得できませんでした。");
        uploadedImages.push({ file, url: uploaded.url });
      }

      const before = start > 0 && value[start - 1] !== "\n" ? "\n\n" : "";
      const after = end < value.length && value[end] !== "\n" ? "\n\n" : "\n";
      const imagesMarkdown = uploadedImages
        .map(({ file, url }) => `![${file.name}](${url})`)
        .join("\n\n");
      const markdown = `${before}${imagesMarkdown}${after}`;
      onChange(`${value.slice(0, start)}${markdown}${value.slice(end)}`);
      requestAnimationFrame(() => {
        textarea?.focus();
        const cursor = start + markdown.length;
        textarea?.setSelectionRange(cursor, cursor);
      });
    } catch (caught) {
      setImageError(caught instanceof Error ? caught.message : "画像をアップロードできませんでした。");
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <div className={classNames("article-editor", error && "article-editor--error")}>
      <div className="article-editor__header">
        <div>
          <label className="field__label" htmlFor={editorId}>{label}</label>
          <p className="field__hint" id={hintId}>{hint}</p>
        </div>
        <div className="article-editor__views" role="group" aria-label="エディター表示">
          {(["write", "split", "preview"] as EditorView[]).map((option) => (
            <button
              key={option}
              type="button"
              className={view === option ? "is-active" : undefined}
              aria-pressed={view === option}
              onClick={() => selectView(option)}
            >
              {option === "write" ? "入力" : option === "split" ? "分割" : "プレビュー"}
            </button>
          ))}
        </div>
      </div>

      <div className="article-editor__toolbar" role="toolbar" aria-label="Markdown書式">
        <button type="button" title="見出し2" disabled={disabled} onClick={() => insert("## ", "", "見出し")}>H2</button>
        <button type="button" title="太字" disabled={disabled} onClick={() => insert("**", "**")}>太字</button>
        <button type="button" title="引用" disabled={disabled} onClick={() => insert("> ", "", "引用")}>引用</button>
        <button type="button" title="箇条書き" disabled={disabled} onClick={() => insert("- ", "", "項目")}>箇条書き</button>
        <button type="button" title="リンク" disabled={disabled} onClick={() => insert("[", "](https://)", "リンク名")}>リンク</button>
        <button type="button" title="インラインコード" disabled={disabled} onClick={() => insert("`", "`", "code")}>コード</button>
        <button
          type="button"
          title="本文へ画像を追加"
          disabled={disabled || uploadingImage}
          onClick={() => imageInputRef.current?.click()}
        >
          {uploadingImage ? "画像を処理中…" : "画像"}
        </button>
        <input
          ref={imageInputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          tabIndex={-1}
          onChange={uploadArticleImage}
        />
        <button
          ref={helpButtonRef}
          type="button"
          className="article-editor__help-button"
          aria-haspopup="dialog"
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen(true)}
        >
          <span aria-hidden="true">?</span>
          ヘルプ
        </button>
      </div>

      <div className={classNames("article-editor__panels", `article-editor__panels--${view}`)}>
        {view !== "preview" ? (
          <div className="article-editor__input-panel">
            <textarea
              ref={textareaRef}
              id={editorId}
              name={name}
              value={value}
              rows={minRows}
              disabled={disabled}
              aria-describedby={[hintId, errorId].filter(Boolean).join(" ")}
              aria-invalid={Boolean(error)}
              spellCheck
              onChange={(event) => onChange(event.target.value)}
              onScroll={(event) => syncSplitScroll(event.currentTarget, previewRef.current, "input")}
            />
          </div>
        ) : null}
        {view !== "write" ? (
          <div
            ref={previewRef}
            className="article-editor__preview"
            aria-label="本文プレビュー"
            tabIndex={0}
            onLoadCapture={resyncAfterPreviewResize}
            onScroll={(event) => syncSplitScroll(event.currentTarget, textareaRef.current, "preview")}
          >
            {previewValue.trim() ? (
              <MarkdownPreview markdown={previewValue} />
            ) : (
              <p className="article-editor__placeholder">本文を入力すると、ここにプレビューが表示されます。</p>
            )}
          </div>
        ) : null}
      </div>
      {imageError ? <p className="field__error article-editor__image-error" role="alert">{imageError}</p> : null}
      {error ? <p className="field__error" id={errorId} role="alert">{error}</p> : null}
      {helpOpen ? (
        <div
          className="article-editor-help__backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeHelp();
          }}
        >
          <section
            className="article-editor-help"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${editorId}-help-title`}
          >
            <header className="article-editor-help__header">
              <div>
                <p className="eyebrow">EDITOR HELP</p>
                <h2 id={`${editorId}-help-title`}>Markdown・HTMLヘルプ</h2>
              </div>
              <button ref={helpCloseButtonRef} type="button" aria-label="ヘルプを閉じる" onClick={closeHelp}>×</button>
            </header>
            <div className="article-editor-help__body">
              <section>
                <h3>Markdown記法</h3>
                <div className="article-editor-help__table-wrap">
                  <table>
                    <thead><tr><th>用途</th><th>入力例</th></tr></thead>
                    <tbody>
                      <tr><td>見出し</td><td><code>## 見出し</code></td></tr>
                      <tr><td>太字・斜体</td><td><code>**太字**</code> / <code>*斜体*</code></td></tr>
                      <tr><td>引用</td><td><code>&gt; 引用文</code></td></tr>
                      <tr><td>箇条書き</td><td><code>- 項目</code></td></tr>
                      <tr><td>番号付きリスト</td><td><code>1. 項目</code></td></tr>
                      <tr><td>リンク</td><td><code>[表示名](https://example.com)</code></td></tr>
                      <tr><td>画像</td><td><code>![代替テキスト](画像URL)</code></td></tr>
                      <tr><td>コード</td><td><code>`code`</code> / <code>```複数行```</code></td></tr>
                      <tr><td>区切り線</td><td><code>---</code></td></tr>
                      <tr><td>チェックリスト</td><td><code>- [ ] 未完了</code> / <code>- [x] 完了</code></td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
              <section>
                <h3>利用できるHTMLタグ</h3>
                <p>安全性を確認した以下のタグを利用できます。</p>
                <div className="article-editor-help__tags">
                  {MARKDOWN_ALLOWED_HTML_TAGS.map((tag) => <code key={tag}>&lt;{tag}&gt;</code>)}
                </div>
              </section>
              <section>
                <h3>画像の横並び</h3>
                <pre><code>{'<div class="image-gallery">\n  <img src="画像URL" alt="説明">\n  <img src="画像URL" alt="説明">\n</div>'}</code></pre>
                <p><code>div</code>の<code>class=&quot;image-gallery&quot;</code>のみ、ギャラリー表示用として許可されています。</p>
              </section>
              <aside className="article-editor-help__notice">
                <strong>安全性について</strong>
                <p><code>script</code>、<code>style</code>、<code>onclick</code>などのイベント属性は保存・表示時に除去されます。リンクや画像URLは安全なプロトコルだけが許可されます。</p>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
