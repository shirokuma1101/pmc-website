import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";

const UPLOAD_FOLDER_ID = "0ebf4c62-1014-4a72-99db-2b1198c59f1f";
const WORLD_DOWNLOAD_FOLDER_ID = "a5c3b26e-2b4b-4a2e-9f65-37b925f0cdea";
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
const MAP_MARKER_FIELDS = [
  "id", "name", "description", "world", "x", "y", "z", "icon", "color",
  "image", "related_type", "related_id",
  "author", "created_at", "updated_at",
];

let mapMarkerTablePromise;
let mapPathTablePromise;

function ensureMapMarkerTable(database) {
  mapMarkerTablePromise ??= database.schema.hasTable("minecraft_map_markers").then(async (exists) => {
    if (!exists) await database.schema.createTable("minecraft_map_markers", (table) => {
      table.uuid("id").primary();
      table.uuid("author").notNullable().references("id").inTable("directus_users").onDelete("CASCADE");
      table.string("name", 80).notNullable();
      table.text("description").notNullable().defaultTo("");
      table.string("world", 100).notNullable();
      table.double("x").notNullable();
      table.double("y").nullable();
      table.double("z").notNullable();
      table.string("icon", 32).notNullable().defaultTo("place");
      table.string("color", 7).notNullable().defaultTo("#d15d36");
      table.uuid("image").nullable().references("id").inTable("directus_files").onDelete("SET NULL");
      table.string("related_type", 16).nullable();
      table.uuid("related_id").nullable();
      table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(database.fn.now());
      table.timestamp("updated_at", { useTz: true }).nullable();
      table.index(["world"]);
      table.index(["author"]);
    });
    if (!await database.schema.hasColumn("minecraft_map_markers", "color")) {
      await database.schema.alterTable("minecraft_map_markers", (table) => {
        table.string("color", 7).notNullable().defaultTo("#d15d36");
      });
    }
    if (!await database.schema.hasColumn("minecraft_map_markers", "image")) {
      await database.schema.alterTable("minecraft_map_markers", (table) => {
        table.uuid("image").nullable().references("id").inTable("directus_files").onDelete("SET NULL");
        table.string("related_type", 16).nullable();
        table.uuid("related_id").nullable();
      });
    }
  }).catch((error) => {
    mapMarkerTablePromise = undefined;
    throw error;
  });
  return mapMarkerTablePromise;
}

function markerInput(request, { partial = false } = {}) {
  const body = objectBody(request);
  strictKeys(body, new Set([
    "name", "description", "world", "x", "y", "z", "icon", "color",
    "image", "related_type", "related_id",
  ]));
  const input = {};
  const textField = (key, maximum, required = false) => {
    if (body[key] !== undefined) input[key] = requiredText(body[key], key, maximum);
    else if (!partial && required) throw new EndpointError(400, "INVALID_PAYLOAD", `${key} is required`);
  };
  textField("name", 80, true);
  textField("world", 100, true);
  if (body.description !== undefined) input.description = optionalText(body.description, "description", 1_000) ?? "";
  else if (!partial) input.description = "";
  if (body.icon !== undefined) input.icon = requiredText(body.icon, "icon", 32);
  else if (!partial) input.icon = "place";
  if (body.color !== undefined) {
    const color = requiredText(body.color, "color", 7).toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) {
      throw new EndpointError(400, "INVALID_PAYLOAD", "color must be a hexadecimal color");
    }
    input.color = color;
  } else if (!partial) input.color = "#d15d36";
  for (const key of ["image", "related_id"]) {
    if (body[key] === null) input[key] = null;
    else if (body[key] !== undefined) {
      const value = String(body[key]);
      if (!UUID_PATTERN.test(value)) throw new EndpointError(400, "INVALID_PAYLOAD", `${key} is invalid`);
      input[key] = value;
    } else if (!partial) input[key] = null;
  }
  if (body.related_type === null || body.related_type === "") input.related_type = null;
  else if (body.related_type !== undefined) {
    if (body.related_type !== "post" && body.related_type !== "article") {
      throw new EndpointError(400, "INVALID_PAYLOAD", "related_type is invalid");
    }
    input.related_type = body.related_type;
  } else if (!partial) input.related_type = null;
  for (const key of ["x", "z"]) {
    if (body[key] === undefined && !partial) throw new EndpointError(400, "INVALID_PAYLOAD", `${key} is required`);
    if (body[key] !== undefined) {
      const value = Number(body[key]);
      if (!Number.isFinite(value) || Math.abs(value) > 30_000_000) {
        throw new EndpointError(400, "INVALID_PAYLOAD", `${key} is invalid`);
      }
      input[key] = value;
    }
  }
  if (body.y !== undefined) {
    if (body.y === null) input.y = null;
    else {
      const value = Number(body.y);
      if (!Number.isFinite(value) || value < -2048 || value > 2048) {
        throw new EndpointError(400, "INVALID_PAYLOAD", "y is invalid");
      }
      input.y = value;
    }
  } else if (!partial) input.y = null;
  if (partial && Object.keys(input).length === 0) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "At least one field is required");
  }
  return input;
}

async function assertMarkerMediaReference(database, user, input) {
  if (!input.image) {
    if (input.related_type || input.related_id) {
      throw new EndpointError(400, "INVALID_PAYLOAD", "Related content requires an image");
    }
    return;
  }
  const file = await database("directus_files").select("id", "uploaded_by", "type").where({ id: input.image }).first();
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new EndpointError(400, "INVALID_IMAGE", "The selected image is invalid");
  }
  if (!input.related_type && String(file.uploaded_by) !== user) {
    throw new EndpointError(403, "IMAGE_NOT_OWNED", "The selected image is not yours");
  }
  if (Boolean(input.related_type) !== Boolean(input.related_id)) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "Related content is incomplete");
  }
  if (input.related_type === "post") {
    const relation = await database("posts as post")
      .innerJoin("posts_files as files", "post.id", "files.posts_id")
      .where({ "post.id": input.related_id, "post.author": user, "files.directus_files_id": input.image }).first();
    if (!relation) throw new EndpointError(403, "INVALID_MEDIA_LINK", "The image does not belong to your post");
  }
  if (input.related_type === "article") {
    const article = await database("articles").select("thumbnail", "body")
      .where({ id: input.related_id, status: "published" }).first();
    const bodyHasImage = String(article?.body || "").includes(`/pmc-website/assets/${input.image}`);
    if (!article || (String(article.thumbnail || "") !== input.image && !bodyHasImage)) {
      throw new EndpointError(403, "INVALID_MEDIA_LINK", "The image does not belong to the published article");
    }
  }
}

function publicMarker(row) {
  return {
    ...Object.fromEntries(MAP_MARKER_FIELDS.map((field) => [field, row[field]])),
    author: { id: row.author, display_name: row.display_name || "Member" },
    related_title: row.related_type === "article" ? row.related_article_title : row.related_post_content,
    related_href: row.related_type === "article" && row.related_article_slug
      ? `/articles/${row.related_article_slug}`
      : row.related_type === "post" ? `/timeline#post-${row.related_id}` : null,
  };
}

