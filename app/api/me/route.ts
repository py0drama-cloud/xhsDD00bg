// app/api/me/route.ts
// GET /api/me — returns current user from JWT

import { NextRequest } from "next/server";
import { getAuthUser, jsonOk, jsonError } from "@/lib/auth";
import { UserStore } from "@/lib/store";
import { OfferStore } from "@/lib/store";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return jsonError("Unauthorized", 401);

  const user = UserStore.findById(auth.userId);
  if (!user) return jsonError("User not found", 404);

  const myOffers = OfferStore.listBySeller(user.id);

  return jsonOk({ user, offers: myOffers });
}
