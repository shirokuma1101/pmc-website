import { Readable } from "node:stream";

const UPLOAD_FOLDER_ID = "0ebf4c62-1014-4a72-99db-2b1198c59f1f";
const MAXIMUM_IMAGE_BYTES = 8 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_UPLOAD_PATTERN =
  /^pmc-website-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|gif)$/;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EDITABLE_ARTICLE_STATUSES = new Set(["draft", "rejected", "published"]);
const DELETABLE_ARTICLE_STATUSES = new Set(["draft", "rejected"]);
const SUBMITTABLE_ARTICLE_STATUSES = new Set(["draft", "rejected"]);
const STORED_ASSET_PATTERN = /\/pmc-website\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;
const MEMBER_ROLE_NAME = "pmc-website Member";

export function storedImageIdsInMarkdown(markdown) {
  const ids = new Set();
  for (const match of String(markdown ?? "").matchAll(STORED_ASSET_PATTERN)) {
    ids.add(match[1].toLowerCase());
  }
  return [...ids];
}
const DEFAULT_ABOUT_CONTENT = {
  markdown: `# 好きなものが、創れる世界へ

PostMineClanは、メンバーの活動や発見を記録し、好きなことから生まれる創作を共有するためのコミュニティです。

## つくる人の、足跡がつながる場所。

タイムラインでは日々の活動を、記事ではまとまった知識や考えを残せます。一人ひとりの記録が、誰かの新しい一歩につながっていくことを願っています。

## 大切にしていること

### 01 好きから始める

心が動くものを出発点に、つくりたいという気持ちを大切にします。

### 02 つくる過程を残す

完成したものだけでなく、試行錯誤や日々の小さな前進も共有します。

### 03 互いの活動を支える

それぞれの興味や表現を尊重し、次の挑戦につながる場所を目指します。`,
};
const ARTICLE_FIELDS = [
  "id",
  "title",
  "slug",
  "summary",
  "tags",
  "body",
  "status",
  "created_at",
  "updated_at",
  "published_at",
  "review_comment",
  "author.id",
  "author.profile.id",
  "author.profile.display_name",
  "author.profile.avatar.id",
  "thumbnail.id",
  "thumbnail.description",
  "thumbnail.type",
];
const REVIEW_FIELDS = [
  "id",
  "article.id",
  "reviewer.id",
  "reviewer.profile.id",
  "reviewer.profile.display_name",
  "reviewer.profile.avatar.id",
  "action",
  "comment",
  "created_at",
];
const POST_FIELDS = [
  "id",
  "content",
  "created_at",
  "updated_at",
  "author.id",
  "author.profile.id",
  "author.profile.display_name",
  "author.profile.avatar.id",
  "files.id",
  "files.sort",
  "files.directus_files_id.id",
  "files.directus_files_id.description",
  "files.directus_files_id.type",
];
const PROFILE_FIELDS = [
  "id",
  "display_name",
  "bio",
  "created_at",
  "updated_at",
  "avatar.id",
  "avatar.description",
  "avatar.type",
  "user.id",
];

class EndpointError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function route(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response);
    } catch (error) {
      if (error instanceof EndpointError) {
        response.status(error.status).json({
          errors: [{ message: error.message, extensions: { code: error.code } }],
        });
        return;
      }
      next(error);
    }
  };
}

function currentUser(request) {
  const user = request.accountability?.user;
  if (!user) throw new EndpointError(401, "AUTH_REQUIRED", "Authentication is required");
  return String(user);
}

function requireAdmin(request) {
  const user = currentUser(request);
  if (request.accountability?.admin !== true) {
    throw new EndpointError(403, "ADMIN_REQUIRED", "Administrator access is required");
  }
  return user;
}

function elevatedAccountability(request) {
  return {
    ...request.accountability,
    user: currentUser(request),
    admin: true,
    app: true,
  };
}

function objectBody(request) {
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "A JSON object is required");
  }
  return request.body;
}

function strictKeys(body, allowed) {
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new EndpointError(400, "INVALID_PAYLOAD", `Unsupported field: ${unknown[0]}`);
  }
}

function aboutContent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "content must be an object");
  }
  strictKeys(value, new Set(["markdown"]));
  return { markdown: requiredText(value.markdown, "markdown", 100_000) };
}

function requiredText(value, field, maximum) {
  if (typeof value !== "string") {
    throw new EndpointError(400, "INVALID_PAYLOAD", `${field} must be a string`);
  }
  const text = value.trim();
  if (!text || text.length > maximum) {
    throw new EndpointError(400, "INVALID_PAYLOAD", `${field} has an invalid length`);
  }
  return text;
}

function optionalText(value, field, maximum, { trim = true } = {}) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new EndpointError(400, "INVALID_PAYLOAD", `${field} must be a string`);
  }
  const text = trim ? value.trim() : value;
  if (text.length > maximum) {
    throw new EndpointError(400, "INVALID_PAYLOAD", `${field} is too long`);
  }
  return text;
}

