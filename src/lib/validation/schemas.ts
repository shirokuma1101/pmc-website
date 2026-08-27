import { z } from "zod";

export const idSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const otpSchema = z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit authentication code");

export const loginSchema = z.object({
  provider: z.literal("directus").default("directus"),
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
  otp: otpSchema.optional(),
}).strict();

export const registrationSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
}).strict();

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(254),
}).strict();

export const passwordResetSchema = z.object({
  token: z.string().trim().min(1).max(4096),
  password: z.string().min(12).max(128),
}).strict();

export const twoFactorSetupSchema = z.object({
  password: z.string().min(1).max(1024),
}).strict();

export const twoFactorEnableSchema = z.object({
  otp: otpSchema,
}).strict();

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1).max(1024),
  otp: otpSchema,
}).strict();

export const postSchema = z.object({
  content: z.string().trim().min(1).max(2_000),
  fileIds: z.array(z.string().uuid()).max(4).default([]),
}).strict();

export const adminPostFieldsSchema = z.object({
  authorId: z.string().uuid().optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
}).strict();

export const updatePostSchema = z.object({
  content: z.string().trim().min(1).max(2_000).optional(),
  fileIds: z.array(z.string().uuid()).max(4).optional(),
}).strict().refine((value) => value.content !== undefined || value.fileIds !== undefined, {
  message: "At least one field is required",
});

const articleFields = {
  title: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  summary: z.string().trim().max(500),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]).transform((tags) => (
    tags.filter((tag, index) => tags.findIndex((candidate) => candidate.toLocaleLowerCase() === tag.toLocaleLowerCase()) === index)
  )),
  body: z.string().max(100_000),
};

export const createArticleSchema = z.object(articleFields).strict();

export const adminArticleFieldsSchema = z.object({
  authorId: z.string().uuid().optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
  publishedAt: z.string().datetime({ offset: true }).optional(),
}).strict();

export const updateArticleSchema = z.object({
  title: articleFields.title.optional(),
  slug: articleFields.slug,
  summary: articleFields.summary.optional(),
  tags: articleFields.tags.optional(),
  body: articleFields.body.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one editable field is required",
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(1_000).default(""),
  xboxGamertag: z.string().trim().max(50).default(""),
  avatarId: z.string().uuid().nullable().optional(),
}).strict();

export const reviewSchema = z.object({
  action: z.enum(["approved", "rejected"]),
  comment: z.string().trim().max(2_000).optional(),
}).strict().superRefine((value, context) => {
  if (value.action === "rejected" && !value.comment) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["comment"],
      message: "A rejection comment is required",
    });
  }
});

export const articleStatusSchema = z.enum(["draft", "pending", "published", "rejected"]);

export const aboutContentSchema = z.object({
  markdown: z.string().trim().min(1).max(100_000),
}).strict();

export const worldsContentSchema = aboutContentSchema;

export function slugify(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150)
    .replace(/-+$/g, "");
  return normalized || `article-${crypto.randomUUID().slice(0, 8)}`;
}
