const INTERNAL_ORIGIN = "https://pmc-website.invalid";
const UNSAFE_PATH_BYTES = /%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f)/i;
const UNSAFE_PATH_CHARACTERS = /[\\\u0000-\u001f\u007f]/;

export function safeInternalPath(
  value: string | string[] | undefined,
  fallback = "/timeline",
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    !candidate
    || !candidate.startsWith("/")
    || candidate.startsWith("//")
    || UNSAFE_PATH_CHARACTERS.test(candidate)
    || UNSAFE_PATH_BYTES.test(candidate)
  ) {
    return fallback;
  }

  try {
    const url = new URL(candidate, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
