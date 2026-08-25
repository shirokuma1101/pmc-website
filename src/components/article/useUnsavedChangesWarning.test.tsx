import { cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUnsavedChangesWarning } from "./useUnsavedChangesWarning";

function WarningHarness() {
  const [dirty, setDirty] = useState(false);
  useUnsavedChangesWarning(dirty);
  return (
    <>
      <button type="button" onClick={() => setDirty(true)}>変更する</button>
      <button type="button" onClick={() => setDirty(false)}>保存する</button>
      <a href="/other" onClick={(event) => event.preventDefault()}>移動する</a>
    </>
  );
}

describe("useUnsavedChangesWarning", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("blocks link navigation when unsaved changes exist", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { getByRole } = render(<WarningHarness />);
    fireEvent.click(getByRole("button", { name: "変更する" }));

    const allowed = fireEvent.click(getByRole("link", { name: "移動する" }));

    expect(allowed).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("does not warn after the changes are marked as saved", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { getByRole } = render(<WarningHarness />);
    fireEvent.click(getByRole("button", { name: "変更する" }));
    fireEvent.click(getByRole("button", { name: "保存する" }));

    fireEvent.click(getByRole("link", { name: "移動する" }));

    expect(confirm).not.toHaveBeenCalled();
  });

  it("requests a native browser warning before unloading", () => {
    const { getByRole } = render(<WarningHarness />);
    fireEvent.click(getByRole("button", { name: "変更する" }));
    const event = new Event("beforeunload", { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("returns to the editor when browser back navigation is canceled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const forward = vi.spyOn(window.history, "forward").mockImplementation(() => undefined);
    const { getByRole } = render(<WarningHarness />);
    fireEvent.click(getByRole("button", { name: "変更する" }));

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(forward).toHaveBeenCalledOnce();
  });
});
