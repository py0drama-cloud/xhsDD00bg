// app/api/offers/route.ts
// GET  /api/offers        — public list with filters
// POST /api/offers        — create offer (auth required)

import { NextRequest } from "next/server";
import { OfferStore } from "@/lib/store";
import { getAuthUser, jsonOk, jsonError } from "@/lib/auth";

// ─── GET /api/offers ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const filters = {
    kind:     searchParams.get("kind")     ?? undefined,
    type:     searchParams.get("type")     ?? undefined,
    currency: searchParams.get("currency") ?? undefined,
    search:   searchParams.get("search")   ?? undefined,
  };

  const sort = searchParams.get("sort") ?? "default";
  let offers = OfferStore.list(filters).map(o => OfferStore.withSeller(o));

  // Apply sort
  switch (sort) {
    case "price_asc":  offers.sort((a, b) => a.price - b.price); break;
    case "price_desc": offers.sort((a, b) => b.price - a.price); break;
    case "rating":     offers.sort((a, b) => (b.seller?.rating ?? 0) - (a.seller?.rating ?? 0)); break;
    case "sales":      offers.sort((a, b) => b.orderCount - a.orderCount); break;
  }

  return jsonOk({ offers, total: offers.length });
}

// ─── POST /api/offers ─────────────────────────────────────────────────────────
const VALID_KINDS = ["PRODUCT", "SERVICE", "COURSE"] as const;
const VALID_TYPES = ["Скрипт","Карта","Модель","Система","UI","Анимация","Плагин","Менторство","Аудио","Прочее"] as const;
const VALID_CURRENCIES = ["STARS", "ROBUX"] as const;

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return jsonError("Unauthorized", 401);

  try {
    const body = await req.json();
    const { title, description, kind, type, price, currency, isAutoDelivery, deliveryText } = body;

    // Validate
    if (!title?.trim())                       return jsonError("title обязателен");
    if (!description?.trim())                 return jsonError("description обязателен");
    if (!VALID_KINDS.includes(kind))          return jsonError("Некорректный kind");
    if (!VALID_TYPES.includes(type))          return jsonError("Некорректный type");
    if (!VALID_CURRENCIES.includes(currency)) return jsonError("Некорректный currency");
    if (!price || isNaN(Number(price)) || Number(price) <= 0) return jsonError("price должен быть положительным числом");
    if (isAutoDelivery && !deliveryText?.trim()) return jsonError("deliveryText обязателен для автодоставки");

    const offer = OfferStore.create(auth.userId, {
      title:          title.trim(),
      description:    description.trim(),
      kind,
      type,
      price:          Number(price),
      currency,
      isAutoDelivery: Boolean(isAutoDelivery),
      deliveryText:   deliveryText?.trim() ?? undefined,
    });

    return jsonOk({ offer }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ошибка создания";
    return jsonError(msg);
  }
}
