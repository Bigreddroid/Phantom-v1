import { prisma } from "@/lib/db";

export async function getLinkedInAuth() {
  const auth = await prisma.linkedInAuth.findUnique({ where: { id: "singleton" } });
  if (!auth) return null;
  // Warn 3 days before expiry — expired tokens cause silent failures in cron
  if (auth.expiresAt < new Date()) return null;
  return auth;
}

export async function liRequest(
  method: "GET" | "POST" | "DELETE",
  path: string,
  accessToken: string,
  body?: object
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.linkedin.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`LinkedIn ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }

  // 201 Created with no body (e.g. ugcPosts) — return header id
  if (res.status === 201) {
    const id = res.headers.get("x-restli-id") ?? res.headers.get("location") ?? "";
    return { id };
  }

  return res.json() as Promise<Record<string, unknown>>;
}