function markerQuery(database) {
  return database("minecraft_map_markers as marker")
    .leftJoin("profiles as profile", "marker.author", "profile.user")
    .leftJoin("posts as related_post", function joinPost() {
      this.on("marker.related_id", "=", "related_post.id").andOnVal("marker.related_type", "=", "post");
    })
    .leftJoin("articles as related_article", function joinArticle() {
      this.on("marker.related_id", "=", "related_article.id").andOnVal("marker.related_type", "=", "article");
    })
    .select(
      "marker.*", "profile.display_name", "related_post.content as related_post_content",
      "related_article.title as related_article_title", "related_article.slug as related_article_slug",
    );
}

function ensureMapPathTable(database) {
  mapPathTablePromise ??= database.schema.hasTable("minecraft_map_paths").then(async (exists) => {
    if (!exists) await database.schema.createTable("minecraft_map_paths", (table) => {
      table.uuid("id").primary();
      table.uuid("author").notNullable().references("id").inTable("directus_users").onDelete("CASCADE");
      table.string("name", 80).notNullable();
      table.text("description").notNullable().defaultTo("");
      table.string("world", 100).notNullable();
      table.string("kind", 16).notNullable();
      table.string("color", 7).notNullable();
      table.integer("weight").notNullable().defaultTo(4);
      table.boolean("dashed").notNullable().defaultTo(false);
      table.jsonb("points").notNullable();
      table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(database.fn.now());
      table.timestamp("updated_at", { useTz: true }).nullable();
      table.index(["world"]);
      table.index(["author"]);
    });
  }).catch((error) => {
    mapPathTablePromise = undefined;
    throw error;
  });
  return mapPathTablePromise;
}

function pathInput(request, { partial = false } = {}) {
  const body = objectBody(request);
  strictKeys(body, new Set(["name", "description", "world", "kind", "color", "weight", "dashed", "points"]));
  const input = {};
  for (const [key, maximum] of [["name", 80], ["world", 100]]) {
    if (body[key] !== undefined) input[key] = requiredText(body[key], key, maximum);
    else if (!partial) throw new EndpointError(400, "INVALID_PAYLOAD", `${key} is required`);
  }
  if (body.description !== undefined) input.description = optionalText(body.description, "description", 1_000) ?? "";
  else if (!partial) input.description = "";
  if (body.kind !== undefined) {
    if (!["road", "railway", "other"].includes(body.kind)) throw new EndpointError(400, "INVALID_PAYLOAD", "kind is invalid");
    input.kind = body.kind;
  } else if (!partial) throw new EndpointError(400, "INVALID_PAYLOAD", "kind is required");
  if (body.color !== undefined) {
    const color = requiredText(body.color, "color", 7).toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) throw new EndpointError(400, "INVALID_PAYLOAD", "color is invalid");
    input.color = color;
  } else if (!partial) throw new EndpointError(400, "INVALID_PAYLOAD", "color is required");
  if (body.weight !== undefined) {
    const weight = Number(body.weight);
    if (!Number.isInteger(weight) || weight < 1 || weight > 12) throw new EndpointError(400, "INVALID_PAYLOAD", "weight is invalid");
    input.weight = weight;
  } else if (!partial) input.weight = 4;
  if (body.dashed !== undefined) {
    if (typeof body.dashed !== "boolean") throw new EndpointError(400, "INVALID_PAYLOAD", "dashed is invalid");
    input.dashed = body.dashed;
  } else if (!partial) input.dashed = false;
  if (body.points !== undefined) {
    if (!Array.isArray(body.points) || body.points.length < 2 || body.points.length > 500) {
      throw new EndpointError(400, "INVALID_PAYLOAD", "points must contain 2 to 500 points");
    }
    const points = body.points.map((point) => {
      if (!point || typeof point !== "object" || Array.isArray(point) || Object.keys(point).some((key) => key !== "x" && key !== "z")) {
        throw new EndpointError(400, "INVALID_PAYLOAD", "point is invalid");
      }
      const x = Number(point.x);
      const z = Number(point.z);
      if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 30_000_000 || Math.abs(z) > 30_000_000) {
        throw new EndpointError(400, "INVALID_PAYLOAD", "point is invalid");
      }
      return { x, z };
    });
    // Knex treats JavaScript arrays as PostgreSQL array literals. Serialize explicitly for jsonb.
    input.points = JSON.stringify(points);
  } else if (!partial) throw new EndpointError(400, "INVALID_PAYLOAD", "points is required");
  if (partial && Object.keys(input).length === 0) throw new EndpointError(400, "INVALID_PAYLOAD", "At least one field is required");
  return input;
}

function publicPath(row) {
  const points = typeof row.points === "string" ? JSON.parse(row.points) : row.points;
  return {
    id: row.id, name: row.name, description: row.description, world: row.world,
    kind: row.kind, color: row.color, weight: row.weight, dashed: row.dashed, points,
    author: { id: row.author, display_name: row.display_name || "Member" },
    created_at: row.created_at, updated_at: row.updated_at,
  };
}

function pathQuery(database) {
  return database("minecraft_map_paths as path")
    .leftJoin("profiles as profile", "path.author", "profile.user")
    .select("path.*", "profile.display_name");
}

export function storedImageIdsInMarkdown(markdown) {
  const ids = new Set();
  for (const match of String(markdown ?? "").matchAll(STORED_ASSET_PATTERN)) {
    ids.add(match[1].toLowerCase());
  }
  return [...ids];
}

export function newlyReferencedImageIds(previousMarkdown, nextMarkdown) {
  const previousIds = new Set(storedImageIdsInMarkdown(previousMarkdown));
  return storedImageIdsInMarkdown(nextMarkdown).filter((id) => !previousIds.has(id));
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
const DEFAULT_WORLDS_CONTENT = {
  markdown: "過去に活動したMinecraftワールドをダウンロードできます。",
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
  "published_version_title",
  "published_version_slug",
  "published_version_summary",
  "published_version_tags",
  "published_version_body",
  "published_version_thumbnail.id",
  "published_version_thumbnail.description",
  "published_version_thumbnail.type",
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
  "xbox_gamertag",
  "created_at",
  "updated_at",
  "avatar.id",
  "avatar.description",
  "avatar.type",
  "user.id",
];
const ORGANIZATION_ROLES = new Set(["master", "administrator", "server_owner", "team_member", "trainee"]);

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

export function encodedDownloadFilename(value) {
  return encodeURIComponent(String(value ?? "world-download"))
    .replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
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

function organizationInput(request, { identity = false } = {}) {
  const body = objectBody(request);
  const keys = new Set(["role", "team", "parent_id", "xbox_gamertag", "avatar", "group_id"]);
  if (identity) for (const key of ["display_name", "bio", "user_id"]) keys.add(key);
  strictKeys(body, keys);
  if (!ORGANIZATION_ROLES.has(body.role)) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "role is invalid");
  }
  const parent = body.parent_id == null || body.parent_id === "" ? null : uuid(body.parent_id, "parent_id");
  const input = {
    organization_role: body.role,
    organization_team: optionalText(body.team ?? "", "team", 80),
    organization_parent: parent,
    xbox_gamertag: optionalText(body.xbox_gamertag ?? "", "xbox_gamertag", 50) ?? "",
    ...(body.avatar !== undefined ? { avatar: body.avatar === null ? null : uuid(body.avatar, "avatar") } : {}),
    organization_group: body.group_id == null || body.group_id === "" ? null : uuid(body.group_id, "group_id"),
  };
  if (identity) {
    if (body.display_name !== undefined) input.display_name = requiredText(body.display_name, "display_name", 80);
    if (body.bio !== undefined) input.bio = optionalText(body.bio, "bio", 2_000) ?? "";
    if (body.user_id === null || body.user_id === "") input.user = null;
    else if (body.user_id !== undefined) input.user = uuid(body.user_id, "user_id");
  }
  return input;
}

