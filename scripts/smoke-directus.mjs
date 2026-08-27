import { randomUUID } from "node:crypto";

const baseUrl = new URL(process.env.DIRECTUS_URL ?? "http://127.0.0.1:8056");
if (!new Set(["127.0.0.1", "localhost", "::1"]).has(baseUrl.hostname)) {
  throw new Error("Refusing to run the Directus smoke test against a non-local host.");
}

const adminEmail = process.env.DIRECTUS_DEV_ADMIN_EMAIL;
const adminPassword = process.env.DIRECTUS_DEV_ADMIN_PASSWORD;
const memberEmail = process.env.DIRECTUS_DEV_MEMBER_EMAIL;
const memberPassword = process.env.DIRECTUS_DEV_MEMBER_PASSWORD;
if (!adminEmail || !adminPassword || !memberEmail || !memberPassword) {
  throw new Error("Local Directus credentials are missing. Run npm run env:setup first.");
}

async function request(path, { method = "GET", token, body, expected = [200] } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!expected.includes(response.status)) {
    const detail = await response.text();
    throw new Error(`${method} ${path} returned ${response.status}: ${detail}`);
  }
  if (response.status === 204) return undefined;
  return response.json();
}

async function login(email, password) {
  const response = await request("/auth/login", {
    method: "POST",
    body: { email, password, mode: "json" },
  });
  return response.data.access_token;
}

const memberToken = await login(memberEmail, memberPassword);
const adminToken = await login(adminEmail, adminPassword);
const suffix = randomUUID().slice(0, 8);
let postId;
let articleId;
let fileId;
let registeredUserId;

