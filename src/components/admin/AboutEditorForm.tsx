"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorMessage } from "@/components/apiResponse";
import { ArticleEditor } from "@/components/editor";
import { Alert, Button } from "@/components/ui";
import type { AboutContent } from "@/lib/about";

export interface AboutEditorFormProps {
  initialContent: AboutContent;
}

export function AboutEditorForm({ initialContent }: AboutEditorFormProps) {
  const router = useRouter();
  const [markdown, setMarkdown] = useState(initialContent.markdown);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!markdown.trim()) {
      setError("本文を入力してください。");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/about", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "About Usの保存に失敗しました。"));
      router.push("/about?updated=true");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "About Usの保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="about-editor" onSubmit={submit}>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <ArticleEditor
        id="about-markdown"
        name="markdown"
        label="About Us本文"
        hint={'Markdownと安全なHTMLタグを利用できます。画像の横並びには <div class="image-gallery"> を使用できます。'}
        value={markdown}
        onChange={setMarkdown}
        disabled={saving}
        minRows={28}
      />
      <div className="about-editor__actions">
        <Button type="button" variant="secondary" disabled={saving} onClick={() => router.push("/about")}>キャンセル</Button>
        <Button type="submit" loading={saving}>変更を保存</Button>
      </div>
    </form>
  );
}