let organizationMembersTablePromise;
function ensureOrganizationMembersTable(database) {
  organizationMembersTablePromise ??= database.schema.hasTable("organization_members").then(async (exists) => {
    if (!exists) {
      await database.schema.createTable("organization_members", (table) => {
        table.uuid("id").primary();
        table.uuid("user").unique().nullable().references("id").inTable("directus_users").onDelete("SET NULL");
        table.string("display_name", 80).notNullable();
        table.text("bio").nullable();
        table.uuid("avatar").nullable().references("id").inTable("directus_files").onDelete("SET NULL");
        table.string("organization_role", 32).notNullable().defaultTo("trainee").index();
        table.string("organization_team", 80).nullable();
        table.uuid("organization_parent").nullable().index();
        table.string("xbox_gamertag", 50).nullable();
        table.timestamp("created_at").notNullable().defaultTo(database.fn.now());
        table.timestamp("updated_at").nullable();
      });
      const legacyMembers = await database("profiles").whereNotNull("organization_role").select(
        "id", "user", "display_name", "bio", "avatar", "organization_role", "organization_team",
        "organization_parent", "xbox_gamertag", "created_at", "updated_at",
      );
      for (const member of legacyMembers) {
        await database("organization_members").insert({
          ...member,
        }).onConflict("id").ignore();
      }
    }
    if (!await database.schema.hasColumn("organization_members", "organization_group")) {
      await database.schema.alterTable("organization_members", (table) => table.uuid("organization_group").nullable().index());
    }
    if (!await database.schema.hasColumn("organization_members", "xbox_gamertag")) {
      await database.schema.alterTable("organization_members", (table) => table.string("xbox_gamertag", 50).nullable());
      await database.raw('UPDATE organization_members AS member SET xbox_gamertag = profile.xbox_gamertag FROM profiles AS profile WHERE profile.id = member.id AND profile.xbox_gamertag IS NOT NULL');
    }
    if (await database.schema.hasColumn("organization_members", "social_links")) {
      await database.schema.alterTable("organization_members", (table) => table.dropColumn("social_links"));
    }
    for (const field of ["favorite_block", "favorite_mob"]) {
      if (await database.schema.hasColumn("organization_members", field)) {
        await database.schema.alterTable("organization_members", (table) => table.dropColumn(field));
      }
    }
  });
  return organizationMembersTablePromise;
}

let organizationLayoutTablePromise;
const ORGANIZATION_GROUP_COLORS = new Set(["blue", "teal", "gold", "violet", "rose", "slate", "green", "cyan", "indigo", "orange", "plum"]);
function ensureOrganizationLayoutTable(database) {
  organizationLayoutTablePromise ??= (async () => {
    await ensureOrganizationMembersTable(database);
    if (!await database.schema.hasTable("organization_layout")) {
      await database.schema.createTable("organization_layout", (table) => {
        table.string("id", 32).primary();
        table.jsonb("sections").notNullable();
        table.timestamp("updated_at").nullable();
      });
    }
    let record = await database("organization_layout").where({ id: "default" }).first();
    if (!record) {
      const group = (label, caption, color) => ({ id: crypto.randomUUID(), label, caption, color });
      const master = group("マスター", "全体方針", "gold");
      const administrator = group("管理者", "企画・サポート", "violet");
      const owner = group("鯖主", "技術・サーバー管理", "teal");
      const trainee = group("みならい", "活動準備中", "rose");
      const teams = await database("organization_members").distinct("organization_team as name").where({ organization_role: "team_member" }).whereNotNull("organization_team").whereNot("organization_team", "");
      const teamGroups = teams.map((team) => group(team.name, "活動チーム", "blue"));
      const sections = [
        { id: crypto.randomUUID(), title: "運営管理", description: "方針、運営、技術を担う役割", groups: [master, administrator, owner] },
        { id: crypto.randomUUID(), title: "チーム", description: "活動分野ごとの所属", groups: teamGroups },
        { id: crypto.randomUUID(), title: "みならい", description: "活動を始めるメンバー", groups: [trainee] },
      ];
      await database("organization_layout").insert({ id: "default", sections: JSON.stringify(sections) });
      for (const [role, groupId] of Object.entries({ master: master.id, administrator: administrator.id, server_owner: owner.id, trainee: trainee.id })) {
        await database("organization_members").where({ organization_role: role }).update({ organization_group: groupId });
      }
      for (const teamGroup of teamGroups) await database("organization_members").where({ organization_role: "team_member", organization_team: teamGroup.label }).update({ organization_group: teamGroup.id });
      record = { sections };
    }
    const storedSections = Array.isArray(record.sections) ? record.sections : JSON.parse(record.sections);
    const sections = storedSections.map((section) => section.title === "運営・担当" ? { ...section, title: "運営管理" } : section);
    if (sections.some((section, index) => section.title !== storedSections[index]?.title)) {
      await database("organization_layout").where({ id: "default" }).update({ sections: JSON.stringify(sections), updated_at: new Date() });
    }
    return sections;
  })();
  return organizationLayoutTablePromise;
}

let profileEntitlementsTablePromise;
const SUPPORTER_TIER_PRIORITY = new Map([
  ["supporter", 1],
  ["basic", 2],
  ["standard", 3],
  ["premium", 4],
]);

function effectiveSupporterTier(entitlements, now = new Date()) {
  let effective;
  for (const entitlement of entitlements) {
    if (entitlement.valid_until && new Date(entitlement.valid_until) <= now) continue;
    const tier = SUPPORTER_TIER_PRIORITY.has(entitlement.variant) ? entitlement.variant : "supporter";
    if (!effective || SUPPORTER_TIER_PRIORITY.get(tier) > SUPPORTER_TIER_PRIORITY.get(effective)) effective = tier;
  }
  return effective;
}

function ensureProfileEntitlementsTable(database) {
  profileEntitlementsTablePromise ??= (async () => {
    await ensureOrganizationMembersTable(database);
    if (!await database.schema.hasTable("profile_entitlements")) {
      await database.schema.createTable("profile_entitlements", (table) => {
        table.uuid("id").primary();
        table.uuid("member").notNullable().references("id").inTable("organization_members").onDelete("CASCADE").index();
        table.string("feature", 64).notNullable().index();
        table.string("source", 32).notNullable().index();
        table.string("variant", 32).nullable().index();
        table.string("status", 24).notNullable().defaultTo("active").index();
        table.timestamp("valid_until", { useTz: true }).nullable().index();
        table.string("external_reference", 255).nullable();
        table.timestamp("created_at").notNullable().defaultTo(database.fn.now());
        table.timestamp("updated_at").nullable();
        table.unique(["member", "feature", "source"]);
      });
    }
    if (!await database.schema.hasColumn("profile_entitlements", "variant")) {
      await database.schema.alterTable("profile_entitlements", (table) => {
        table.string("variant", 32).nullable().index();
      });
    }
  })();
  return profileEntitlementsTablePromise;
}

