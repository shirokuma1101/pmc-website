import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OrganizationModeSwitch } from "./OrganizationModeSwitch";

afterEach(cleanup);

describe("OrganizationModeSwitch", () => {
  it("links between public and editor modes on the same page", () => {
    render(<OrganizationModeSwitch editing />);

    expect(screen.getByRole("link", { name: /公開表示/ })).toHaveAttribute("href", "/organization");
    expect(screen.getByRole("link", { name: /編集する/ })).toHaveAttribute("href", "/organization?edit=1");
    expect(screen.getByRole("link", { name: /編集する/ })).toHaveAttribute("aria-current", "page");
  });
});
