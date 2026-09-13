import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/directus/client", () => ({ directusRequest: vi.fn() }));

import { directusRequest } from "@/lib/directus/client";
import { POST } from "./route";

function signedRequest(event: unknown, secret = "whsec_test"): Request {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1_000);
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return new Request("http://localhost:3001/api/supporters/webhook", { method: "POST", headers: { "Stripe-Signature": `t=${timestamp},v1=${signature}` }, body: payload });
}

describe("POST /api/supporters/webhook", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_INTERNAL_SECRET = "internal-test";
    process.env.DIRECTUS_URL = "http://directus.test";
    vi.mocked(directusRequest).mockReset().mockResolvedValue(undefined);
  });

  it("forwards accepted signed events to Directus", async () => {
    const event = { id: "evt_test", type: "checkout.session.async_payment_succeeded", livemode: false, data: { object: { id: "cs_test" } } };
    const response = await POST(signedRequest(event));
    expect(response.status).toBe(204);
    expect(directusRequest).toHaveBeenCalledWith("/pmc-website/support-events", expect.objectContaining({ method: "POST", body: expect.objectContaining({ id: "evt_test" }) }));
  });

  it("rejects an invalid signature", async () => {
    const response = await POST(signedRequest({ id: "evt_test", type: "checkout.session.completed", livemode: false }, "wrong-secret"));
    expect(response.status).toBe(400);
    expect(directusRequest).not.toHaveBeenCalled();
  });

  it("rejects live events while using a test key", async () => {
    const response = await POST(signedRequest({ id: "evt_live", type: "checkout.session.completed", livemode: true, data: { object: {} } }));
    expect(response.status).toBe(400);
    expect(directusRequest).not.toHaveBeenCalled();
  });

  it("acknowledges unsupported signed events without forwarding", async () => {
    const response = await POST(signedRequest({ id: "evt_other", type: "product.created", livemode: false, data: { object: {} } }));
    expect(response.status).toBe(204);
    expect(directusRequest).not.toHaveBeenCalled();
  });
});