function plainTextExcerpt(markdown, maximum = 360) {
  const text = String(markdown ?? "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 1).trimEnd()}…`;
}

function discordWebhookEndpoint(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DISCORD_ARTICLE_WEBHOOK_URL is not a valid URL");
  }
  const discordHost = url.hostname === "discord.com"
    || url.hostname.endsWith(".discord.com")
    || url.hostname === "discordapp.com"
    || url.hostname.endsWith(".discordapp.com");
  if (url.protocol !== "https:" || !discordHost || !/^\/api(?:\/v\d+)?\/webhooks\/\d+\/[^/]+/.test(url.pathname)) {
    throw new Error("DISCORD_ARTICLE_WEBHOOK_URL must be an HTTPS Discord webhook URL");
  }
  url.searchParams.set("wait", "true");
  return url;
}

export function discordArticlePayload(article, publicSiteUrl, publicDirectusUrl) {
  const articleUrl = new URL(`/articles/${encodeURIComponent(article.slug)}`, publicSiteUrl).toString();
  const author = article.display_name?.trim()
    || [article.first_name, article.last_name].filter(Boolean).join(" ").trim()
    || "PostMineClan Member";
  const tags = Array.isArray(article.tags)
    ? article.tags.filter((tag) => typeof tag === "string" && tag.trim()).slice(0, 10)
    : [];
  const thumbnailBase = publicDirectusUrl ? new URL(publicDirectusUrl) : null;
  const thumbnailUrl = article.thumbnail && thumbnailBase?.protocol === "https:"
    ? new URL(`/pmc-website/assets/${encodeURIComponent(article.thumbnail)}`, thumbnailBase).toString()
    : null;
  return {
    username: "PostMineClan",
    allowed_mentions: { parse: [] },
    embeds: [{
      title: String(article.title).slice(0, 256),
      url: articleUrl,
      description: plainTextExcerpt(article.body) || "新しい記事が公開されました。",
      color: 0x315db7,
      author: { name: author.slice(0, 256) },
      fields: tags.length ? [{ name: "タグ", value: tags.map((tag) => `#${tag}`).join("  ").slice(0, 1_024) }] : [],
      ...(thumbnailUrl ? { image: { url: thumbnailUrl } } : {}),
      footer: { text: "PostMineClan — 新しい記事が公開されました" },
      timestamp: new Date(article.published_at ?? Date.now()).toISOString(),
    }],
  };
}

