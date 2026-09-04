const baseUrl = (process.env.DIRECTUS_URL ?? "http://127.0.0.1:8056").replace(/\/$/, "");
const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL ?? process.env.DIRECTUS_DEV_ADMIN_EMAIL;
const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD ?? process.env.DIRECTUS_DEV_ADMIN_PASSWORD;
const adminOtp = process.env.DIRECTUS_ADMIN_OTP?.trim() || undefined;
const memberEmail = process.env.DIRECTUS_DEV_MEMBER_EMAIL;
const memberPassword = process.env.DIRECTUS_DEV_MEMBER_PASSWORD;

const UPLOAD_FOLDER_ID = "0ebf4c62-1014-4a72-99db-2b1198c59f1f";
const WORLD_DOWNLOAD_FOLDER_ID = "a5c3b26e-2b4b-4a2e-9f65-37b925f0cdea";
const MEMBER_POLICY_NAME = "pmc-website Member API";
const MEMBER_ROLE_NAME = "pmc-website Member";

const bootstrapHost = new URL(baseUrl).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]", "directus"].includes(bootstrapHost)) {
  throw new Error(`Refusing to bootstrap a non-local Directus instance: ${baseUrl}`);
}

for (const [name, value] of Object.entries({
  DIRECTUS_ADMIN_EMAIL: adminEmail,
  DIRECTUS_ADMIN_PASSWORD: adminPassword,
})) {
  if (!value) throw new Error(`${name} or its DIRECTUS_DEV_* fallback is required.`);
}

if ((memberEmail && !memberPassword) || (!memberEmail && memberPassword)) {
  throw new Error("DIRECTUS_DEV_MEMBER_EMAIL and DIRECTUS_DEV_MEMBER_PASSWORD must be set together.");
}

