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
  eventAt: z.string().datetime({ offset: true }).nullable().optional(),
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
  eventAt: articleFields.eventAt,
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one editable field is required",
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(1_000).default(""),
  xboxGamertag: z.string().trim().max(50).default(""),
  avatarId: z.string().uuid().nullable().optional(),
  minecraftSkinId: z.string().uuid().nullable().optional(),
  minecraftSkinModel: z.enum(["classic", "slim"]).optional(),
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

export const organizationMemberSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(2_000).default(""),
  xboxGamertag: z.string().trim().max(50).default(""),
  avatarId: z.string().uuid().nullable().optional(),
  minecraftSkinId: z.string().uuid().nullable().optional(),
  minecraftSkinModel: z.enum(["classic", "slim"]).optional(),
  userId: z.string().uuid().nullable().default(null),
  role: z.enum(["master", "administrator", "server_owner", "team_member", "trainee"]),
  team: z.string().trim().max(80).default(""),
  parentId: z.string().uuid().nullable().default(null),
  groupId: z.string().uuid().nullable().default(null),
}).strict();

export const organizationMemberCreateSchema = organizationMemberSchema;

export const mapMarkerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1_000).default(""),
  world: z.string().trim().min(1).max(100),
  x: z.number().finite().min(-30_000_000).max(30_000_000),
  y: z.number().finite().min(-2_048).max(2_048).nullable().optional(),
  z: z.number().finite().min(-30_000_000).max(30_000_000),
  icon: z.string().trim().min(1).max(32).default("place"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).transform((value) => value.toLowerCase()).default("#d15d36"),
  imageId: z.string().uuid().nullable().optional(),
  relatedType: z.enum(["post", "article"]).nullable().optional(),
  relatedId: z.string().uuid().nullable().optional(),
}).strict();

export const updateMapMarkerSchema = mapMarkerSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" },
);

const mapPathPointSchema = z.object({
  x: z.number().finite().min(-30_000_000).max(30_000_000),
  z: z.number().finite().min(-30_000_000).max(30_000_000),
}).strict();

export const mapPathSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1_000).default(""),
  world: z.string().trim().min(1).max(100),
  kind: z.enum(["road", "railway", "other"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).transform((value) => value.toLowerCase()),
  weight: z.number().int().min(1).max(12),
  dashed: z.boolean(),
  points: z.array(mapPathPointSchema).min(2).max(500),
}).strict();

export const updateMapPathSchema = mapPathSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" },
);

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
