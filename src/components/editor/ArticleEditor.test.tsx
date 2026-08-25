import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArticleEditor } from "./ArticleEditor";

function EditorHarness({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <ArticleEditor value={value} onChange={setValue} />;
}

describe("ArticleEditor", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("accepts a level-two Markdown heading and updates the preview", async () => {
    render(<EditorHarness />);
    fireEvent.click(screen.getByRole("button", { name: "分割" }));
    fireEvent.change(screen.getByRole("textbox", { name: "本文" }), {
      target: { value: "## 見出し" },
    });
    expect(await screen.findByRole("heading", { level: 2, name: "見出し" })).toBeInTheDocument();
  });

  it("keeps an incomplete heading marker editable", () => {
    render(<EditorHarness initialValue="##" />);
    expect(screen.getByRole("textbox", { name: "本文" })).toHaveValue("##");
    fireEvent.click(screen.getByRole("button", { name: "分割" }));
    expect(screen.getByLabelText("本文プレビュー")).toHaveTextContent("##");
  });

  it("keeps an empty heading editable in split view", async () => {
    render(<EditorHarness />);
    fireEvent.click(screen.getByRole("button", { name: "分割" }));
    const editor = screen.getByRole("textbox", { name: "本文" });
    fireEvent.change(editor, { target: { value: "## " } });

    expect(editor).toHaveValue("## ");
    expect(await screen.findByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("synchronizes scrolling from the editor to the preview", () => {
    render(<EditorHarness initialValue="本文" />);
    fireEvent.click(screen.getByRole("button", { name: "分割" }));
    const editor = screen.getByRole("textbox", { name: "本文" });
    const preview = screen.getByLabelText("本文プレビュー");
    Object.defineProperties(editor, { clientHeight: { value: 500 }, scrollHeight: { value: 1000 } });
    Object.defineProperties(preview, { clientHeight: { value: 500 }, scrollHeight: { value: 1500 } });

    editor.scrollTop = 250;
    fireEvent.scroll(editor);

    expect(preview.scrollTop).toBe(500);
  });

  it("synchronizes scrolling from the preview to the editor", () => {
    render(<EditorHarness initialValue="本文" />);
    fireEvent.click(screen.getByRole("button", { name: "分割" }));
    const editor = screen.getByRole("textbox", { name: "本文" });
    const preview = screen.getByLabelText("本文プレビュー");
    Object.defineProperties(editor, { clientHeight: { value: 500 }, scrollHeight: { value: 1500 } });
    Object.defineProperties(preview, { clientHeight: { value: 500 }, scrollHeight: { value: 1000 } });

    preview.scrollTop = 250;
    fireEvent.scroll(preview);

    expect(editor.scrollTop).toBe(500);
  });

  it("previews safe HTML and removes executable HTML", () => {
    render(<EditorHarness initialValue={'<details open><summary>補足</summary><p onclick="alert(1)">内容</p><script>alert(1)</script></details>'} />);
    fireEvent.click(screen.getByRole("button", { name: "プレビュー" }));
    expect(screen.getByText("補足").tagName).toBe("SUMMARY");
    expect(screen.getByText("内容")).not.toHaveAttribute("onclick");
    expect(document.querySelector("script")).not.toBeInTheDocument();
  });

  it("inserts an H2 marker without blocking further input", () => {
    render(<EditorHarness />);
    fireEvent.click(screen.getByRole("button", { name: "H2" }));
    const editor = screen.getByRole("textbox", { name: "本文" }) as HTMLTextAreaElement;
    expect(editor).toHaveValue("## 見出し");
    fireEvent.change(editor, { target: { value: "## 見出しを編集" } });
    expect(editor).toHaveValue("## 見出しを編集");
  });

  it("shows Markdown and allowed HTML help from the toolbar", () => {
    render(<EditorHarness />);
    fireEvent.click(screen.getByRole("button", { name: "ヘルプ" }));

    const dialog = screen.getByRole("dialog", { name: "Markdown・HTMLヘルプ" });
    expect(dialog).toHaveTextContent("## 見出し");
    expect(dialog).toHaveTextContent("<details>");
    expect(dialog).toHaveTextContent('class="image-gallery"');
    expect(dialog).toHaveTextContent("script");

    fireEvent.click(screen.getByRole("button", { name: "ヘルプを閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uploads an image and inserts it at the current cursor position", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: {
        id: "123e4567-e89b-42d3-a456-426614174000",
        url: "https://cms.example.com/pmc-website/assets/123e4567-e89b-42d3-a456-426614174000",
      },
    }), { status: 201, headers: { "Content-Type": "application/json" } }));
    const { container } = render(<EditorHarness initialValue={"前\n\n後"} />);
    const editor = screen.getByRole("textbox", { name: "本文" }) as HTMLTextAreaElement;
    editor.setSelectionRange(3, 3);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute("multiple");
    fireEvent.change(input!, {
      target: { files: [new File(["image"], "private-name.png", { type: "image/png" })] },
    });
    expect(await screen.findByRole("textbox", { name: "本文" })).toHaveValue(
      "前\n\n![private-name.png](https://cms.example.com/pmc-website/assets/123e4567-e89b-42d3-a456-426614174000)\n\n後",
    );
  });

  it("uploads multiple images in selection order using filenames as alt text", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "first", url: "https://cms.example.com/assets/first" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "second", url: "https://cms.example.com/assets/second" } }), { status: 201 }));
    const { container } = render(<EditorHarness />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input!, {
      target: {
        files: [
          new File(["first"], "first-image.png", { type: "image/png" }),
          new File(["second"], "second-image.webp", { type: "image/webp" }),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "本文" })).toHaveValue(
        "![first-image.png](https://cms.example.com/assets/first)\n\n![second-image.webp](https://cms.example.com/assets/second)\n",
      );
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
