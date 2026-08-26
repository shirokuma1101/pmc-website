import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useCloseDetailsOnOutsideClick } from "./useCloseDetailsOnOutsideClick";

function DetailsHarness() {
  const ref = useRef<HTMLDetailsElement>(null);
  useCloseDetailsOnOutsideClick(ref);
  return (
    <>
      <details ref={ref} open>
        <summary>管理</summary>
        <button type="button">メニュー内</button>
      </details>
      <button type="button">メニュー外</button>
    </>
  );
}

describe("useCloseDetailsOnOutsideClick", () => {
  afterEach(cleanup);

  it("keeps the menu open for an inside pointer action", () => {
    render(<DetailsHarness />);
    const details = screen.getByText("管理").closest("details");

    fireEvent.pointerDown(screen.getByRole("button", { name: "メニュー内" }));

    expect(details).toHaveAttribute("open");
  });

  it("closes the menu for an outside pointer action", () => {
    render(<DetailsHarness />);
    const details = screen.getByText("管理").closest("details");

    fireEvent.pointerDown(screen.getByRole("button", { name: "メニュー外" }));

    expect(details).not.toHaveAttribute("open");
  });
});
