import "server-only";

import { z } from "zod";

const recipientSchema = z.array(z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  label: z.string().trim().min(1).max(80),
  email: z.email().max(254),
}).strict()).max(20);

export interface ContactRecipientOption { id: string; label: string }

function configuredRecipients() {
  const raw = process.env.CONTACT_PERSONAL_RECIPIENTS?.trim();
  if (!raw) return [];
  const recipients = recipientSchema.parse(JSON.parse(raw));
  if (recipients.some((recipient) => recipient.id === "support") || new Set(recipients.map((recipient) => recipient.id)).size !== recipients.length) {
    throw new Error("CONTACT_PERSONAL_RECIPIENTS contains duplicate or reserved IDs");
  }
  return recipients;
}

export function contactRecipientOptions(): ContactRecipientOption[] {
  return [
    { id: "support", label: "共通窓口（support@postmineclan.com）" },
    ...configuredRecipients().map(({ id, label }) => ({ id, label })),
  ];
}

export function resolveContactRecipient(id: string): string | null {
  if (id === "support") return "support@postmineclan.com";
  return configuredRecipients().find((recipient) => recipient.id === id)?.email ?? null;
}