function organizationLayoutInput(request) {
  const body = objectBody(request);
  strictKeys(body, new Set(["sections"]));
  if (!Array.isArray(body.sections) || body.sections.length > 20) throw new EndpointError(400, "INVALID_PAYLOAD", "sections is invalid");
  const ids = new Set();
  return body.sections.map((section) => {
    if (!section || typeof section !== "object" || Array.isArray(section)) throw new EndpointError(400, "INVALID_PAYLOAD", "section is invalid");
    strictKeys(section, new Set(["id", "title", "description", "groups"]));
    const id = uuid(section.id, "section.id");
    if (ids.has(id)) throw new EndpointError(400, "INVALID_PAYLOAD", "duplicate id");
    ids.add(id);
    if (!Array.isArray(section.groups) || section.groups.length > 50) throw new EndpointError(400, "INVALID_PAYLOAD", "groups is invalid");
    const groups = section.groups.map((group) => {
      if (!group || typeof group !== "object" || Array.isArray(group)) throw new EndpointError(400, "INVALID_PAYLOAD", "group is invalid");
      strictKeys(group, new Set(["id", "label", "caption", "color"]));
      const groupId = uuid(group.id, "group.id");
      if (ids.has(groupId)) throw new EndpointError(400, "INVALID_PAYLOAD", "duplicate id");
      ids.add(groupId);
      const color = group.color == null ? undefined : optionalText(group.color, "group.color", 16);
      if (color && !ORGANIZATION_GROUP_COLORS.has(color)) throw new EndpointError(400, "INVALID_PAYLOAD", "group.color is invalid");
      return { id: groupId, label: requiredText(group.label, "group.label", 80), caption: optionalText(group.caption ?? "", "group.caption", 80), ...(color ? { color } : {}) };
    });
    return { id, title: requiredText(section.title, "section.title", 80), description: optionalText(section.description ?? "", "section.description", 200), groups };
  });
}

let organizationTeamsTablePromise;
function ensureOrganizationTeamsTable(database) {
  organizationTeamsTablePromise ??= database.schema.hasTable("organization_teams").then(async (exists) => {
    await ensureOrganizationMembersTable(database);
    if (!exists) {
      await database.schema.createTable("organization_teams", (table) => {
        table.string("name", 80).primary();
        table.integer("sort").notNullable().defaultTo(0);
        table.timestamp("created_at").notNullable().defaultTo(database.fn.now());
      });
    }
    const existingTeams = await database("organization_members")
      .distinct("organization_team as name")
      .where({ organization_role: "team_member" })
      .whereNotNull("organization_team")
      .whereNot("organization_team", "");
    for (const team of existingTeams) {
      await database("organization_teams").insert({ name: team.name }).onConflict("name").ignore();
    }
  });
  return organizationTeamsTablePromise;
}

