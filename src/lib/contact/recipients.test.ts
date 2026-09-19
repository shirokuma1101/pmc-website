import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { contactRecipientOptions, resolveContactRecipient } from "./recipients";

afterEach(() => { delete process.env.CONTACT_PERSONAL_RECIPIENTS; });

describe("contact recipients", () => {
  it("offers the common mailbox by default", () => {
    expect(contactRecipientOptions()).toEqual([{ id: "support", label: "共通窓口（support@postmineclan.com）" }]);
    expect(resolveContactRecipient("support")).toBe("support@postmineclan.com");
  });

  it("exposes only labels for configured personal recipients", () => {
    process.env.CONTACT_PERSONAL_RECIPIENTS = JSON.stringify([{ id: "owner", label: "運営代表", email: "owner@example.com" }]);
    expect(contactRecipientOptions()).toContainEqual({ id: "owner", label: "運営代表" });
    expect(JSON.stringify(contactRecipientOptions())).not.toContain("owner@example.com");
    expect(resolveContactRecipient("owner")).toBe("owner@example.com");
    expect(resolveContactRecipient("unknown")).toBeNull();
  });

  it("rejects the reserved common recipient ID", () => {
    process.env.CONTACT_PERSONAL_RECIPIENTS = JSON.stringify([{ id: "support", label: "別窓口", email: "other@example.com" }]);
    expect(() => contactRecipientOptions()).toThrow("reserved IDs");
  });
});
