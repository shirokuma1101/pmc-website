import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/directus/about", () => ({
  getAboutContent: vi.fn().mockResolvedValue({
    markdown: `# Safe heading

**formatted text**

<script>alert("unsafe")</script>

<div>raw HTML content</div>

[unsafe link](javascript:alert(1))

![safe image](https://images.example.com/example.png)`,
  }),
}));

import AboutPage from "./page";

describe("About Us Markdown rendering", () => {
  it("renders Markdown while dropping raw HTML and unsafe URL schemes", async () => {
    const page = await AboutPage({ searchParams: Promise.resolve({}) });
    const { container } = render(page);

    expect(screen.getByRole("heading", { name: "Safe heading" })).toBeInTheDocument();
    expect(screen.getByText("formatted text").tagName).toBe("STRONG");
    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(screen.queryByText("raw HTML content")).not.toBeInTheDocument();
    expect(screen.getByText("unsafe link").closest("a")).not.toHaveAttribute("href");
    expect(screen.getByRole("img", { name: "safe image" })).toHaveAttribute("src", "https://images.example.com/example.png");
    expect(screen.getByRole("link", { name: "参加フォームを開く" })).toHaveAttribute(
      "href",
      "https://forms.gle/nAfeagxWa9JFMWHw5",
    );
    expect(screen.getByRole("heading", { name: "歴史" })).toBeInTheDocument();
    expect(screen.getByText("PostMineClan設立（当時10人ほど）")).toBeInTheDocument();
    expect(screen.getByText("PMC 6.0開始（活動再開）")).toBeInTheDocument();
  });
});