async function sendPublishedArticleToDiscord(article, logger) {
  const endpoint = discordWebhookEndpoint(process.env.DISCORD_ARTICLE_WEBHOOK_URL);
  if (!endpoint) return;
  const publicSiteUrl = process.env.PMC_WEBSITE_PUBLIC_URL;
  if (!publicSiteUrl) throw new Error("PMC_WEBSITE_PUBLIC_URL is required when the Discord webhook is enabled");
  const payload = discordArticlePayload(article, publicSiteUrl, process.env.PUBLIC_URL);
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}`);
  logger?.info({ articleId: article.id }, "Published article notification sent to Discord");
}

function articleTags(value, { optional = false } = {}) {
  if (value === undefined) return optional ? undefined : [];
  if (!Array.isArray(value) || value.length > 10) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "tags must contain at most ten items");
  }
  const tags = value.map((tag) => requiredText(tag, "tags", 30));
  const normalized = tags.map((tag) => tag.toLocaleLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "tags must not contain duplicates");
  }
  return tags;
}

function uuid(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new EndpointError(400, "INVALID_PAYLOAD", `${field} must be a UUID`);
  }
  return value.toLowerCase();
}

function timestamp(value, field) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new EndpointError(400, "INVALID_PAYLOAD", `${field} must be an ISO timestamp`);
  }
  return new Date(value).toISOString();
}

function routeId(request) {
  return uuid(request.params.id, "id");
}

function fileIds(value, { optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (!Array.isArray(value) || value.length > 4) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "file_ids must contain at most four UUIDs");
  }
  const result = value.map((entry) => uuid(entry, "file_ids"));
  if (new Set(result).size !== result.length) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "file_ids must not contain duplicates");
  }
  return result;
}

function pagination(request, defaultLimit = 12) {
  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? defaultLimit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) {
    throw new EndpointError(400, "INVALID_QUERY", "page has an invalid value");
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    throw new EndpointError(400, "INVALID_QUERY", "limit has an invalid value");
  }
  return { page, limit, offset: (page - 1) * limit };
}

async function withLikeState(database, items, table, contentField, userId) {
  const ids = items.map((item) => item.id);
  if (ids.length === 0) return items;
  const countRows = await database(table)
    .select(contentField)
    .count("id", { as: "count" })
    .whereIn(contentField, ids)
    .groupBy(contentField);
  const counts = new Map(countRows.map((row) => [String(row[contentField]), Number(row.count)]));
  const likedIds = userId
    ? new Set((await database(table).select(contentField).where({ user: userId }).whereIn(contentField, ids))
      .map((row) => String(row[contentField])))
    : new Set();
  return items.map((item) => ({
    ...item,
    like_count: counts.get(String(item.id)) ?? 0,
    liked_by_me: likedIds.has(String(item.id)),
    can_like: Boolean(userId),
  }));
}

async function setLike(database, table, contentField, contentId, userId, liked) {
  const id = `${userId}:${contentId}`;
  if (liked) {
    const exists = await database(table).select("id").where({ id }).first();
    if (!exists) {
      await database(table).insert({ id, [contentField]: contentId, user: userId, created_at: new Date() });
    }
  } else {
    await database(table).where({ id }).delete();
  }
  const row = await database(table).count("id", { as: "count" }).where({ [contentField]: contentId }).first();
  return Number(row?.count ?? 0);
}

async function assertOwnedUploads(database, ids, userId = null) {
  if (!ids || ids.length === 0) return;
  const files = await database("directus_files")
    .select("id", "uploaded_by", "folder", "filename_download", "type")
    .whereIn("id", ids);
  if (files.length !== ids.length) {
    throw new EndpointError(400, "INVALID_FILE_REFERENCE", "One or more files do not exist");
  }
  for (const file of files) {
    if (
      (userId !== null && file.uploaded_by !== userId)
      || file.folder !== UPLOAD_FOLDER_ID
      || !IMAGE_TYPES.has(String(file.type).toLowerCase())
      || !SAFE_UPLOAD_PATTERN.test(file.filename_download ?? "")
    ) {
      throw new EndpointError(
        403,
        "INVALID_FILE_REFERENCE",
        "Files must be sanitized uploads owned by the current user",
      );
    }
  }
}

async function ownedRecord(database, collection, id, userId, isAdmin) {
  const record = await database(collection).select("*").where({ id }).first();
  if (!record) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested item was not found");
  if (!isAdmin && record.author !== userId) {
    throw new EndpointError(403, "FORBIDDEN", "The requested item belongs to another user");
  }
  return record;
}

function postInput(request, { partial = false } = {}) {
  const body = objectBody(request);
  strictKeys(body, new Set(["content", "file_ids", "author_id", "created_at"]));
  const content = body.content === undefined && partial
    ? undefined
    : requiredText(body.content, "content", 2_000);
  const files = fileIds(body.file_ids, { optional: partial });
  const author = body.author_id === undefined ? undefined : uuid(body.author_id, "author_id");
  const createdAt = body.created_at === undefined ? undefined : timestamp(body.created_at, "created_at");
  if ((author !== undefined || createdAt !== undefined) && request.accountability?.admin !== true) {
    throw new EndpointError(403, "ADMIN_REQUIRED", "Only administrators can change post metadata");
  }
  if (partial && content === undefined && files === undefined && author === undefined && createdAt === undefined) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "At least one editable field is required");
  }
  return { content, files, author, createdAt };
}

function articleInput(request, { partial = false } = {}) {
  const body = objectBody(request);
  strictKeys(body, new Set(["title", "slug", "summary", "tags", "body"]));
  const title = body.title === undefined && partial
    ? undefined
    : requiredText(body.title, "title", 160);
  const slug = body.slug === undefined && partial
    ? undefined
    : requiredText(body.slug, "slug", 180);
  if (slug !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "slug has an invalid format");
  }
  const summary = body.summary === undefined && partial
    ? undefined
    : optionalText(body.summary, "summary", 500) ?? "";
  const tags = articleTags(body.tags, { optional: partial }) ?? (partial ? undefined : []);
  const articleBody = body.body === undefined && partial
    ? undefined
    : optionalText(body.body, "body", 100_000, { trim: false }) ?? "";
  const thumbnail = articleBody === undefined
    ? undefined
    : storedImageIdsInMarkdown(articleBody)[0] ?? null;
  if (partial && [title, slug, summary, tags, articleBody, thumbnail].every((value) => value === undefined)) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "At least one editable field is required");
  }
  return { title, slug, summary, tags, body: articleBody, thumbnail };
}

function profileInput(request) {
  const body = objectBody(request);
  strictKeys(body, new Set(["display_name", "bio", "avatar"]));
  return {
    display_name: requiredText(body.display_name, "display_name", 80),
    bio: optionalText(body.bio, "bio", 1_000) ?? "",
    avatar: body.avatar === undefined ? undefined : uuid(body.avatar, "avatar", { nullable: true }),
  };
}

function registrationInput(request) {
  const body = objectBody(request);
  strictKeys(body, new Set(["display_name", "email", "password"]));
  const displayName = requiredText(body.display_name, "display_name", 80);
  const email = requiredText(body.email, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "email has an invalid format");
  }
  if (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 128) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "password has an invalid length");
  }
  return { displayName, email, password: body.password };
}

function uploadInput(request) {
  const body = objectBody(request);
  strictKeys(body, new Set(["filename", "type", "data"]));
  if (typeof body.filename !== "string" || !SAFE_UPLOAD_PATTERN.test(body.filename)) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "filename is invalid");
  }
  if (typeof body.type !== "string" || !IMAGE_TYPES.has(body.type.toLowerCase())) {
    throw new EndpointError(415, "INVALID_IMAGE_TYPE", "type must be a supported image MIME type");
  }
  if (typeof body.data !== "string" || body.data.length === 0) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "data must be a base64 string");
  }
  const data = Buffer.from(body.data, "base64");
  if (data.length === 0 || data.length > MAXIMUM_IMAGE_BYTES) {
    throw new EndpointError(413, "IMAGE_TOO_LARGE", "The image exceeds the upload size limit");
  }
  const normalizedInput = body.data.replace(/=+$/, "");
  if (data.toString("base64").replace(/=+$/, "") !== normalizedInput) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "data is not valid canonical base64");
  }
  return { filename: body.filename, type: body.type.toLowerCase(), data };
}

async function replacePostFiles({ ItemsService, schema, accountability, database }, postId, ids) {
  await database.transaction(async (transaction) => {
    const junction = new ItemsService("posts_files", {
      schema,
      accountability,
      knex: transaction,
    });
    const existing = await transaction("posts_files").select("id").where({ posts_id: postId });
    if (existing.length > 0) await junction.deleteMany(existing.map((item) => item.id));
    if (ids.length > 0) {
      await junction.createMany(ids.map((fileId, sort) => ({
        posts_id: postId,
        directus_files_id: fileId,
        sort,
      })));
    }
  });
}

export default {
  id: "pmc-website",
  handler: (router, context) => {
    const { database, getSchema, services, logger } = context;
    const { AssetsService, FilesService, ItemsService, UsersService } = services;

    router.post("/register", route(async (request, response) => {
      if (process.env.REGISTRATION_ENABLED !== "true") {
        throw new EndpointError(403, "REGISTRATION_DISABLED", "Registration is currently disabled");
      }
      const input = registrationInput(request);
      const existing = await database("directus_users").select("id").whereRaw("LOWER(email) = ?", [input.email]).first();
      if (existing) throw new EndpointError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists");
      const role = await database("directus_roles").select("id").where({ name: MEMBER_ROLE_NAME }).first();
      if (!role) throw new EndpointError(503, "REGISTRATION_UNAVAILABLE", "Member registration is unavailable");
      const schema = await getSchema();
      const accountability = { admin: true, app: true };
      const users = new UsersService({ schema, accountability });
      const profiles = new ItemsService("profiles", { schema, accountability });
      await database.transaction(async (transaction) => {
        const userId = await users.fork({ knex: transaction }).createOne({
          email: input.email,
          password: input.password,
          role: role.id,
          status: "draft",
        });
        await profiles.fork({ knex: transaction }).createOne({
          user: userId,
          display_name: input.displayName,
          bio: "",
        });
      });
      response.status(201).json({ data: { registered: true } });
    }));

    router.get("/registrations", route(async (request, response) => {
      requireAdmin(request);
      const role = await database("directus_roles").select("id").where({ name: MEMBER_ROLE_NAME }).first();
      if (!role) throw new EndpointError(503, "REGISTRATION_UNAVAILABLE", "Member registration is unavailable");
      const data = await database("directus_users as users")
        .leftJoin("profiles", "profiles.user", "users.id")
        .select("users.id", "users.email", "users.status", "profiles.created_at as date_created", "profiles.display_name")
        .where({ "users.role": role.id, "users.status": "draft" })
        .orderBy("profiles.created_at", "asc");
      response.json({ data });
    }));

    router.post("/registrations/:id/accept", route(async (request, response) => {
      requireAdmin(request);
      const id = routeId(request);
      const role = await database("directus_roles").select("id").where({ name: MEMBER_ROLE_NAME }).first();
      const user = await database("directus_users").select("id", "role", "status").where({ id }).first();
      if (!user || !role || user.role !== role.id || user.status !== "draft") {
        throw new EndpointError(404, "RECORD_NOT_FOUND", "The pending registration was not found");
      }
      const schema = await getSchema();
      const users = new UsersService({ schema, accountability: elevatedAccountability(request) });
      await users.updateOne(id, { status: "active" });
      response.status(204).send();
    }));

    router.get("/session", route(async (request, response) => {
      const userId = currentUser(request);
      const user = await database("directus_users")
        .select("id", "email", "first_name", "last_name", "tfa_secret")
        .where({ id: userId })
        .first();
      if (!user) throw new EndpointError(401, "AUTH_REQUIRED", "The current user no longer exists");
      const profile = await database("profiles")
        .select("id", "display_name", "avatar")
        .where({ user: userId })
        .first();
      response.json({
        data: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          profile: profile
            ? {
                id: profile.id,
                display_name: profile.display_name,
                avatar: profile.avatar ? { id: profile.avatar } : null,
              }
            : null,
          isAdmin: request.accountability?.admin === true,
          tfaEnabled: Boolean(user.tfa_secret),
        },
      });
    }));

    router.get("/about", route(async (_request, response) => {
      const page = await database("site_pages").select("content", "updated_at").where({ id: "about" }).first();
      response.json({ data: page ?? { content: DEFAULT_ABOUT_CONTENT, updated_at: null } });
    }));

    router.put("/about", route(async (request, response) => {
      requireAdmin(request);
      const body = objectBody(request);
      strictKeys(body, new Set(["content"]));
      const content = aboutContent(body.content);
      await database("site_pages")
        .insert({ id: "about", content: JSON.stringify(content), updated_at: new Date() })
        .onConflict("id")
        .merge(["content", "updated_at"]);
      response.json({ data: { content } });
    }));

    router.post("/session/revoke-all", route(async (request, response) => {
      const userId = currentUser(request);
      const schema = await getSchema();
      const users = new UsersService({
        schema,
        accountability: elevatedAccountability(request),
      });
      await users.clearUserSessions([userId]);
      response.status(204).send();
    }));

    router.get("/admin/post-authors", route(async (request, response) => {
      requireAdmin(request);
      const data = await database("directus_users as users")
        .innerJoin("profiles as profiles", "profiles.user", "users.id")
        .select("users.id", "profiles.display_name", "profiles.avatar")
        .where("users.status", "active")
        .orderBy("profiles.display_name", "asc");
      response.json({ data });
    }));

    router.get("/posts", route(async (request, response) => {
      const { limit, offset } = pagination(request, 20);
      const filter = {};
      const count = database("posts");
      if (request.query.author_id !== undefined) {
        const author = uuid(request.query.author_id, "author_id");
        filter.author = { _eq: author };
        count.where({ author });
      }
      const schema = await getSchema();
      const posts = new ItemsService("posts", { schema, accountability: null });
      const data = await posts.readByQuery({
        fields: POST_FIELDS,
        filter,
        sort: ["-created_at"],
        limit,
        offset,
      });
      const totalRow = await count.count("id", { as: "count" }).first();
      const enriched = await withLikeState(database, data, "post_likes", "post", request.accountability?.user);
      response.json({ data: enriched, meta: { filter_count: Number(totalRow?.count ?? 0) } });
    }));

    router.get("/posts/:id", route(async (request, response) => {
      const id = routeId(request);
      const exists = await database("posts").select("id").where({ id }).first();
      if (!exists) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested post was not found");
      const schema = await getSchema();
      const posts = new ItemsService("posts", { schema, accountability: null });
      const data = await posts.readOne(id, { fields: POST_FIELDS });
      response.json({ data: (await withLikeState(database, [data], "post_likes", "post", request.accountability?.user))[0] });
    }));

    router.get("/profiles", route(async (request, response) => {
      if (request.query.user_id === undefined) {
        throw new EndpointError(400, "INVALID_QUERY", "user_id is required");
      }
      const user = uuid(request.query.user_id, "user_id");
      const schema = await getSchema();
      const profiles = new ItemsService("profiles", { schema, accountability: null });
      const data = await profiles.readByQuery({
        fields: PROFILE_FIELDS,
        filter: { user: { _eq: user } },
        limit: 1,
      });
      response.json({ data });
    }));

    router.get("/profiles/:id", route(async (request, response) => {
      const id = routeId(request);
      const exists = await database("profiles").select("id").where({ id }).first();
      if (!exists) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested profile was not found");
      const schema = await getSchema();
      const profiles = new ItemsService("profiles", { schema, accountability: null });
      response.json({ data: await profiles.readOne(id, { fields: PROFILE_FIELDS }) });
    }));

    router.post("/files", route(async (request, response) => {
      const userId = currentUser(request);
      const input = uploadInput(request);
      const schema = await getSchema();
      const files = new FilesService({
        schema,
        accountability: elevatedAccountability(request),
      });
      const id = await files.uploadOne(Readable.from([input.data]), {
        filename_download: input.filename,
        title: input.filename,
        type: input.type,
        folder: UPLOAD_FOLDER_ID,
        uploaded_by: userId,
      });
      response.status(201).json({ data: { id } });
    }));

    router.get("/files/:id", route(async (request, response) => {
      const userId = currentUser(request);
      const id = routeId(request);
      const file = await database("directus_files")
        .select("id", "type", "uploaded_by", "folder", "filename_download")
        .where({ id })
        .first();
      if (
        !file
        || file.folder !== UPLOAD_FOLDER_ID
        || !SAFE_UPLOAD_PATTERN.test(file.filename_download ?? "")
      ) {
        throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested file was not found");
      }
      if (request.accountability?.admin !== true && file.uploaded_by !== userId) {
        throw new EndpointError(403, "FORBIDDEN", "The requested file belongs to another user");
      }
      response.json({ data: file });
    }));

    router.delete("/files/:id", route(async (request, response) => {
      const userId = currentUser(request);
      const id = routeId(request);
      const file = await database("directus_files")
        .select("id", "uploaded_by", "folder", "filename_download")
        .where({ id })
        .first();
      if (
        !file
        || file.folder !== UPLOAD_FOLDER_ID
        || !SAFE_UPLOAD_PATTERN.test(file.filename_download ?? "")
      ) {
        throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested file was not found");
      }
      if (request.accountability?.admin !== true && file.uploaded_by !== userId) {
        throw new EndpointError(403, "FORBIDDEN", "The requested file belongs to another user");
      }
      const [postReference, articleReference] = await Promise.all([
        database("posts_files").select("id").where({ directus_files_id: id }).first(),
        database("articles")
          .select("id")
          .where({ thumbnail: id })
          .orWhere("body", "like", `%/pmc-website/assets/${id}%`)
          .first(),
      ]);
      if (postReference || articleReference) {
        throw new EndpointError(409, "FILE_IN_USE", "The file is still referenced by content");
      }
      const schema = await getSchema();
      const files = new FilesService({
        schema,
        accountability: elevatedAccountability(request),
      });
      await files.deleteOne(id);
      response.status(204).send();
    }));

    router.get("/assets/:id", route(async (request, response) => {
      const id = routeId(request);
      const file = await database("directus_files")
        .select("id", "folder", "filename_download", "type")
        .where({ id })
        .first();
      if (
        !file
        || file.folder !== UPLOAD_FOLDER_ID
        || !SAFE_UPLOAD_PATTERN.test(file.filename_download ?? "")
        || !IMAGE_TYPES.has(String(file.type).toLowerCase())
      ) {
        throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested asset was not found");
      }
      const schema = await getSchema();
      const assets = new AssetsService({ schema, accountability: null });
      const asset = await assets.getAsset(id, undefined, undefined, true);
      response.setHeader("Content-Type", asset.file.type);
      response.setHeader("Content-Length", asset.stat.size);
      response.setHeader("Content-Disposition", `inline; filename="${file.filename_download}"`);
      response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      response.setHeader("X-Content-Type-Options", "nosniff");
      const stream = await asset.stream();
      await new Promise((resolve, reject) => {
        stream.once("error", reject);
        response.once("finish", resolve);
        response.once("close", resolve);
        stream.pipe(response);
      });
    }));

    router.get("/articles", route(async (request, response) => {
      const scope = String(request.query.scope ?? "published");
      const { page, limit, offset } = pagination(request);
      const filter = {};
      const count = database("articles");

      if (scope === "published") {
        filter.status = { _eq: "published" };
        count.where({ status: "published" });
        if (request.query.author_id !== undefined) {
          const author = uuid(request.query.author_id, "author_id");
          filter.author = { _eq: author };
          count.andWhere({ author });
        }
        if (request.query.tag !== undefined) {
          const tag = requiredText(request.query.tag, "tag", 30);
          const matchingRows = await database("articles")
            .select("id")
            .where({ status: "published" })
            .whereRaw("tags::jsonb @> ?::jsonb", [JSON.stringify([tag])]);
          const matchingIds = matchingRows.map((row) => row.id);
          filter.id = { _in: matchingIds.length ? matchingIds : ["00000000-0000-0000-0000-000000000000"] };
          count.whereIn("id", matchingIds.length ? matchingIds : ["00000000-0000-0000-0000-000000000000"]);
        }
      } else if (scope === "own") {
        const userId = currentUser(request);
        filter.author = { _eq: userId };
        count.where({ author: userId });
        if (request.query.status !== undefined) {
          const status = String(request.query.status);
          if (!["draft", "pending", "published", "rejected"].includes(status)) {
            throw new EndpointError(400, "INVALID_QUERY", "status has an invalid value");
          }
          filter.status = { _eq: status };
          count.andWhere({ status });
        }
      } else if (scope === "pending") {
        requireAdmin(request);
        filter.status = { _eq: "pending" };
        count.where({ status: "pending" });
      } else {
        throw new EndpointError(400, "INVALID_QUERY", "scope has an invalid value");
      }

      const schema = await getSchema();
      const articles = new ItemsService("articles", {
        schema,
        accountability: null,
      });
      const data = await articles.readByQuery({
        fields: ARTICLE_FIELDS,
        filter,
        sort: ["-published_at", "-created_at"],
        limit,
        offset,
      });
      const totalRow = await count.count("id", { as: "count" }).first();
      const enriched = await withLikeState(database, data, "article_likes", "article", request.accountability?.user);
      response.json({
        data: enriched,
        meta: { filter_count: Number(totalRow?.count ?? 0) },
      });
    }));

    router.get("/articles/tags", route(async (_request, response) => {
      const rows = await database.raw(`
        SELECT DISTINCT json_array_elements_text(tags) AS tag
        FROM articles
        WHERE status = 'published' AND json_typeof(tags) = 'array'
        ORDER BY tag ASC
      `);
      response.json({ data: rows.rows.map((row) => row.tag) });
    }));

    router.get("/articles/by-slug/:slug", route(async (request, response) => {
      const slug = requiredText(request.params.slug, "slug", 180);
      const schema = await getSchema();
      const articles = new ItemsService("articles", { schema, accountability: null });
      const data = await articles.readByQuery({
        fields: ARTICLE_FIELDS,
        filter: { slug: { _eq: slug }, status: { _eq: "published" } },
        limit: 1,
      });
      if (!data[0]) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested article was not found");
      response.json({ data: (await withLikeState(database, [data[0]], "article_likes", "article", request.accountability?.user))[0] });
    }));

    router.get("/articles/:id", route(async (request, response) => {
      const id = routeId(request);
      const record = await database("articles").select("id", "author", "status").where({ id }).first();
      if (!record) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested article was not found");
      const user = request.accountability?.user ? String(request.accountability.user) : null;
      if (record.status !== "published" && request.accountability?.admin !== true && record.author !== user) {
        throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested article was not found");
      }
      const schema = await getSchema();
      const articles = new ItemsService("articles", { schema, accountability: null });
      const data = await articles.readOne(id, { fields: ARTICLE_FIELDS });
      response.json({ data: (await withLikeState(database, [data], "article_likes", "article", request.accountability?.user))[0] });
    }));

    router.get("/articles/:id/reviews", route(async (request, response) => {
      const userId = currentUser(request);
      const id = routeId(request);
      await ownedRecord(database, "articles", id, userId, request.accountability?.admin === true);
      const schema = await getSchema();
      const reviews = new ItemsService("article_reviews", { schema, accountability: null });
      const data = await reviews.readByQuery({
        fields: REVIEW_FIELDS,
        filter: { article: { _eq: id } },
        sort: ["created_at"],
        limit: -1,
      });
      response.json({ data });
    }));

    router.put("/profile", route(async (request, response) => {
      const userId = currentUser(request);
      const input = profileInput(request);
      if (input.avatar) await assertOwnedUploads(database, [input.avatar], userId);
      const schema = await getSchema();
      const profiles = new ItemsService("profiles", {
        schema,
        accountability: elevatedAccountability(request),
      });
      const existing = await database("profiles").select("id").where({ user: userId }).first();
      const data = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
      const id = existing
        ? await profiles.updateOne(existing.id, data)
        : await profiles.createOne({ ...data, user: userId });
      response.json({ data: { id } });
    }));

    router.post("/posts", route(async (request, response) => {
      const userId = currentUser(request);
      const input = postInput(request);
      await assertOwnedUploads(database, input.files, userId);
      if (input.author) {
        const author = await database("directus_users").select("id").where({ id: input.author, status: "active" }).first();
        if (!author) throw new EndpointError(400, "INVALID_AUTHOR", "The selected author is not active");
      }
      const schema = await getSchema();
      const accountability = elevatedAccountability(request);
      const posts = new ItemsService("posts", { schema, accountability });
      const id = await posts.createOne({
        author: input.author ?? userId,
        content: input.content,
      });
      if (input.createdAt) await database("posts").where({ id }).update({ created_at: input.createdAt });
      await replacePostFiles({ ItemsService, schema, accountability, database }, id, input.files);
      response.status(201).json({ data: { id } });
    }));

    router.patch("/posts/:id", route(async (request, response) => {
      const userId = currentUser(request);
      const id = routeId(request);
      const input = postInput(request, { partial: true });
      await ownedRecord(database, "posts", id, userId, request.accountability?.admin === true);
      await assertOwnedUploads(database, input.files, userId);
      if (input.author) {
        const author = await database("directus_users").select("id").where({ id: input.author, status: "active" }).first();
        if (!author) throw new EndpointError(400, "INVALID_AUTHOR", "The selected author is not active");
      }
      const schema = await getSchema();
      const accountability = elevatedAccountability(request);
      const posts = new ItemsService("posts", { schema, accountability });
      if (input.content !== undefined) await posts.updateOne(id, { content: input.content });
      if (input.author !== undefined || input.createdAt !== undefined) {
        await database("posts").where({ id }).update({
          ...(input.author !== undefined ? { author: input.author } : {}),
          ...(input.createdAt !== undefined ? { created_at: input.createdAt } : {}),
        });
      }
      if (input.files !== undefined) {
        await replacePostFiles({ ItemsService, schema, accountability, database }, id, input.files);
      }
      response.status(204).send();
    }));

    router.delete("/posts/:id", route(async (request, response) => {
      const userId = currentUser(request);
      const id = routeId(request);
      await ownedRecord(database, "posts", id, userId, request.accountability?.admin === true);
      const schema = await getSchema();
      const posts = new ItemsService("posts", {
        schema,
        accountability: elevatedAccountability(request),
      });
      await posts.deleteOne(id);
      response.status(204).send();
    }));

    router.post("/posts/:id/like", route(async (request, response) => {
      const userId = currentUser(request);
      const id = routeId(request);
      const exists = await database("posts").select("id").where({ id }).first();
      if (!exists) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested post was not found");
      const count = await setLike(database, "post_likes", "post", id, userId, true);
      response.json({ data: { like_count: count } });
    }));

    router.delete("/posts/:id/like", route(async (request, response) => {
      const userId = currentUser(request);
      const id = routeId(request);
      const count = await setLike(database, "post_likes", "post", id, userId, false);
      response.json({ data: { like_count: count } });
    }));

    router.post("/articles", route(async (request, response) => {
      const userId = currentUser(request);
      const input = articleInput(request);
      await assertOwnedUploads(database, storedImageIdsInMarkdown(input.body), userId);
      const schema = await getSchema();
      const articles = new ItemsService("articles", {
        schema,
        accountability: elevatedAccountability(request),
      });
      const id = await articles.createOne({
        author: userId,
        title: input.title,
        slug: input.slug,
        summary: input.summary,
        tags: input.tags,
        body: input.body,
        thumbnail: input.thumbnail ?? null,
        status: "draft",
      });
      response.status(201).json({ data: { id } });
    }));

    router.patch("/articles/:id", route(async (request, response) => {
      const userId = currentUser(request);
      const id = routeId(request);
      const input = articleInput(request, { partial: true });
      const record = await ownedRecord(
        database,
        "articles",
        id,
        userId,
        request.accountability?.admin === true,
      );
      if (request.accountability?.admin !== true && !EDITABLE_ARTICLE_STATUSES.has(record.status)) {
        throw new EndpointError(409, "ARTICLE_NOT_EDITABLE", "Only drafts, rejected, and published articles can be edited");
      }
      if (input.body !== undefined) {
        await assertOwnedUploads(
          database,
          storedImageIdsInMarkdown(input.body),
          request.accountability?.admin === true ? null : record.author,
        );
      }
      const data = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
      const schema = await getSchema();
      const articles = new ItemsService("articles", {
        schema,
        accountability: elevatedAccountability(request),
      });
      await articles.updateOne(id, data);
      response.status(204).send();
    }));

    router.delete("/articles/:id", route(async (request, response) => {
      const userId = currentUser(request);
      const id = routeId(request);
      const record = await ownedRecord(
        database,
        "articles",
        id,
        userId,
        request.accountability?.admin === true,
      );
      if (request.accountability?.admin !== true && !DELETABLE_ARTICLE_STATUSES.has(record.status)) {
        throw new EndpointError(409, "ARTICLE_NOT_DELETABLE", "Only drafts and rejected articles can be deleted");
      }
      const schema = await getSchema();
      const articles = new ItemsService("articles", {
        schema,
        accountability: elevatedAccountability(request),
      });
      await articles.deleteOne(id);
      response.status(204).send();
    }));

    router.post("/articles/:id/like", route(async (request, response) => {
      const userId = currentUser(request);
      const id = routeId(request);
      const article = await database("articles").select("id", "status").where({ id }).first();
      if (!article || article.status !== "published") {
        throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested article was not found");
      }
      const count = await setLike(database, "article_likes", "article", id, userId, true);
      response.json({ data: { like_count: count } });
    }));

    router.delete("/articles/:id/like", route(async (request, response) => {
      const userId = currentUser(request);
      const id = routeId(request);
      const count = await setLike(database, "article_likes", "article", id, userId, false);
      response.json({ data: { like_count: count } });
    }));

    router.post("/articles/:id/submit", route(async (request, response) => {
      const userId = currentUser(request);
      const id = routeId(request);
      const record = await ownedRecord(database, "articles", id, userId, false);
      if (!SUBMITTABLE_ARTICLE_STATUSES.has(record.status)) {
        throw new EndpointError(409, "ARTICLE_NOT_SUBMITTABLE", "The article cannot be submitted in its current state");
      }
      const schema = await getSchema();
      const accountability = elevatedAccountability(request);
      const articles = new ItemsService("articles", { schema, accountability });
      const reviews = new ItemsService("article_reviews", { schema, accountability });
      await database.transaction(async (transaction) => {
        await articles.fork({ knex: transaction }).updateOne(id, {
          status: "pending",
          review_comment: null,
        });
        await reviews.fork({ knex: transaction }).createOne({
          article: id,
          reviewer: userId,
          action: "submitted",
          comment: null,
        });
      });
      response.status(204).send();
    }));

    router.post("/articles/:id/review", route(async (request, response) => {
      const reviewer = requireAdmin(request);
      const id = routeId(request);
      const body = objectBody(request);
      strictKeys(body, new Set(["action", "comment"]));
      if (body.action !== "approve" && body.action !== "reject") {
        throw new EndpointError(400, "INVALID_PAYLOAD", "action must be approve or reject");
      }
      const comment = optionalText(body.comment, "comment", 2_000);
      if (body.action === "reject" && !comment) {
        throw new EndpointError(400, "INVALID_PAYLOAD", "A rejection comment is required");
      }
      const article = await database("articles").select("id", "status").where({ id }).first();
      if (!article) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested article was not found");
      if (article.status !== "pending") {
        throw new EndpointError(409, "ARTICLE_NOT_REVIEWABLE", "Only pending articles can be reviewed");
      }
      const schema = await getSchema();
      const accountability = elevatedAccountability(request);
      const articles = new ItemsService("articles", { schema, accountability });
      const reviews = new ItemsService("article_reviews", { schema, accountability });
      const approved = body.action === "approve";
      await database.transaction(async (transaction) => {
        await articles.fork({ knex: transaction }).updateOne(id, {
          status: approved ? "published" : "rejected",
          published_at: approved ? new Date() : null,
          review_comment: comment ?? null,
        });
        await reviews.fork({ knex: transaction }).createOne({
          article: id,
          reviewer,
          action: approved ? "approved" : "rejected",
          comment: comment ?? null,
        });
      });
      if (approved) {
        const publishedArticle = await database("articles as article")
          .leftJoin("directus_users as author", "article.author", "author.id")
          .leftJoin("profiles as profile", "article.author", "profile.user")
          .select(
            "article.id",
            "article.title",
            "article.slug",
            "article.body",
            "article.tags",
            "article.thumbnail",
            "article.published_at",
            "profile.display_name",
            "author.first_name",
            "author.last_name",
          )
          .where("article.id", id)
          .first();
        if (publishedArticle) {
          try {
            await sendPublishedArticleToDiscord(publishedArticle, logger);
          } catch (error) {
            logger?.warn(
              { articleId: id, reason: error instanceof Error ? error.message : "Unknown webhook error" },
              "Published article Discord notification failed",
            );
          }
        }
      }
      response.status(204).send();
    }));
  },
};