if (adminOtp && !/^\d{6}$/.test(adminOtp)) {
  throw new Error("DIRECTUS_ADMIN_OTP must be the current 6-digit one-time password.");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForDirectus() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/server/ping`);
      if (response.ok) return;
    } catch {
      // Directus is still starting.
    }
    await sleep(1_000);
  }
  throw new Error(`Directus did not become healthy at ${baseUrl}`);
}

let accessToken;

async function api(path, { method = "GET", body, allow = [] } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (allow.includes(response.status)) return { status: response.status, data: undefined };
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const detail = payload?.errors?.[0];
    const code = detail?.extensions?.code ? ` (${detail.extensions.code})` : "";
    throw new Error(`${method} ${path} failed with ${response.status}${code}: ${detail?.message ?? "Unknown error"}`);
  }
  return { status: response.status, data: payload?.data };
}

const primaryUuid = () => ({
  field: "id",
  type: "uuid",
  meta: { hidden: true, readonly: true, interface: "input", special: ["uuid"] },
  schema: { is_primary_key: true, is_nullable: false },
});

const primaryInteger = () => ({
  field: "id",
  type: "integer",
  meta: { hidden: true, readonly: true, interface: "input" },
  schema: { is_primary_key: true, is_nullable: false, has_auto_increment: true },
});

const primaryString = () => ({
  field: "id",
  type: "string",
  meta: { hidden: true, readonly: true, interface: "input" },
  schema: { is_primary_key: true, is_nullable: false, max_length: 80 },
});

const createdAt = () => ({
  field: "created_at",
  type: "timestamp",
  meta: {
    interface: "datetime",
    special: ["date-created"],
    readonly: true,
    hidden: true,
    display: "datetime",
  },
  schema: { is_nullable: false },
});

const updatedAt = () => ({
  field: "updated_at",
  type: "timestamp",
  meta: {
    interface: "datetime",
    special: ["date-updated"],
    readonly: true,
    hidden: true,
    display: "datetime",
  },
  schema: { is_nullable: true },
});

const manyToOne = (field, { required = false, hidden = false } = {}) => ({
  field,
  type: "uuid",
  meta: {
    interface: "select-dropdown-m2o",
    special: ["m2o"],
    required,
    hidden,
  },
  schema: { is_nullable: !required },
});

const collectionDefinitions = [
  {
    collection: "site_pages",
    meta: {
      icon: "web",
      note: "Editable singleton-like website pages",
      display_template: "{{id}}",
      accountability: "all",
    },
    fields: [
      primaryString(),
      {
        field: "content",
        type: "json",
        meta: { interface: "input-code", options: { language: "json" }, required: true },
        schema: { is_nullable: false },
      },
      updatedAt(),
    ],
  },
  {
    collection: "profiles",
    meta: {
      icon: "badge",
      note: "pmc-website member profiles",
      display_template: "{{display_name}}",
      accountability: "all",
    },
    fields: [
      primaryUuid(),
      { ...manyToOne("user"), schema: { is_nullable: true, is_unique: true } },
      {
        field: "display_name",
        type: "string",
        meta: { interface: "input", required: true },
        schema: { is_nullable: false, max_length: 80 },
      },
      {
        field: "bio",
        type: "text",
        meta: { interface: "input-multiline" },
        schema: { is_nullable: true },
      },
      manyToOne("avatar"),
      createdAt(),
      updatedAt(),
    ],
  },
  {
    collection: "posts",
    meta: {
      icon: "dynamic_feed",
      note: "Short activity posts",
      display_template: "{{author}} — {{created_at}}",
      accountability: "all",
    },
    fields: [
      primaryUuid(),
      manyToOne("author", { required: true }),
      {
        field: "content",
        type: "text",
        meta: { interface: "input-multiline", required: true },
        schema: { is_nullable: false },
      },
      createdAt(),
      updatedAt(),
    ],
  },
  {
    collection: "posts_files",
    meta: {
      icon: "link",
      note: "Post image junction",
      hidden: true,
      accountability: "activity",
      sort_field: "sort",
    },
    fields: [
      primaryInteger(),
      manyToOne("posts_id", { required: true }),
      manyToOne("directus_files_id", { required: true }),
      {
        field: "sort",
        type: "integer",
        meta: { interface: "input", hidden: true },
        schema: { is_nullable: true },
      },
    ],
  },
  {
    collection: "post_likes",
    meta: { icon: "favorite", note: "Member likes on posts", hidden: true, accountability: "activity" },
    fields: [
      primaryString(),
      manyToOne("post", { required: true }),
      manyToOne("user", { required: true }),
      createdAt(),
    ],
  },
  {
    collection: "articles",
    meta: {
      icon: "article",
      note: "Long-form member articles",
      display_template: "{{title}}",
      accountability: "all",
      archive_field: "status",
      archive_value: "rejected",
      unarchive_value: "draft",
      archive_app_filter: true,
    },
    fields: [
      primaryUuid(),
      manyToOne("author", { required: true }),
      {
        field: "title",
        type: "string",
        meta: { interface: "input", required: true },
        schema: { is_nullable: false, max_length: 160 },
      },
      {
        field: "slug",
        type: "string",
        meta: { interface: "input", required: true },
        schema: { is_nullable: false, is_unique: true, max_length: 180 },
      },
      {
        field: "summary",
        type: "text",
        meta: { interface: "input-multiline" },
        schema: { is_nullable: true },
      },
      {
        field: "tags",
        type: "json",
        meta: {
          interface: "tags",
          note: "Up to 10 article tags, 30 characters each",
        },
        schema: { is_nullable: false, default_value: [] },
      },
      {
        field: "body",
        type: "text",
        meta: { interface: "input-code", options: { language: "markdown" } },
        schema: { is_nullable: true },
      },
      manyToOne("thumbnail"),
      {
        field: "status",
        type: "string",
        meta: {
          interface: "select-dropdown",
          required: true,
          options: {
            choices: [
              { text: "Draft", value: "draft" },
              { text: "Pending", value: "pending" },
              { text: "Published", value: "published" },
              { text: "Rejected", value: "rejected" },
            ],
          },
        },
        schema: { is_nullable: false, default_value: "draft", max_length: 32 },
      },
      createdAt(),
      updatedAt(),
      {
        field: "published_at",
        type: "timestamp",
        meta: { interface: "datetime", display: "datetime", readonly: true },
        schema: { is_nullable: true },
      },
      {
        field: "event_at",
        type: "timestamp",
        meta: {
          interface: "datetime",
          display: "datetime",
          note: "Optional date and time of the event described by the article",
        },
        schema: { is_nullable: true },
      },
      {
        field: "review_comment",
        type: "text",
        meta: { interface: "input-multiline", readonly: true },
        schema: { is_nullable: true },
      },
      {
        field: "published_version_title",
        type: "string",
        meta: { interface: "input", hidden: true, readonly: true },
        schema: { is_nullable: true, max_length: 160 },
      },
      {
        field: "published_version_slug",
        type: "string",
        meta: { interface: "input", hidden: true, readonly: true },
        schema: { is_nullable: true, max_length: 180 },
      },
      {
        field: "published_version_summary",
        type: "text",
        meta: { interface: "input-multiline", hidden: true, readonly: true },
        schema: { is_nullable: true },
      },
      {
        field: "published_version_tags",
        type: "json",
        meta: { interface: "tags", hidden: true, readonly: true },
        schema: { is_nullable: true },
      },
      {
        field: "published_version_body",
        type: "text",
        meta: { interface: "input-code", hidden: true, readonly: true, options: { language: "markdown" } },
        schema: { is_nullable: true },
      },
      manyToOne("published_version_thumbnail", { hidden: true }),
      {
        field: "published_version_event_at",
        type: "timestamp",
        meta: { interface: "datetime", hidden: true, readonly: true },
        schema: { is_nullable: true },
      },
    ],
  },
  {
    collection: "article_reviews",
    meta: {
      icon: "rate_review",
      note: "Article workflow audit trail",
      display_template: "{{action}} — {{created_at}}",
      accountability: "all",
    },
    fields: [
      primaryUuid(),
      manyToOne("article", { required: true }),
      manyToOne("reviewer", { required: true }),
      {
        field: "action",
        type: "string",
        meta: {
          interface: "select-dropdown",
          required: true,
          options: {
            choices: [
              { text: "Submitted", value: "submitted" },
              { text: "Approved", value: "approved" },
              { text: "Rejected", value: "rejected" },
            ],
          },
        },
        schema: { is_nullable: false, max_length: 32 },
      },
      {
        field: "comment",
        type: "text",
        meta: { interface: "input-multiline" },
        schema: { is_nullable: true },
      },
      createdAt(),
    ],
  },
  {
    collection: "article_likes",
    meta: { icon: "favorite", note: "Member likes on published articles", hidden: true, accountability: "activity" },
    fields: [
      primaryString(),
      manyToOne("article", { required: true }),
      manyToOne("user", { required: true }),
      createdAt(),
    ],
  },
];

const relationDefinitions = [
  {
    collection: "profiles",
    field: "user",
    related_collection: "directus_users",
    schema: { on_delete: "SET NULL" },
    meta: {
      many_collection: "profiles",
      many_field: "user",
      one_collection: "directus_users",
      one_field: "profile",
      one_deselect_action: "nullify",
    },
  },
  {
    collection: "profiles",
    field: "avatar",
    related_collection: "directus_files",
    schema: { on_delete: "SET NULL" },
    meta: { many_collection: "profiles", many_field: "avatar", one_collection: "directus_files" },
  },
  {
    collection: "posts",
    field: "author",
    related_collection: "directus_users",
    schema: { on_delete: "CASCADE" },
    meta: { many_collection: "posts", many_field: "author", one_collection: "directus_users" },
  },
  {
    collection: "posts_files",
    field: "posts_id",
    related_collection: "posts",
    schema: { on_delete: "CASCADE" },
    meta: {
      many_collection: "posts_files",
      many_field: "posts_id",
      one_collection: "posts",
      one_field: "files",
      one_deselect_action: "delete",
      junction_field: "directus_files_id",
      sort_field: "sort",
    },
  },
  {
    collection: "post_likes",
    field: "post",
    related_collection: "posts",
    schema: { on_delete: "CASCADE" },
    meta: { many_collection: "post_likes", many_field: "post", one_collection: "posts" },
  },
  {
    collection: "post_likes",
    field: "user",
    related_collection: "directus_users",
    schema: { on_delete: "CASCADE" },
    meta: { many_collection: "post_likes", many_field: "user", one_collection: "directus_users" },
  },
  {
    collection: "posts_files",
    field: "directus_files_id",
    related_collection: "directus_files",
    schema: { on_delete: "CASCADE" },
    meta: {
      many_collection: "posts_files",
      many_field: "directus_files_id",
      one_collection: "directus_files",
      junction_field: "posts_id",
    },
  },
  {
    collection: "articles",
    field: "author",
    related_collection: "directus_users",
    schema: { on_delete: "CASCADE" },
    meta: { many_collection: "articles", many_field: "author", one_collection: "directus_users" },
  },
  {
    collection: "articles",
    field: "thumbnail",
    related_collection: "directus_files",
    schema: { on_delete: "SET NULL" },
    meta: { many_collection: "articles", many_field: "thumbnail", one_collection: "directus_files" },
  },
  {
    collection: "articles",
    field: "published_version_thumbnail",
    related_collection: "directus_files",
    schema: { on_delete: "SET NULL" },
    meta: {
      many_collection: "articles",
      many_field: "published_version_thumbnail",
      one_collection: "directus_files",
    },
  },
  {
    collection: "article_reviews",
    field: "article",
    related_collection: "articles",
    schema: { on_delete: "CASCADE" },
    meta: {
      many_collection: "article_reviews",
      many_field: "article",
      one_collection: "articles",
      one_field: "reviews",
      one_deselect_action: "delete",
    },
  },
  {
    collection: "article_reviews",
    field: "reviewer",
    related_collection: "directus_users",
    schema: { on_delete: "CASCADE" },
    meta: {
      many_collection: "article_reviews",
      many_field: "reviewer",
      one_collection: "directus_users",
    },
  },
  {
    collection: "article_likes",
    field: "article",
    related_collection: "articles",
    schema: { on_delete: "CASCADE" },
    meta: { many_collection: "article_likes", many_field: "article", one_collection: "articles" },
  },
  {
    collection: "article_likes",
    field: "user",
    related_collection: "directus_users",
    schema: { on_delete: "CASCADE" },
    meta: { many_collection: "article_likes", many_field: "user", one_collection: "directus_users" },
  },
];

const aliasDefinitions = [
  {
    collection: "directus_users",
    field: {
      field: "profile",
      type: "alias",
      meta: {
        interface: "list-o2m",
        special: ["o2m"],
        readonly: true,
        options: { template: "{{display_name}}" },
      },
      schema: null,
    },
  },
  {
    collection: "posts",
    field: {
      field: "files",
      type: "alias",
      meta: {
        interface: "files",
        special: ["m2m"],
        options: { folder: UPLOAD_FOLDER_ID },
      },
      schema: null,
    },
  },
  {
    collection: "articles",
    field: {
      field: "reviews",
      type: "alias",
      meta: {
        interface: "list-o2m",
        special: ["o2m"],
        readonly: true,
      },
      schema: null,
    },
  },
];

async function authenticate() {
  const result = await api("/auth/login", {
    method: "POST",
    body: {
      email: adminEmail,
      password: adminPassword,
      ...(adminOtp ? { otp: adminOtp } : {}),
      mode: "json",
    },
  });
  accessToken = result.data.access_token;
}

async function ensureCollection(definition) {
  const existing = await api(`/collections/${definition.collection}`, { allow: [403, 404] });
  if (existing.status !== 200) {
    await api("/collections", {
      method: "POST",
      body: {
        collection: definition.collection,
        meta: definition.meta,
        schema: { name: definition.collection },
        fields: definition.fields,
      },
    });
    console.log(`Created collection: ${definition.collection}`);
    return;
  }

  for (const field of definition.fields) {
    const found = await api(`/fields/${definition.collection}/${field.field}`, { allow: [403, 404] });
    if (found.status !== 200) {
      await api(`/fields/${definition.collection}`, { method: "POST", body: field });
      console.log(`Created field: ${definition.collection}.${field.field}`);
    }
  }
}

async function ensureRelation(definition) {
  const existing = await api(`/relations/${definition.collection}/${definition.field}`, { allow: [403, 404] });
  if (existing.status !== 200) {
    await api("/relations", { method: "POST", body: definition });
    console.log(`Created relation: ${definition.collection}.${definition.field}`);
  }
}

async function ensureAlias(definition) {
  const existing = await api(`/fields/${definition.collection}/${definition.field.field}`, {
    allow: [403, 404],
  });
  if (existing.status !== 200) {
    await api(`/fields/${definition.collection}`, { method: "POST", body: definition.field });
    console.log(`Created alias: ${definition.collection}.${definition.field.field}`);
  }
}

async function ensureFolder(id, name) {
  const existing = await api(`/folders/${id}`, { allow: [403, 404] });
  if (existing.status !== 200) {
    await api("/folders", {
      method: "POST",
      body: { id, name, parent: null },
    });
    console.log(`Created the ${name} folder.`);
  }
}

async function first(path) {
  return (await api(path)).data?.[0];
}

async function ensurePolicy(name, values) {
  const query = new URLSearchParams({
    "filter[name][_eq]": name,
    fields: "id,name",
    limit: "1",
  });
  const existing = await first(`/policies?${query}`);
  if (existing) {
    await api(`/policies/${existing.id}`, { method: "PATCH", body: values });
    return existing.id;
  }
  const created = await api("/policies", {
    method: "POST",
    body: { name, ...values },
  });
  console.log(`Created policy: ${name}`);
  return created.data.id;
}

async function ensureRole(name) {
  const query = new URLSearchParams({
    "filter[name][_eq]": name,
    fields: "id,name",
    limit: "1",
  });
  const existing = await first(`/roles?${query}`);
  if (existing) return existing.id;
  const created = await api("/roles", {
    method: "POST",
    body: {
      name,
      icon: "group",
      description: "Authenticated members of pmc-website",
    },
  });
  console.log(`Created role: ${name}`);
  return created.data.id;
}

async function ensureAccess(role, policy) {
  const query = new URLSearchParams({
    "filter[role][_eq]": role,
    "filter[policy][_eq]": policy,
    fields: "id",
    limit: "1",
  });
  if (await first(`/access?${query}`)) return;
  await api("/access", { method: "POST", body: { role, policy, sort: 1 } });
  console.log("Attached the member policy to the member role.");
}

async function ensureMember(role) {
  const query = new URLSearchParams({
    "filter[email][_eq]": memberEmail,
    fields: "id,role",
    limit: "1",
  });
  const existing = await first(`/users?${query}`);
  if (existing) {
    if (existing.role !== role) {
      await api(`/users/${existing.id}`, { method: "PATCH", body: { role } });
    }
    return;
  }
  await api("/users", {
    method: "POST",
    body: {
      email: memberEmail,
      password: memberPassword,
      role,
      status: "active",
      first_name: "Local",
      last_name: "Member",
    },
  });
  console.log(`Created local member: ${memberEmail}`);
}

await waitForDirectus();
await authenticate();
await api("/settings", { method: "PATCH", body: { project_name: "pmc-website" } });

for (const definition of collectionDefinitions) await ensureCollection(definition);
for (const definition of relationDefinitions) await ensureRelation(definition);
for (const definition of aliasDefinitions) await ensureAlias(definition);
await ensureFolder(UPLOAD_FOLDER_ID, "pmc-website uploads");
await ensureFolder(WORLD_DOWNLOAD_FOLDER_ID, "Past Minecraft worlds");

const memberPolicy = await ensurePolicy(MEMBER_POLICY_NAME, {
  icon: "api",
  description: "Least-privilege API access for pmc-website members",
  admin_access: false,
  app_access: false,
  enforce_tfa: false,
});
const memberRole = await ensureRole(MEMBER_ROLE_NAME);
await ensureAccess(memberRole, memberPolicy);
if (memberEmail && memberPassword) await ensureMember(memberRole);

console.log("Directus schema, access policies, managed folders, and optional local user are ready.");