function teamName(request) {
  const body = objectBody(request);
  strictKeys(body, new Set(["name"]));
  return requiredText(body.name, "name", 80);
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

export function shouldNotifyDiscordForArticleApproval(article, notifyOnUpdate) {
  const isPublishedArticleUpdate = article?.published_version_title != null;
  if (!isPublishedArticleUpdate) return true;
  return String(notifyOnUpdate ?? "").trim().toLowerCase() === "true";
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

export function publicArticleView(article) {
  if (!article?.published_version_title) return article;
  return {
    ...article,
    title: article.published_version_title,
    slug: article.published_version_slug,
    summary: article.published_version_summary,
    tags: article.published_version_tags,
    body: article.published_version_body,
    thumbnail: article.published_version_thumbnail,
    status: "published",
  };
}

async function assertArticleSlugAvailable(database, slug, articleId = null) {
  if (slug === undefined) return;
  const query = database("articles")
    .select("id")
    .where((builder) => builder.where({ slug }).orWhere({ published_version_slug: slug }));
  if (articleId) query.whereNot({ id: articleId });
  if (await query.first()) {
    throw new EndpointError(409, "SLUG_ALREADY_EXISTS", "The article slug is already in use");
  }
}

function publishedVersionSnapshot(article) {
  return {
    published_version_title: article.title,
    published_version_slug: article.slug,
    published_version_summary: article.summary ?? "",
    published_version_tags: article.tags ?? [],
    published_version_body: article.body ?? "",
    published_version_thumbnail: article.thumbnail ?? null,
  };
}

const CLEAR_PUBLISHED_VERSION = {
  published_version_title: null,
  published_version_slug: null,
  published_version_summary: null,
  published_version_tags: null,
  published_version_body: null,
  published_version_thumbnail: null,
};

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
  strictKeys(body, new Set(["title", "slug", "summary", "tags", "body", "author_id", "created_at", "published_at"]));
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
  const author = body.author_id === undefined ? undefined : uuid(body.author_id, "author_id");
  const createdAt = body.created_at === undefined ? undefined : timestamp(body.created_at, "created_at");
  const publishedAt = body.published_at === undefined ? undefined : timestamp(body.published_at, "published_at");
  if ((author !== undefined || createdAt !== undefined || publishedAt !== undefined)
    && request.accountability?.admin !== true) {
    throw new EndpointError(403, "ADMIN_REQUIRED", "Only administrators can change article metadata");
  }
  if (partial && [title, slug, summary, tags, articleBody, thumbnail, author, createdAt, publishedAt]
    .every((value) => value === undefined)) {
    throw new EndpointError(400, "INVALID_PAYLOAD", "At least one editable field is required");
  }
  return { title, slug, summary, tags, body: articleBody, thumbnail, author, createdAt, publishedAt };
}

function profileInput(request) {
  const body = objectBody(request);
  strictKeys(body, new Set(["display_name", "bio", "xbox_gamertag", "avatar"]));
  return {
    display_name: requiredText(body.display_name, "display_name", 80),
    bio: optionalText(body.bio, "bio", 1_000) ?? "",
    xbox_gamertag: optionalText(body.xbox_gamertag, "xbox_gamertag", 50) ?? "",
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

    router.get("/worlds", route(async (request, response) => {
      currentUser(request);
      const [page, files] = await Promise.all([
        database("site_pages").select("content", "updated_at").where({ id: "worlds" }).first(),
        database("directus_files")
          .select("id", "filename_download", "description", "uploaded_on")
          .where({ folder: WORLD_DOWNLOAD_FOLDER_ID })
          .orderBy("uploaded_on", "desc"),
      ]);
      response.json({
        data: {
          content: page?.content ?? DEFAULT_WORLDS_CONTENT,
          updated_at: page?.updated_at ?? null,
          files,
        },
      });
    }));

    router.put("/worlds", route(async (request, response) => {
      requireAdmin(request);
      const body = objectBody(request);
      strictKeys(body, new Set(["content"]));
      const content = aboutContent(body.content);
      await database("site_pages")
        .insert({ id: "worlds", content: JSON.stringify(content), updated_at: new Date() })
        .onConflict("id")
        .merge(["content", "updated_at"]);
      response.json({ data: { content } });
    }));

    router.get("/worlds/:id/download", route(async (request, response) => {
      currentUser(request);
      const id = routeId(request);
      const file = await database("directus_files")
        .select("id", "filename_download")
        .where({ id, folder: WORLD_DOWNLOAD_FOLDER_ID })
        .first();
      if (!file) {
        throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested world file was not found");
      }
      const schema = await getSchema();
      const assets = new AssetsService({ schema, accountability: null });
      const asset = await assets.getAsset(id, undefined, undefined, true);
      const encodedName = encodedDownloadFilename(file.filename_download);
      response.setHeader("Content-Type", asset.file.type || "application/octet-stream");
      response.setHeader("Content-Length", asset.stat.size);
      response.setHeader("Content-Disposition", `attachment; filename="world-download"; filename*=UTF-8''${encodedName}`);
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      const stream = await asset.stream();
      await new Promise((resolve, reject) => {
        stream.once("error", reject);
        response.once("finish", resolve);
        response.once("close", resolve);
        stream.pipe(response);
      });
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

    router.get("/admin/authors", route(async (request, response) => {
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

    router.get("/map-markers", route(async (request, response) => {
      await ensureMapMarkerTable(database);
      const world = optionalText(request.query?.world, "world", 100);
      const query = markerQuery(database).orderBy("marker.created_at", "asc");
      if (world) query.where("marker.world", world);
      response.json({ data: (await query).map(publicMarker) });
    }));

    router.get("/map-marker-media-options", route(async (request, response) => {
      const user = currentUser(request);
      const posts = await database("posts as post")
        .innerJoin("posts_files as files", "post.id", "files.posts_id")
        .select("post.id", "post.content", "files.directus_files_id as image_id", "files.sort")
        .where("post.author", user).orderBy("post.created_at", "desc").limit(200);
      const articles = await database("articles")
        .select("id", "title", "slug", "thumbnail", "body")
        .where({ status: "published" }).orderBy("published_at", "desc");
      const options = posts.map((post) => ({
        key: `post:${post.id}:${post.image_id}`,
        image_id: post.image_id,
        related_type: "post",
        related_id: post.id,
        label: `投稿: ${String(post.content).slice(0, 45)}${String(post.content).length > 45 ? "…" : ""}`,
        href: `/timeline#post-${post.id}`,
      }));
      for (const article of articles) {
        const ids = new Set(article.thumbnail ? [String(article.thumbnail)] : []);
        for (const match of String(article.body || "").matchAll(STORED_ASSET_PATTERN)) ids.add(match[1].toLowerCase());
        let index = 0;
        for (const imageId of ids) {
          index += 1;
          options.push({
            key: `article:${article.id}:${imageId}`,
            image_id: imageId,
            related_type: "article",
            related_id: article.id,
            label: `記事: ${article.title}（画像${index}）`,
            href: `/articles/${article.slug}`,
          });
        }
      }
      response.json({ data: options });
    }));

    router.post("/map-markers", route(async (request, response) => {
      const author = currentUser(request);
      await ensureMapMarkerTable(database);
      const input = markerInput(request);
      await assertMarkerMediaReference(database, author, input);
      const marker = { id: randomUUID(), author, ...input };
      await database("minecraft_map_markers").insert(marker);
      const row = await markerQuery(database).where("marker.id", marker.id).first();
      response.status(201).json({ data: publicMarker(row) });
    }));

    router.patch("/map-markers/:id", route(async (request, response) => {
      const user = currentUser(request);
      await ensureMapMarkerTable(database);
      const id = routeId(request);
      const record = await database("minecraft_map_markers").select("author").where({ id }).first();
      if (!record) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested marker was not found");
      if (request.accountability?.admin !== true && String(record.author) !== user) {
        throw new EndpointError(403, "FORBIDDEN", "You cannot edit this marker");
      }
      const input = markerInput(request, { partial: true });
      const existing = await database("minecraft_map_markers").select("image", "related_type", "related_id").where({ id }).first();
      await assertMarkerMediaReference(database, String(record.author), { ...existing, ...input });
      await database("minecraft_map_markers").where({ id }).update({ ...input, updated_at: new Date() });
      const row = await markerQuery(database).where("marker.id", id).first();
      response.json({ data: publicMarker(row) });
    }));

    router.delete("/map-markers/:id", route(async (request, response) => {
      const user = currentUser(request);
      await ensureMapMarkerTable(database);
      const id = routeId(request);
      const record = await database("minecraft_map_markers").select("author").where({ id }).first();
      if (!record) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested marker was not found");
      if (request.accountability?.admin !== true && String(record.author) !== user) {
        throw new EndpointError(403, "FORBIDDEN", "You cannot delete this marker");
      }
      await database("minecraft_map_markers").where({ id }).delete();
      response.status(204).send();
    }));

    router.get("/map-paths", route(async (request, response) => {
      await ensureMapPathTable(database);
      const world = optionalText(request.query?.world, "world", 100);
      const query = pathQuery(database).orderBy("path.created_at", "asc");
      if (world) query.where("path.world", world);
      response.json({ data: (await query).map(publicPath) });
    }));

    router.post("/map-paths", route(async (request, response) => {
      const author = currentUser(request);
      await ensureMapPathTable(database);
      const path = { id: randomUUID(), author, ...pathInput(request) };
      await database("minecraft_map_paths").insert(path);
      response.status(201).json({ data: publicPath(await pathQuery(database).where("path.id", path.id).first()) });
    }));

    router.patch("/map-paths/:id", route(async (request, response) => {
      const user = currentUser(request);
      await ensureMapPathTable(database);
      const id = routeId(request);
      const record = await database("minecraft_map_paths").select("author").where({ id }).first();
      if (!record) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested path was not found");
      if (request.accountability?.admin !== true && String(record.author) !== user) {
        throw new EndpointError(403, "FORBIDDEN", "You cannot edit this path");
      }
      await database("minecraft_map_paths").where({ id }).update({ ...pathInput(request, { partial: true }), updated_at: new Date() });
      response.json({ data: publicPath(await pathQuery(database).where("path.id", id).first()) });
    }));

    router.delete("/map-paths/:id", route(async (request, response) => {
      const user = currentUser(request);
      await ensureMapPathTable(database);
      const id = routeId(request);
      const record = await database("minecraft_map_paths").select("author").where({ id }).first();
      if (!record) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested path was not found");
      if (request.accountability?.admin !== true && String(record.author) !== user) {
        throw new EndpointError(403, "FORBIDDEN", "You cannot delete this path");
      }
      await database("minecraft_map_paths").where({ id }).delete();
      response.status(204).send();
    }));

    router.get("/organization", route(async (_request, response) => {
      await Promise.all([ensureOrganizationLayoutTable(database), ensureProfileEntitlementsTable(database)]);
      const rows = await database("organization_members as member")
        .leftJoin("directus_users as users", "users.id", "member.user")
        .leftJoin("profiles as profile", "profile.user", "member.user")
        .where((query) => query.whereNull("member.user").orWhere("users.status", "active"))
        .select(
          "member.id as profile_id", "member.user as user_id", "member.display_name", "member.bio",
          "profile.display_name as account_display_name", "profile.bio as account_bio", "profile.avatar as account_avatar", "profile.xbox_gamertag as account_xbox_gamertag",
          "member.avatar", "member.organization_role", "member.organization_team",
          "member.organization_parent", "member.xbox_gamertag", "member.organization_group",
        )
        .orderBy("member.display_name", "asc");
      const entitlements = await database("profile_entitlements").select("member", "variant", "valid_until").where({ feature: "profile_highlight", status: "active" });
      const entitlementsByMember = new Map();
      for (const entitlement of entitlements) {
        const member = String(entitlement.member);
        entitlementsByMember.set(member, [...(entitlementsByMember.get(member) ?? []), entitlement]);
      }
      response.json({ data: rows.map((row) => ({
        profile_id: row.profile_id,
        user_id: row.user_id,
        display_name: row.user_id ? row.account_display_name || row.display_name : row.display_name,
        bio: row.user_id ? row.account_bio ?? "" : row.bio ?? "",
        xbox_gamertag: row.user_id ? row.account_xbox_gamertag ?? "" : row.xbox_gamertag ?? "",
        avatar: row.user_id ? row.account_avatar ?? null : row.avatar ?? null,
        role: row.organization_role,
        team: row.organization_team ?? "",
        parent_id: row.organization_parent ?? null,
        group_id: row.organization_group ?? null,
        highlighted: Boolean(effectiveSupporterTier(entitlementsByMember.get(String(row.profile_id)) ?? [])),
        supporterTier: effectiveSupporterTier(entitlementsByMember.get(String(row.profile_id)) ?? []) ?? null,
      })) });
    }));

    router.get("/organization/layout", route(async (_request, response) => {
      response.json({ data: await ensureOrganizationLayoutTable(database) });
    }));

    router.put("/organization/layout", route(async (request, response) => {
      requireAdmin(request);
      await ensureOrganizationLayoutTable(database);
      const sections = organizationLayoutInput(request);
      const groupIds = sections.flatMap((section) => section.groups.map((group) => group.id));
      await database.transaction(async (transaction) => {
        await transaction("organization_layout").where({ id: "default" }).update({ sections: JSON.stringify(sections), updated_at: new Date() });
        if (groupIds.length) await transaction("organization_members").whereNotNull("organization_group").whereNotIn("organization_group", groupIds).update({ organization_group: null, updated_at: new Date() });
        else await transaction("organization_members").whereNotNull("organization_group").update({ organization_group: null, updated_at: new Date() });
      });
      organizationLayoutTablePromise = Promise.resolve(sections);
      response.json({ data: sections });
    }));

    router.get("/organization/accounts", route(async (request, response) => {
      requireAdmin(request);
      await ensureOrganizationMembersTable(database);
      const accounts = await database("directus_users as users")
        .leftJoin("profiles as profile", "profile.user", "users.id")
        .leftJoin("organization_members as member", "member.user", "users.id")
        .where("users.status", "active")
        .select("users.id", "users.email", "profile.display_name", "member.id as organization_member_id")
        .orderBy("profile.display_name", "asc");
      response.json({ data: accounts.map((account) => ({
        id: account.id,
        email: account.email,
        display_name: account.display_name || account.email,
        organization_member_id: account.organization_member_id ?? null,
      })) });
    }));

    router.post("/organization", route(async (request, response) => {
      requireAdmin(request);
      await ensureOrganizationMembersTable(database);
      const input = organizationInput(request, { identity: true });
      if (input.avatar) await assertOwnedUploads(database, [input.avatar], currentUser(request));
      if (!input.display_name) throw new EndpointError(400, "INVALID_PAYLOAD", "display_name is required");
      if (input.user) {
        const account = await database("directus_users").where({ id: input.user, status: "active" }).first();
        if (!account) throw new EndpointError(400, "INVALID_PAYLOAD", "user_id is invalid");
        if (await database("organization_members").where({ user: input.user }).first()) {
          throw new EndpointError(409, "RECORD_EXISTS", "The account is already linked to an organization member");
        }
        const profile = await database("profiles").select("display_name", "avatar", "bio", "xbox_gamertag").where({ user: input.user }).first();
        if (typeof profile?.display_name === "string" && profile.display_name.trim()) input.display_name = profile.display_name;
        input.avatar = profile?.avatar ?? null;
        input.bio = typeof profile?.bio === "string" ? profile.bio : "";
        input.xbox_gamertag = typeof profile?.xbox_gamertag === "string" ? profile.xbox_gamertag : "";
      }
      const id = crypto.randomUUID();
      await database("organization_members").insert({ id, ...input, created_at: new Date() });
      response.status(201).json({ data: { id, display_name: input.display_name, bio: input.bio ?? "", xbox_gamertag: input.xbox_gamertag ?? "", avatar: input.avatar ?? null } });
    }));

    router.get("/organization/teams", route(async (_request, response) => {
      await ensureOrganizationTeamsTable(database);
      const teams = await database("organization_teams").select("name").orderBy("sort", "asc").orderBy("created_at", "asc");
      response.json({ data: teams.map((team) => team.name) });
    }));

    router.post("/organization/teams", route(async (request, response) => {
      requireAdmin(request);
      await ensureOrganizationTeamsTable(database);
      const name = teamName(request);
      const exists = await database("organization_teams").where({ name }).first();
      if (exists) throw new EndpointError(409, "RECORD_EXISTS", "The team already exists");
      await database("organization_teams").insert({ name });
      response.status(201).json({ data: { name } });
    }));

    router.put("/organization/teams/:name", route(async (request, response) => {
      requireAdmin(request);
      await ensureOrganizationTeamsTable(database);
      const currentName = decodeURIComponent(request.params.name);
      const name = teamName(request);
      const exists = await database("organization_teams").where({ name: currentName }).first();
      if (!exists) throw new EndpointError(404, "RECORD_NOT_FOUND", "The team was not found");
      if (name !== currentName && await database("organization_teams").where({ name }).first()) {
        throw new EndpointError(409, "RECORD_EXISTS", "The team already exists");
      }
      await database.transaction(async (transaction) => {
        await transaction("organization_teams").where({ name: currentName }).update({ name });
        await transaction("organization_members").where({ organization_role: "team_member", organization_team: currentName }).update({ organization_team: name, updated_at: new Date() });
      });
      response.json({ data: { name } });
    }));

    router.delete("/organization/teams/:name", route(async (request, response) => {
      requireAdmin(request);
      await ensureOrganizationTeamsTable(database);
      const name = decodeURIComponent(request.params.name);
      const exists = await database("organization_teams").where({ name }).first();
      if (!exists) throw new EndpointError(404, "RECORD_NOT_FOUND", "The team was not found");
      await database.transaction(async (transaction) => {
        await transaction("organization_members").where({ organization_role: "team_member", organization_team: name }).update({ organization_team: "", updated_at: new Date() });
        await transaction("organization_teams").where({ name }).delete();
      });
      response.status(204).send();
    }));

    router.put("/organization/:id", route(async (request, response) => {
      requireAdmin(request);
      await ensureOrganizationMembersTable(database);
      const id = routeId(request);
      const exists = await database("organization_members").select("id", "user", "display_name", "bio", "xbox_gamertag", "avatar").where({ id }).first();
      if (!exists) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested profile was not found");
      const input = organizationInput(request, { identity: true });
      if (input.avatar) await assertOwnedUploads(database, [input.avatar], currentUser(request));
      if (input.user) {
        const account = await database("directus_users").where({ id: input.user, status: "active" }).first();
        if (!account) throw new EndpointError(400, "INVALID_PAYLOAD", "user_id is invalid");
        const linked = await database("organization_members").where({ user: input.user }).whereNot({ id }).first();
        if (linked) throw new EndpointError(409, "RECORD_EXISTS", "The account is already linked to another organization member");
        const profile = await database("profiles").select("display_name", "avatar", "bio", "xbox_gamertag").where({ user: input.user }).first();
        if (typeof profile?.display_name === "string" && profile.display_name.trim()) input.display_name = profile.display_name;
        input.avatar = profile?.avatar ?? null;
        input.bio = typeof profile?.bio === "string" ? profile.bio : "";
        input.xbox_gamertag = typeof profile?.xbox_gamertag === "string" ? profile.xbox_gamertag : "";
      }
      await database("organization_members").where({ id }).update({ ...input, updated_at: new Date() });
      response.json({ data: { id, display_name: input.display_name ?? exists.display_name, bio: input.bio ?? exists.bio ?? "", xbox_gamertag: input.xbox_gamertag ?? exists.xbox_gamertag ?? "", avatar: Object.prototype.hasOwnProperty.call(input, "avatar") ? input.avatar : exists.avatar ?? null } });
    }));

    router.put("/organization/:id/highlight", route(async (request, response) => {
      requireAdmin(request);
      await ensureProfileEntitlementsTable(database);
      const id = routeId(request);
      if (!await database("organization_members").select("id").where({ id }).first()) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested profile was not found");
      const body = objectBody(request);
      strictKeys(body, new Set(["enabled"]));
      if (typeof body.enabled !== "boolean") throw new EndpointError(400, "INVALID_PAYLOAD", "enabled must be a boolean");
      const record = { status: body.enabled ? "active" : "revoked", variant: body.enabled ? "supporter" : null, valid_until: null, updated_at: new Date() };
      const existing = await database("profile_entitlements").where({ member: id, feature: "profile_highlight", source: "manual" }).first();
      if (existing) await database("profile_entitlements").where({ id: existing.id }).update(record);
      else await database("profile_entitlements").insert({ id: crypto.randomUUID(), member: id, feature: "profile_highlight", source: "manual", ...record, created_at: new Date() });
      response.json({ data: { enabled: body.enabled } });
    }));

    router.put("/organization/:id/supporter", route(async (request, response) => {
      requireAdmin(request);
      await ensureProfileEntitlementsTable(database);
      const id = routeId(request);
      if (!await database("organization_members").select("id").where({ id }).first()) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested profile was not found");
      const body = objectBody(request);
      strictKeys(body, new Set(["tier"]));
      if (body.tier !== null && !SUPPORTER_TIER_PRIORITY.has(body.tier)) throw new EndpointError(400, "INVALID_PAYLOAD", "tier is invalid");
      const record = { status: body.tier ? "active" : "revoked", variant: body.tier, valid_until: null, updated_at: new Date() };
      const existing = await database("profile_entitlements").where({ member: id, feature: "profile_highlight", source: "manual" }).first();
      if (existing) await database("profile_entitlements").where({ id: existing.id }).update(record);
      else await database("profile_entitlements").insert({ id: crypto.randomUUID(), member: id, feature: "profile_highlight", source: "manual", ...record, created_at: new Date() });
      const active = await database("profile_entitlements").select("variant", "valid_until").where({ member: id, feature: "profile_highlight", status: "active" });
      const supporterTier = effectiveSupporterTier(active);
      response.json({ data: { supporterTier: supporterTier ?? null, highlighted: Boolean(supporterTier) } });
    }));

    router.delete("/organization/:id", route(async (request, response) => {
      requireAdmin(request);
      await ensureOrganizationMembersTable(database);
      const id = routeId(request);
      const exists = await database("organization_members").select("id").where({ id }).first();
      if (!exists) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested profile was not found");
      await database.transaction(async (transaction) => {
        await transaction("organization_members")
          .where({ organization_parent: id })
          .update({ organization_parent: null, updated_at: new Date() });
        await transaction("organization_members").where({ id }).delete();
      });
      response.status(204).send();
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

    router.get("/activity-ranking", route(async (_request, response) => {
      const now = new Date();
      const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
      const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

      const result = await database.raw(`
        WITH activity_events AS (
          SELECT author AS user_id, 10 AS exp FROM articles WHERE created_at >= ? AND created_at < ?
          UNION ALL
          SELECT author AS user_id, 5 AS exp FROM posts WHERE created_at >= ? AND created_at < ?
          UNION ALL
          SELECT posts.author AS user_id, 1 AS exp
          FROM post_likes INNER JOIN posts ON posts.id = post_likes.post
          WHERE post_likes.created_at >= ? AND post_likes.created_at < ?
          UNION ALL
          SELECT articles.author AS user_id, 1 AS exp
          FROM article_likes INNER JOIN articles ON articles.id = article_likes.article
          WHERE article_likes.created_at >= ? AND article_likes.created_at < ?
        )
        SELECT activity_events.user_id, profiles.display_name, profiles.avatar,
          SUM(activity_events.exp)::integer AS activity_exp
        FROM activity_events
        INNER JOIN directus_users ON directus_users.id = activity_events.user_id
        INNER JOIN profiles ON profiles.user = activity_events.user_id
        WHERE directus_users.status = 'active'
        GROUP BY activity_events.user_id, profiles.display_name, profiles.avatar
        ORDER BY activity_exp DESC, profiles.display_name ASC, activity_events.user_id ASC
        LIMIT 5
      `, [since, until, since, until, since, until, since, until]);

      response.json({
        data: result.rows.map((row, index) => ({
          rank: index + 1,
          user: { id: row.user_id, display_name: row.display_name, avatar: row.avatar },
          activity_exp: Number(row.activity_exp),
        })),
        meta: { since: since.toISOString(), until: until.toISOString() },
      });
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
          .where((builder) => builder
            .where({ thumbnail: id })
            .orWhere({ published_version_thumbnail: id }))
          .orWhere("body", "like", `%/pmc-website/assets/${id}%`)
          .orWhere("published_version_body", "like", `%/pmc-website/assets/${id}%`)
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
        filter._or = [
          { status: { _eq: "published" } },
          { published_version_title: { _nnull: true } },
        ];
        count.where((builder) => builder
          .where({ status: "published" })
          .orWhereNotNull("published_version_title"));
        if (request.query.author_id !== undefined) {
          const author = uuid(request.query.author_id, "author_id");
          filter.author = { _eq: author };
          count.andWhere({ author });
        }
        if (request.query.tag !== undefined) {
          const tag = requiredText(request.query.tag, "tag", 30);
          const matchingRows = await database("articles")
            .select("id")
            .where((builder) => builder
              .where({ status: "published" })
              .orWhereNotNull("published_version_title"))
            .whereRaw("COALESCE(published_version_tags, tags)::jsonb @> ?::jsonb", [JSON.stringify([tag])]);
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
      const visibleData = scope === "published" ? data.map(publicArticleView) : data;
      const enriched = await withLikeState(database, visibleData, "article_likes", "article", request.accountability?.user);
      response.json({
        data: enriched,
        meta: { filter_count: Number(totalRow?.count ?? 0) },
      });
    }));

    router.get("/articles/tags", route(async (_request, response) => {
      const rows = await database.raw(`
        SELECT DISTINCT json_array_elements_text(COALESCE(published_version_tags, tags)) AS tag
        FROM articles
        WHERE (status = 'published' OR published_version_title IS NOT NULL)
          AND json_typeof(COALESCE(published_version_tags, tags)) = 'array'
        ORDER BY tag ASC
      `);
      response.json({ data: rows.rows.map((row) => row.tag) });
    }));

    router.get("/articles/by-slug/:slug", route(async (request, response) => {
      const slug = requiredText(request.params.slug, "slug", 180);
      const record = await database("articles")
        .select("id")
        .where((builder) => builder
          .where({ slug, status: "published" })
          .orWhere((publishedVersion) => publishedVersion
            .where({ published_version_slug: slug })
            .whereNotNull("published_version_title")))
        .first();
      if (!record) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested article was not found");

      const schema = await getSchema();
      const articles = new ItemsService("articles", { schema, accountability: null });
      const data = await articles.readOne(record.id, { fields: ARTICLE_FIELDS });
      response.json({ data: (await withLikeState(database, [publicArticleView(data)], "article_likes", "article", request.accountability?.user))[0] });
    }));

    router.get("/articles/:id", route(async (request, response) => {
      const id = routeId(request);
      const record = await database("articles")
        .select("id", "author", "status", "published_version_title")
        .where({ id })
        .first();
      if (!record) throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested article was not found");
      const user = request.accountability?.user ? String(request.accountability.user) : null;
      const ownsArticle = record.author === user;
      const publiclyVisible = record.status === "published" || record.published_version_title !== null;
      if (!publiclyVisible && request.accountability?.admin !== true && !ownsArticle) {
        throw new EndpointError(404, "RECORD_NOT_FOUND", "The requested article was not found");
      }
      const schema = await getSchema();
      const articles = new ItemsService("articles", { schema, accountability: null });
      const data = await articles.readOne(id, { fields: ARTICLE_FIELDS });
      const visible = request.accountability?.admin === true || ownsArticle ? data : publicArticleView(data);
      response.json({ data: (await withLikeState(database, [visible], "article_likes", "article", request.accountability?.user))[0] });
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
      const existing = await database("profiles").select("id").where({ user: userId }).first();
      const data = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
      const now = new Date();
      const id = existing?.id ?? randomUUID();
      if (existing) {
        await database("profiles").where({ id }).update({ ...data, updated_at: now });
      } else {
        await database("profiles").insert({ id, ...data, user: userId, created_at: now, updated_at: now });
      }
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
      await assertArticleSlugAvailable(database, input.slug);
      await assertOwnedUploads(database, storedImageIdsInMarkdown(input.body), userId);
      if (input.author) {
        const author = await database("directus_users").select("id").where({ id: input.author, status: "active" }).first();
        if (!author) throw new EndpointError(400, "INVALID_AUTHOR", "The selected author is not active");
      }
      const schema = await getSchema();
      const articles = new ItemsService("articles", {
        schema,
        accountability: elevatedAccountability(request),
      });
      const id = await articles.createOne({
        author: input.author ?? userId,
        title: input.title,
        slug: input.slug,
        summary: input.summary,
        tags: input.tags,
        body: input.body,
        thumbnail: input.thumbnail ?? null,
        status: "draft",
      });
      if (input.createdAt || input.publishedAt) {
        await database("articles").where({ id }).update({
          ...(input.createdAt ? { created_at: input.createdAt } : {}),
          ...(input.publishedAt ? { published_at: input.publishedAt } : {}),
        });
      }
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
      await assertArticleSlugAvailable(database, input.slug, id);
      if (input.body !== undefined) {
        await assertOwnedUploads(
          database,
          newlyReferencedImageIds(record.body ?? "", input.body),
          request.accountability?.admin === true ? null : userId,
        );
      }
      if (input.author) {
        const author = await database("directus_users").select("id").where({ id: input.author, status: "active" }).first();
        if (!author) throw new EndpointError(400, "INVALID_AUTHOR", "The selected author is not active");
      }
      const data = Object.fromEntries(Object.entries(input).filter(([key, value]) => (
        value !== undefined && !["author", "createdAt", "publishedAt"].includes(key)
      )));
      const schema = await getSchema();
      const articles = new ItemsService("articles", {
        schema,
        accountability: elevatedAccountability(request),
      });
      const beginsPublishedRevision = request.accountability?.admin !== true
        && record.status === "published"
        && record.published_version_title == null;
      if (Object.keys(data).length > 0 || beginsPublishedRevision) {
        await articles.updateOne(id, {
          ...(beginsPublishedRevision ? publishedVersionSnapshot(record) : {}),
          ...(beginsPublishedRevision ? { status: "draft", review_comment: null } : {}),
          ...data,
        });
      }
      if (input.author !== undefined || input.createdAt !== undefined || input.publishedAt !== undefined) {
        await database("articles").where({ id }).update({
          ...(input.author !== undefined ? { author: input.author } : {}),
          ...(input.createdAt !== undefined ? { created_at: input.createdAt } : {}),
          ...(input.publishedAt !== undefined ? { published_at: input.publishedAt } : {}),
        });
      }
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
      if (request.accountability?.admin !== true && record.published_version_title != null) {
        throw new EndpointError(409, "ARTICLE_NOT_DELETABLE", "A published article with a pending revision cannot be deleted");
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
      const article = await database("articles")
        .select("id", "status", "published_version_title")
        .where({ id })
        .first();
      if (!article || (article.status !== "published" && article.published_version_title == null)) {
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
      const article = await database("articles")
        .select("id", "status", "published_version_title")
        .where({ id })
        .first();
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
          ...(approved ? { published_at: new Date(), ...CLEAR_PUBLISHED_VERSION } : {}),
          review_comment: comment ?? null,
        });
        await reviews.fork({ knex: transaction }).createOne({
          article: id,
          reviewer,
          action: approved ? "approved" : "rejected",
          comment: comment ?? null,
        });
      });
      if (approved && shouldNotifyDiscordForArticleApproval(
        article,
        process.env.DISCORD_ARTICLE_WEBHOOK_NOTIFY_UPDATES,
      )) {
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
