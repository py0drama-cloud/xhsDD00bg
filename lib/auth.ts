// lib/auth.ts
import { NextRequest } from "next/server";
import { verifyJWT, JWTPayload } from "./jwt";

export async function getAuthUser(req: NextRequest): Promise<JWTPayload | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  return verifyJWT(token);
}

export function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export function jsonOk(data: unknown, status = 200) {
  return Response.json({ ok: true, ...( typeof data === "object" && data !== null ? data : { data }) }, { status });
}
