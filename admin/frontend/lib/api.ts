const adminApiKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY || "";

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (adminApiKey) {
    headers.set("x-admin-api-key", adminApiKey);
  }

  const res = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `Request failed with ${res.status}`);
  }

  return res.json() as Promise<T>;
}
