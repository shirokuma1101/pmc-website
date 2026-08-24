import { describe, expect, it } from "vitest";
import {
  loginSchema,
  postSchema,
  registrationSchema,
  reviewSchema,
  twoFactorDisableSchema,
  twoFactorEnableSchema,
  twoFactorSetupSchema,
  updateArticleSchema,
} from "./schemas";

describe("API input schemas", () => {
  it("requires post text", () => {
    expect(postSchema.safeParse({ content: "", fileIds: [] }).success).toBe(false);
    expect(postSchema.safeParse({ content: "", fileIds: [crypto.randomUUID()] }).success).toBe(false);
    expect(postSchema.safeParse({ content: "記録", fileIds: [] }).success).toBe(true);
  });

  it("never accepts workflow fields through standard article updates", () => {
    expect(updateArticleSchema.safeParse({ status: "published" }).success).toBe(false);
  });

  it("normalizes article tags and enforces tag limits", () => {
    expect(updateArticleSchema.parse({ tags: [" Minecraft ", "建築"] }).tags).toEqual(["Minecraft", "建築"]);
    expect(updateArticleSchema.parse({ tags: ["Event", "event"] }).tags).toEqual(["Event"]);
    expect(updateArticleSchema.safeParse({ tags: Array.from({ length: 11 }, (_, index) => `tag-${index}`) }).success).toBe(false);
    expect(updateArticleSchema.safeParse({ tags: ["x".repeat(31)] }).success).toBe(false);
  });

  it("requires a comment when an article is rejected", () => {
    expect(reviewSchema.safeParse({ action: "rejected" }).success).toBe(false);
    expect(reviewSchema.safeParse({ action: "rejected", comment: "修正してください" }).success).toBe(true);
  });

  it("validates self-registration without accepting role fields", () => {
    const valid = { displayName: "新規メンバー", email: "new@example.com", password: "long-password" };
    expect(registrationSchema.safeParse(valid).success).toBe(true);
    expect(registrationSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, role: "administrator" }).success).toBe(false);
  });

  it("accepts exactly six ASCII OTP digits, including a leading zero", () => {
    const credentials = { email: "member@example.com", password: "password" };

    expect(loginSchema.safeParse({ ...credentials, otp: "012345" }).success).toBe(true);
    expect(twoFactorSetupSchema.safeParse({ password: "password" }).success).toBe(true);
    expect(twoFactorEnableSchema.safeParse({ otp: "012345" }).success).toBe(true);
    expect(twoFactorDisableSchema.safeParse({ password: "password", otp: "012345" }).success).toBe(true);
  });

  it("rejects Unicode digits and OTP values that are not six digits", () => {
    const invalidOtps = [
      "０１２３４５",
      "٠١٢٣٤٥",
      "12345",
      "1234567",
      "12a456",
    ];

    for (const otp of invalidOtps) {
      expect(loginSchema.safeParse({
        email: "member@example.com",
        password: "password",
        otp,
      }).success).toBe(false);
      expect(twoFactorEnableSchema.safeParse({ otp }).success).toBe(false);
      expect(twoFactorDisableSchema.safeParse({ password: "password", otp }).success).toBe(false);
    }
  });

  it("rejects extra authentication fields and never accepts a client-provided enable secret", () => {
    expect(loginSchema.safeParse({
      email: "member@example.com",
      password: "password",
      otp: "012345",
      remember: true,
    }).success).toBe(false);
    expect(twoFactorSetupSchema.safeParse({
      password: "password",
      otp: "012345",
    }).success).toBe(false);
    expect(twoFactorEnableSchema.safeParse({
      otp: "012345",
      secret: "CLIENT_CONTROLLED_SECRET",
    }).success).toBe(false);
    expect(twoFactorDisableSchema.safeParse({
      password: "password",
      otp: "012345",
      userId: crypto.randomUUID(),
    }).success).toBe(false);
  });
});
