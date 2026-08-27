"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorMessage } from "@/components/apiResponse";
import { ArticleEditor } from "@/components/editor";
import { Alert, Button } from "@/components/ui";
import type { WorldsContent } from "@/lib/worlds";

export function WorldsEditorForm({ initialContent }: { initialContent: WorldsContent }) {
  const router = useRouter();
  const [markdown, setMarkdown] = useState(initialContent.markdown);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!markdown.trim()) {
      setError("説明文を入力してください。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/worlds", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "説明文の保存に失敗しました。"));
      router.push("/worlds?updated=true");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "説明文の保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="about-editor" onSubmit={submit}>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <ArticleEditor
        id="worlds-markdown"
        name="markdown"
        label="ページの説明文"
        hint="Markdownと安全なHTMLタグを利用できます。"
        value={markdown}
        onChange={setMarkdown}
        disabled={saving}
        minRows={20}
      />
      <div className="about-editor__actions">
        <Button type="button" variant="secondary" disabled={saving} onClick={() => router.push("/worlds")}>キャンセル</Button>
        <Button type="submit" loading={saving}>変更を保存</Button>
      </div>
    </form>
  );
}