try {
  const registrationEmail = `smoke-${suffix}@example.com`;
  const registrationPassword = `Smoke-test-${randomUUID()}`;
  await request("/pmc-website/register", {
    method: "POST",
    expected: [201],
    body: { display_name: "Smoke Member", email: registrationEmail, password: registrationPassword },
  });
  await request("/pmc-website/register", {
    method: "POST",
    expected: [409],
    body: { display_name: "Duplicate", email: registrationEmail, password: registrationPassword },
  });
  await request("/auth/login", {
    method: "POST",
    expected: [401],
    body: { email: registrationEmail, password: registrationPassword, mode: "json" },
  });
  const pendingRegistrations = await request("/pmc-website/registrations", { token: adminToken });
  const pendingRegistration = pendingRegistrations.data.find((item) => item.email === registrationEmail);
  if (!pendingRegistration || pendingRegistration.status !== "draft") {
    throw new Error("The new registration was not pending administrator approval.");
  }
  registeredUserId = pendingRegistration.id;
  await request(`/pmc-website/registrations/${registeredUserId}/accept`, {
    method: "POST", token: adminToken, expected: [204],
  });
  const registeredToken = await login(registrationEmail, registrationPassword);
  const registeredSession = await request("/pmc-website/session", { token: registeredToken });
  if (registeredSession.data.isAdmin || registeredSession.data.profile?.display_name !== "Smoke Member") {
    throw new Error("The registered member role or profile is inconsistent.");
  }

  await request("/pmc-website/posts");
  await request("/pmc-website/articles");
  await request("/pmc-website/worlds", { expected: [401] });
  const worlds = await request("/pmc-website/worlds", { token: memberToken });
  if (!worlds.data.content?.markdown || !Array.isArray(worlds.data.files)) {
    throw new Error("The authenticated world archive response is inconsistent.");
  }
  await request("/pmc-website/worlds", {
    method: "PUT",
    token: memberToken,
    expected: [403],
    body: { content: { markdown: "Unauthorized edit" } },
  });

  await request("/pmc-website/profile", {
    method: "PUT",
    token: memberToken,
    body: { display_name: "Local Member", bio: "Local smoke-test profile", xbox_gamertag: "LocalPlayer", avatar: null },
  });
  const session = await request("/pmc-website/session", { token: memberToken });
  if (session.data.email !== memberEmail || session.data.isAdmin !== false) {
    throw new Error("The member session response is inconsistent.");
  }

  const onePixelPng =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const upload = await request("/pmc-website/files", {
    method: "POST",
    token: memberToken,
    expected: [201],
    body: {
      filename: `pmc-website-${randomUUID()}.png`,
      type: "image/png",
      data: onePixelPng,
    },
  });
  fileId = upload.data.id;

  const storedFile = await request(`/pmc-website/files/${fileId}`, { token: memberToken });
  if (storedFile.data.uploaded_by !== session.data.id || storedFile.data.type !== "image/png") {
    throw new Error("The uploaded file metadata is inconsistent.");
  }
  await request(`/pmc-website/files/${fileId}`, { token: registeredToken, expected: [403] });
  await request(`/pmc-website/files/${fileId}`, {
    method: "DELETE", token: registeredToken, expected: [403],
  });
  await request(`/files/${fileId}`, { token: memberToken, expected: [403] });

  const asset = await fetch(new URL(`/pmc-website/assets/${fileId}`, baseUrl));
  if (!asset.ok || asset.headers.get("content-type") !== "image/png") {
    throw new Error(`Custom asset delivery failed with ${asset.status}.`);
  }
  await request(`/assets/${fileId}`, { expected: [403] });

  const post = await request("/pmc-website/posts", {
    method: "POST",
    token: memberToken,
    expected: [201],
    body: { content: `Local smoke test ${suffix}`, file_ids: [fileId] },
  });
  postId = post.data.id;
  await request(`/pmc-website/posts/${postId}`, {
    method: "PATCH",
    token: registeredToken,
    expected: [403],
    body: { content: "Unauthorized edit" },
  });
  await request(`/pmc-website/posts/${postId}`, {
    method: "DELETE", token: registeredToken, expected: [403],
  });
  const fetchedPost = await request(`/pmc-website/posts/${postId}`);
  if (fetchedPost.data.files?.length !== 1) throw new Error("The post image relation was not saved.");
  const likedPost = await request(`/pmc-website/posts/${postId}/like`, {
    method: "POST", token: memberToken,
  });
  if (likedPost.data.like_count !== 1) throw new Error("The post like was not created.");
  const duplicatePostLike = await request(`/pmc-website/posts/${postId}/like`, {
    method: "POST", token: memberToken,
  });
  if (duplicatePostLike.data.like_count !== 1) throw new Error("The post accepted a duplicate like.");
  const likedPostDetail = await request(`/pmc-website/posts/${postId}`, { token: memberToken });
  if (!likedPostDetail.data.liked_by_me || likedPostDetail.data.like_count !== 1) {
    throw new Error("The post like state was not returned.");
  }
  await request(`/pmc-website/posts/${postId}/like`, { method: "DELETE", token: memberToken });

  const slug = `local-smoke-${suffix}`;
  const articleTag = `smoke-${suffix}`;
  const article = await request("/pmc-website/articles", {
    method: "POST",
    token: memberToken,
    expected: [201],
    body: {
      title: "Local smoke-test article",
      slug,
      summary: "Integration test",
      tags: [articleTag, "integration"],
      body: `# Local integration test\n\n![First article image](/pmc-website/assets/${fileId})`,
    },
  });
  articleId = article.data.id;
  await request(`/pmc-website/articles/${articleId}`, { expected: [404] });
  const draftThumbnail = await fetch(new URL(`/pmc-website/assets/${fileId}`, baseUrl));
  if (!draftThumbnail.ok) throw new Error("A draft thumbnail was not publicly readable.");
  await request(`/pmc-website/articles/${articleId}`, {
    method: "PATCH",
    token: registeredToken,
    expected: [403],
    body: { title: "Unauthorized edit" },
  });
  await request(`/pmc-website/articles/${articleId}`, {
    method: "DELETE", token: registeredToken, expected: [403],
  });
  await request(`/pmc-website/articles/${articleId}`, {
    method: "PATCH",
    token: memberToken,
    expected: [400],
    body: { status: "published" },
  });
  await request(`/pmc-website/articles/${articleId}/submit`, {
    method: "POST",
    token: memberToken,
    expected: [204],
  });
  const pending = await request("/pmc-website/articles?scope=pending", { token: adminToken });
  if (!pending.data.some((item) => item.id === articleId)) {
    throw new Error("The submitted article was not visible to the administrator.");
  }
  await request(`/pmc-website/articles/${articleId}/review`, {
    method: "POST",
    token: adminToken,
    expected: [204],
    body: { action: "approve", comment: "Smoke-test approval" },
  });
  const published = await request(`/pmc-website/articles/by-slug/${slug}`);
  if (published.data.id !== articleId || published.data.slug !== slug) {
    throw new Error("The article slug resolved to a different article.");
  }
  await request(`/pmc-website/articles/by-slug/missing-${suffix}`, { expected: [404] });
  if (published.data.status !== "published") throw new Error("The reviewed article was not published.");
  if (!published.data.published_at) throw new Error("The reviewed article has no publication timestamp.");
  if (!published.data.tags?.includes(articleTag)) throw new Error("The article tags were not saved.");
  await request(`/pmc-website/articles/${articleId}`, {
    method: "PATCH",
    token: adminToken,
    expected: [204],
    body: {
      summary: "Edited in administrator mode",
      body: `# Administrator edit\n\n![Member upload](/pmc-website/assets/${fileId})`,
    },
  });
  const likedArticle = await request(`/pmc-website/articles/${articleId}/like`, {
    method: "POST", token: memberToken,
  });
  if (likedArticle.data.like_count !== 1) throw new Error("The article like was not created.");
  const likedPublished = await request(`/pmc-website/articles/by-slug/${slug}`, { token: memberToken });
  if (!likedPublished.data.liked_by_me || likedPublished.data.like_count !== 1) {
    throw new Error("The article like state was not returned.");
  }
  await request(`/pmc-website/articles/${articleId}/like`, { method: "DELETE", token: memberToken });
  const filteredArticles = await request(`/pmc-website/articles?tag=${encodeURIComponent(articleTag)}`);
  if (!filteredArticles.data.some((item) => item.id === articleId)) {
    throw new Error("The published article could not be filtered by tag.");
  }
  const publishedTags = await request("/pmc-website/articles/tags");
  if (!publishedTags.data.includes(articleTag)) throw new Error("The published tag list is incomplete.");

  const editedTitle = "Local smoke-test article (published edit)";
  await request(`/pmc-website/articles/${articleId}`, {
    method: "PATCH",
    token: memberToken,
    expected: [204],
    body: {
      title: editedTitle,
      summary: "Edited after publication",
      body: "# Published article edited by its author",
    },
  });
  const editedPublished = await request(`/pmc-website/articles/by-slug/${slug}`);
  if (editedPublished.data.title !== editedTitle) {
    throw new Error("The published article changes were not saved.");
  }
  if (
    editedPublished.data.status !== "published" ||
    editedPublished.data.published_at !== published.data.published_at
  ) {
    throw new Error("Editing the published article changed its publication state or timestamp.");
  }
  if (
    !editedPublished.data.updated_at ||
    editedPublished.data.updated_at === published.data.updated_at
  ) {
    throw new Error("Editing the published article did not update its modification timestamp.");
  }
  await request(`/pmc-website/articles/${articleId}/submit`, {
    method: "POST",
    token: memberToken,
    expected: [409],
  });
  await request(`/pmc-website/articles/${articleId}`, {
    method: "DELETE",
    token: memberToken,
    expected: [409],
  });
  await request("/items/articles", { expected: [403] });

  console.log(
    "Directus smoke test passed: registration, auth, ownership, draft visibility, profile, upload, assets, posts, likes, article review, and published editing.",
  );
} finally {
  if (articleId) {
    await request(`/pmc-website/articles/${articleId}`, {
      method: "DELETE",
      token: adminToken,
      expected: [204],
    });
  }
  if (postId) {
    await request(`/pmc-website/posts/${postId}`, {
      method: "DELETE",
      token: memberToken,
      expected: [204],
    });
  }
  if (fileId) {
    await request(`/pmc-website/files/${fileId}`, {
      method: "DELETE",
      token: memberToken,
      expected: [204],
    });
  }
  if (registeredUserId) {
    await request(`/users/${registeredUserId}`, { method: "DELETE", token: adminToken, expected: [204] });
  }
}
