// lib/store.ts
// In-memory store — для локального теста.
// При перезапуске сервера данные сбрасываются.
// Замените на Prisma + PostgreSQL для production.

export type User = {
  id: string;
  telegramId: number;
  username: string;
  firstName: string;
  lastName?: string;
  avatarUrl?: string;
  starsBalance: number;
  robuxDisplay: number;
  worth: number;
  rating: number | null;
  reviewCount: number;
  offerCount: number;
  isVerified: boolean;
  subscriptionPlan: "FREE" | "PREMIUM";
  createdAt: string;
};

export type Offer = {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  kind: "PRODUCT" | "SERVICE" | "COURSE";
  type: string;
  price: number;
  currency: "STARS" | "ROBUX";
  isAutoDelivery: boolean;
  deliveryText?: string;
  isActive: boolean;
  isBoosted: boolean;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
};

// ─── In-memory collections ────────────────────────────────────────────────────
const users = new Map<string, User>();
const offers = new Map<string, Offer>();

let offerSeq = 1;
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const oid = () => `offer-${offerSeq++}`;
const now = () => new Date().toISOString();

// Seed demo offers on startup
const DEMO_SELLER_ID = "demo-seller-001";

;(function seed() {
  // Demo seller
  users.set(DEMO_SELLER_ID, {
    id: DEMO_SELLER_ID,
    telegramId: 99999,
    username: "demo_seller",
    firstName: "Demo",
    starsBalance: 500,
    robuxDisplay: 1200,
    worth: 12000,
    rating: 4.8,
    reviewCount: 22,
    offerCount: 3,
    isVerified: true,
    subscriptionPlan: "FREE",
    createdAt: now(),
  });

  const demos: Omit<Offer, "id" | "createdAt" | "updatedAt">[] = [
    { sellerId: DEMO_SELLER_ID, title: "AFK-ферма скрипт с кастомным GUI", description: "Готовый Lua-скрипт с интерфейсом. Автодоставка.", kind: "PRODUCT", type: "Скрипт", price: 150, currency: "STARS", isAutoDelivery: true, deliveryText: "-- AFK Script\nprint('delivered')", isActive: true, isBoosted: true, orderCount: 124 },
    { sellerId: DEMO_SELLER_ID, title: "Средневековый замок — детальная карта", description: "2000+ деталей, освещение, интерьер.", kind: "PRODUCT", type: "Карта", price: 300, currency: "STARS", isAutoDelivery: false, isActive: true, isBoosted: false, orderCount: 56 },
    { sellerId: DEMO_SELLER_ID, title: "Lua с нуля до монетизации — курс", description: "10 уроков, личные разборы кода.", kind: "COURSE", type: "Менторство", price: 800, currency: "STARS", isAutoDelivery: false, isActive: true, isBoosted: true, orderCount: 31 },
  ];
  for (const d of demos) {
    const id = oid();
    offers.set(id, { ...d, id, createdAt: now(), updatedAt: now() });
  }
})();

// ─── Users ────────────────────────────────────────────────────────────────────
export const UserStore = {
  findByTelegramId(telegramId: number): User | undefined {
    for (const u of users.values()) {
      if (u.telegramId === telegramId) return u;
    }
  },

  upsert(data: Pick<User, "telegramId" | "username" | "firstName" | "lastName" | "avatarUrl">): User {
    const existing = UserStore.findByTelegramId(data.telegramId);
    if (existing) {
      const updated = { ...existing, ...data, updatedAt: now() };
      users.set(existing.id, updated as User);
      return updated as User;
    }
    const user: User = {
      id: uid(),
      starsBalance: 100,
      robuxDisplay: 0,
      worth: 0,
      rating: null,
      reviewCount: 0,
      offerCount: 0,
      isVerified: false,
      subscriptionPlan: "FREE",
      createdAt: now(),
      ...data,
    };
    users.set(user.id, user);
    return user;
  },

  findById(id: string): User | undefined {
    return users.get(id);
  },
};

// ─── Offers ───────────────────────────────────────────────────────────────────
export const OfferStore = {
  list(filters: { kind?: string; type?: string; currency?: string; search?: string } = {}): Offer[] {
    let result = Array.from(offers.values()).filter(o => o.isActive);
    if (filters.kind)     result = result.filter(o => o.kind === filters.kind);
    if (filters.type)     result = result.filter(o => o.type === filters.type);
    if (filters.currency) result = result.filter(o => o.currency === filters.currency);
    if (filters.search)   result = result.filter(o => o.title.toLowerCase().includes(filters.search!.toLowerCase()));
    // Boosted first
    return result.sort((a, b) => (b.isBoosted ? 1 : 0) - (a.isBoosted ? 1 : 0));
  },

  findById(id: string): Offer | undefined {
    return offers.get(id);
  },

  create(sellerId: string, data: Omit<Offer, "id" | "sellerId" | "isActive" | "isBoosted" | "orderCount" | "createdAt" | "updatedAt">): Offer {
    const seller = UserStore.findById(sellerId);
    const limit = seller?.subscriptionPlan === "PREMIUM" ? 50 : 15;
    const currentCount = OfferStore.listBySeller(sellerId).length;
    if (currentCount >= limit) throw new Error(`Лимит предложений: ${limit}`);

    const offer: Offer = {
      ...data,
      id: oid(),
      sellerId,
      isActive: true,
      isBoosted: false,
      orderCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    offers.set(offer.id, offer);
    if (seller) {
      users.set(sellerId, { ...seller, offerCount: seller.offerCount + 1 });
    }
    return offer;
  },

  update(id: string, sellerId: string, data: Partial<Pick<Offer, "title" | "description" | "price" | "currency" | "kind" | "type" | "isAutoDelivery" | "deliveryText" | "isActive">>): Offer {
    const offer = offers.get(id);
    if (!offer) throw new Error("Предложение не найдено");
    if (offer.sellerId !== sellerId) throw new Error("Нет доступа");
    const updated = { ...offer, ...data, updatedAt: now() };
    offers.set(id, updated);
    return updated;
  },

  delete(id: string, sellerId: string): void {
    const offer = offers.get(id);
    if (!offer) throw new Error("Предложение не найдено");
    if (offer.sellerId !== sellerId) throw new Error("Нет доступа");
    offers.delete(id);
    const seller = UserStore.findById(sellerId);
    if (seller && seller.offerCount > 0) {
      users.set(sellerId, { ...seller, offerCount: seller.offerCount - 1 });
    }
  },

  listBySeller(sellerId: string): Offer[] {
    return Array.from(offers.values()).filter(o => o.sellerId === sellerId);
  },

  withSeller(offer: Offer) {
    return { ...offer, seller: UserStore.findById(offer.sellerId) ?? null };
  },
};
