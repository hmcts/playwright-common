/**
 * Serialize an API response body into a human-readable string for error messages.
 * Strings are returned as-is; objects are JSON stringified; undefined/null produce a placeholder.
 */
export function serialiseApiBody(body: unknown): string {
  if (body === null || body === undefined) {
    return "No response body";
  }
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    // Last resort: attempt to build key=value pairs if possible
    if (typeof body === "object") {
      return Object.entries(body as Record<string, unknown>)
        .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join(", ");
    }
    return typeof body === "string" ? body : JSON.stringify(body);
  }
}
