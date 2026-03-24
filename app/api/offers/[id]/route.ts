// app/api/offers/[id]/route.ts
// GET    /api/offers/:id  — public
// PUT    /api/offers/:id  — update (owner only)
// DELETE /api/offers/:id  — delete (owner only)

import { NextRequest } from "next/server";
import { OfferStore } from "@/lib/store";
import { getAuthUser, jsonOk, jsonError } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const offer = OfferStore.findById(id);
  if (!offer) return jsonError("Не найдено", 404);
  return jsonOk({ offer: OfferStore.withSeller(offer) });
}

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest, context: RouteContext) {
  const auth = await getAuthUser(req);
  if (!auth) return jsonError("Unauthorized", 401);
  const { id } = await context.params;

  try {
    const body = await req.json();
    const allowed = ["title","description","price","currency","kind","type","isAutoDelivery","deliveryText","isActive"] as const;
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }
    const offer = OfferStore.update(id, auth.userId, data as Parameters<typeof OfferStore.update>[2]);
    return jsonOk({ offer });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ошибка";
    const status = msg === "Нет доступа" ? 403 : msg === "Предложение не найдено" ? 404 : 400;
    return jsonError(msg, status);
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await getAuthUser(req);
  if (!auth) return jsonError("Unauthorized", 401);
  const { id } = await context.params;

  try {
    OfferStore.delete(id, auth.userId);
    return jsonOk({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ошибка";
    const status = msg === "Нет доступа" ? 403 : 404;
    return jsonError(msg, status);
  }
}
