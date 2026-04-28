"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getTelegramWebApp, type TelegramUser } from "@/lib/telegram";

type Plan = "FREE" | "PRO" | "PREMIUM";
type OfferKind = "PRODUCT" | "SERVICE" | "COURSE";
type Currency = "STARS" | "ROBUX";
type OrderStatus = "pending" | "confirmed" | "cancelled";

type User = {
  id: string;
  username: string | null;
  tg_username: string | null;
  tg_name: string | null;
  tg_photo: string | null;
  bio: string;
  stars: number;
  robux: number;
  rating: number;
  sales: number;
  verified: boolean;
  plan: Plan;
  created_at: string;
  avatar_url?: string | null;
  avatar_gif_url?: string | null;
  name_color?: string | null;
  name_font?: string | null;
  badge_icon?: string | null;
  badge_label?: string | null;
  badge_color?: string | null;
  theme_color?: string | null;
  theme_color_2?: string | null;
  profile_banner?: string | null;
  worth?: number | null;
  review_count?: number | null;
  marketplace_id?: number | null;
  is_admin?: boolean | null;
  market_banned?: boolean | null;
  ban_reason?: string | null;
};

type Offer = {
  id: string;
  uid: string;
  title: string;
  description: string;
  kind: OfferKind;
  type: string;
  price: number;
  cur: Currency;
  auto: boolean;
  auto_content: string | null;
  banner: string | null;
  boosted: number;
  boost_end: number;
  sales: number;
  rating: number;
  stock?: number | null;
  created_at: string;
  images?: string[] | null;
  cover_index?: number | null;
  user?: User | null;
};

type Message = {
  id: string;
  from_uid: string;
  to_uid: string;
  text: string;
  img: string | null;
  read: boolean;
  created_at: string;
  file_name?: string | null;
  file_type?: string | null;
};

type Order = {
  id: string;
  offer_id: string;
  buyer_uid: string;
  seller_uid: string;
  offer_snap: Offer;
  price: number;
  cur: Currency;
  status: OrderStatus;
  created_at: string;
  review_left?: boolean | null;
  buyer?: User | null;
  seller?: User | null;
};

type Review = {
  id: string;
  order_id: string;
  seller_uid: string;
  buyer_uid: string;
  rating: number;
  text: string;
  created_at: string;
  buyer?: User | null;
};

type ChatMode = "regular" | "support";

type SupportReason = "ORDER" | "PAYMENT" | "ACCOUNT" | "OTHER";
type SupportRole = "BUYER" | "SELLER";

const KIND_LABELS: Record<OfferKind, string> = {
  PRODUCT: "Товар",
  SERVICE: "Услуга",
  COURSE: "Курс",
};

const OFFER_TYPES: Record<OfferKind, string[]> = {
  PRODUCT: ["Скрипт", "Карта", "Модель", "Система", "UI", "Анимация", "Плагин", "Пак", "Другое"],
  SERVICE: ["Скриптер", "Билдер", "Моделер", "Маппер", "Аниматор", "UI/UX дизайнер", "Sound дизайнер", "Маркетолог"],
  COURSE: ["Скриптер", "Билдер", "Моделер", "Маппер", "Аниматор", "UI/UX дизайнер", "Маркетолог"],
};

const TYPE_ICONS: Record<string, string> = {
  "Скрипт": "⚙️",
  "Карта": "🗺️",
  "Модель": "🧩",
  "Система": "🛠️",
  "UI": "🖼️",
  "Анимация": "🎬",
  "Плагин": "🔌",
  "Пак": "📦",
  "Другое": "📦",
  "Скриптер": "💻",
  "Билдер": "🏗️",
  "Моделер": "🧱",
  "Маппер": "🗺️",
  "Аниматор": "🎞️",
  "UI/UX дизайнер": "🖌️",
  "Sound дизайнер": "🎧",
  "Маркетолог": "📣",
};

const PROFILE_FONTS = ["Sora", "Georgia", "Trebuchet MS", "Courier New"];
const PROFILE_COLORS = ["#F7F2FF", "#C8A3FF", "#87A7FF", "#63C7FF", "#FF8BDD", "#7DF2D7"];
const PROFILE_GRADIENTS = [
  ["#2A1635", "#5F2D91"],
  ["#101C2B", "#224B72"],
  ["#1C1A30", "#40326C"],
  ["#18261F", "#2C6B57"],
  ["#1A1036", "#452D86"],
  ["#170E32", "#2256A8"],
  ["#2D0F37", "#7D2A74"],
  ["#0E1638", "#245F86"],
];
const MIN_OFFER_PRICE_STARS = 5;
const PREMIUM_PRICE_STARS = 1000;
const MESSAGE_COOLDOWN_MS = 1200;
const OFFER_RULES_STORAGE_KEY = "roworth_offer_rules_passed";
const SUPPORT_REASONS: Array<{ value: SupportReason; label: string }> = [
  { value: "ORDER", label: "Проблема с заказом" },
  { value: "PAYMENT", label: "Проблема с оплатой" },
  { value: "ACCOUNT", label: "Проблема с аккаунтом" },
  { value: "OTHER", label: "Другое" },
];
const OFFER_RULES = [
  "Запрещено публиковать скам, краденый контент и чужие работы без разрешения.",
  "Описание товара должно честно объяснять, что получает покупатель.",
  "Для автовыдачи указывай только рабочий и безопасный контент.",
  "Нарушение правил может привести к бану на маркете без возврата доступа.",
];
const OFFER_QUIZ = [
  {
    id: "stolen",
    question: "Можно ли выставлять чужой Roblox-контент без разрешения автора?",
    options: ["Да, если изменить название", "Нет, это запрещено", "Да, если цена низкая"],
    correct: 1,
  },
  {
    id: "description",
    question: "Каким должно быть описание оффера?",
    options: ["Коротким и непонятным", "Любым, главное быстрее опубликовать", "Честным и понятным для покупателя"],
    correct: 2,
  },
  {
    id: "delivery",
    question: "Что делать, если включена автовыдача?",
    options: ["Оставить поле пустым", "Указать рабочий контент для выдачи", "Написать только 'в ЛС'"],
    correct: 1,
  },
  {
    id: "ban",
    question: "Что может случиться за обман покупателей?",
    options: ["Ничего", "Только предупреждение", "Ограничение доступа или бан на маркете"],
    correct: 2,
  },
] as const;
const ROLE_PRESETS = [
  { label: "Снять префикс", badge_label: null, badge_icon: null, badge_color: null },
  { label: "Админ", badge_label: "Админ", badge_icon: "🛡️", badge_color: "#D4A843" },
  { label: "Тех админ", badge_label: "Тех админ", badge_icon: "🧠", badge_color: "#5A8FC4" },
  { label: "Модератор", badge_label: "Модератор", badge_icon: "🔨", badge_color: "#4E9E6E" },
  { label: "Саппорт", badge_label: "Саппорт", badge_icon: "💬", badge_color: "#FF8DA1" },
  { label: "Разработчик", badge_label: "Разработчик", badge_icon: "💻", badge_color: "#C6B3FF" },
] as const;
const CHAT_STICKERS = ["❤️", "😎", "🤣", "🔥", "👀", "🙏", "💀", "✨", "😡", "👍", "🎯", "🤝"];

const T = {
  bg: "#101010",
  bg1: "#151515",
  bg2: "rgba(28, 28, 28, 0.92)",
  bg3: "rgba(39, 39, 39, 0.9)",
  bg4: "rgba(55, 55, 55, 0.95)",
  line: "rgba(255, 255, 255, 0.08)",
  line2: "rgba(255, 255, 255, 0.16)",
  gold: "#1E9BFF",
  gold2: "#EAF5FF",
  text: "#FFFFFF",
  text2: "#A7A7A7",
  text3: "#666666",
  red: "#FF4F70",
  green: "#58E0A7",
  blue: "#2397FF",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box}
html,body{
  margin:0;
  padding:0;
  height:100%;
  background:#101010;
  color:${T.text};
  font-family:'Manrope',sans-serif
}
body{
  overflow:hidden;
  position:relative;
  text-rendering:optimizeLegibility
}
body::before{
  content:'';
  position:fixed;
  inset:0;
  pointer-events:none;
  background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(0,0,0,.22));
  opacity:.75
}
body::after{
  content:'';
  position:fixed;
  inset:0;
  pointer-events:none;
  background:linear-gradient(180deg,rgba(16,16,16,0) 0%, rgba(16,16,16,.12) 45%, rgba(16,16,16,.78) 100%)
}
button,input,textarea,select{font:inherit}
button{outline:none}
.scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.card,.panel{
  position:relative;
  overflow:hidden;
  backdrop-filter:blur(22px)
}
.card::before,.panel::before{
  content:'';
  position:absolute;
  inset:1px;
  border-radius:inherit;
  background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.03));
  pointer-events:none
}
.card{
  background:linear-gradient(180deg,rgba(31,31,31,.96),rgba(23,23,23,.98));
  border:1px solid ${T.line2};
  border-radius:28px;
  box-shadow:0 28px 60px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)
}
.panel{
  background:linear-gradient(180deg,rgba(31,31,31,.88),rgba(22,22,22,.96));
  border:1px solid ${T.line};
  border-radius:22px;
  box-shadow:0 18px 40px rgba(0,0,0,.35)
}
.inp{
  width:100%;
  background:rgba(24,24,24,.95);
  border:1px solid rgba(255,255,255,.08);
  border-radius:999px;
  padding:13px 16px;
  color:${T.text};
  outline:none;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05)
}
.inp::placeholder{color:${T.text3}}
.inp:focus{
  border-color:rgba(35,151,255,.58);
  box-shadow:0 0 0 4px rgba(35,151,255,.14), inset 0 1px 0 rgba(255,255,255,.08)
}
textarea.inp{resize:none}
select.inp{
  appearance:none;
  background-image:
    linear-gradient(45deg,transparent 50%,${T.text2} 50%),
    linear-gradient(135deg,${T.text2} 50%,transparent 50%);
  background-position:
    calc(100% - 18px) calc(50% - 3px),
    calc(100% - 12px) calc(50% - 3px);
  background-size:6px 6px,6px 6px;
  background-repeat:no-repeat;
  padding:12px 34px 12px 14px;
  min-width:0;
  font-size:14px;
  line-height:1.25
}
.btn-primary{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  border:none;
  border-radius:18px;
  padding:12px 16px;
  background:linear-gradient(135deg,#2498FF,#1688F8);
  color:#fff;
  font-weight:800;
  cursor:pointer;
  box-shadow:0 18px 28px rgba(35,151,255,.28)
}
.btn-primary:disabled{opacity:.45;cursor:not-allowed}
.btn-ghost{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  border:1px solid rgba(255,255,255,.12);
  border-radius:18px;
  padding:11px 14px;
  background:rgba(35,35,35,.9);
  color:${T.text};
  cursor:pointer;
  backdrop-filter:blur(18px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04)
}
.btn-ghost:disabled{opacity:.45;cursor:not-allowed}
.pill{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:9px 14px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.1);
  background:rgba(31,31,31,.92);
  color:${T.text2};
  cursor:pointer;
  white-space:nowrap;
  backdrop-filter:blur(18px)
}
.pill.active{
  border-color:rgba(35,151,255,.48);
  color:${T.text};
  background:linear-gradient(135deg,rgba(35,151,255,.34),rgba(35,151,255,.12))
}
.gold-badge,.blue-badge,.red-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700}
.gold-badge{background:rgba(35,151,255,.16);border:1px solid rgba(35,151,255,.32);color:${T.gold2}}
.blue-badge{background:rgba(35,151,255,.14);border:1px solid rgba(35,151,255,.28);color:${T.blue}}
.red-badge{background:rgba(255,115,180,.14);border:1px solid rgba(255,115,180,.28);color:${T.red}}
.title{font-family:'Sora',sans-serif;font-weight:700;letter-spacing:-.04em}
.soft-text{color:${T.text3}}
.glass-cut{
  background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.02));
  border:1px solid rgba(255,255,255,.08)
}
.hide-scrollbar::-webkit-scrollbar{display:none}
.portal-appear{animation:portalAppear .34s cubic-bezier(.2,.85,.2,1)}
.portal-float{animation:portalFloat 4.8s ease-in-out infinite}
.tap-scale{transition:transform .16s ease,background .16s ease,border-color .16s ease}
.tap-scale:active{transform:scale(.96)}
.portal-card{animation:portalAppear .32s cubic-bezier(.2,.85,.2,1);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
.portal-card:active{transform:scale(.985)}
.range-clean{appearance:none;width:100%;height:6px;border-radius:999px;background:#8A8A8A;outline:none}
.range-clean::-webkit-slider-thumb{appearance:none;width:22px;height:22px;border-radius:999px;background:#fff;border:0;box-shadow:0 0 0 3px rgba(255,255,255,.16),0 8px 18px rgba(0,0,0,.35)}
.range-clean::-moz-range-thumb{width:22px;height:22px;border-radius:999px;background:#fff;border:0;box-shadow:0 0 0 3px rgba(255,255,255,.16),0 8px 18px rgba(0,0,0,.35)}
.home-select-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px}
.chat-shortcuts-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:14px}
.chat-shortcuts-grid > *{min-width:0}
.chat-shell{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden}
.chat-feed{flex:1;min-height:0;padding:16px 16px 12px;background:linear-gradient(180deg,rgba(255,255,255,.01),rgba(255,255,255,0))}
.chat-feed-inner{display:flex;flex-direction:column;gap:10px;min-height:100%}
.chat-feed-stack{display:flex;flex-direction:column;gap:10px;margin-top:auto}
.scroll::-webkit-scrollbar{width:6px}
.scroll::-webkit-scrollbar-thumb{background:rgba(219,203,255,.16);border-radius:999px}
@media (max-width:420px){
  .home-select-grid,.chat-shortcuts-grid{grid-template-columns:1fr}
}
@keyframes portalAppear{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes portalFloat{0%,100%{transform:translateY(0) rotate(-7deg)}50%{transform:translateY(5px) rotate(-3deg)}}
`;

function shortOrderId(id: string) {
  return id.slice(-6).toUpperCase();
}

function formatPrice(price: number, cur: string) {
  return `${price} ${cur === "STARS" ? "Stars" : cur === "ROBUX" ? "Robux" : cur}`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatWorth(value?: number | null) {
  return Number(value || 0).toLocaleString("ru-RU");
}

function getDisplayName(user: User | null | undefined) {
  return user?.tg_name || user?.username || "Пользователь";
}

function getUsername(user: User | null | undefined) {
  return user?.username || "user";
}

function getAvatar(user: User | null | undefined) {
  if (!user) return null;
  return user.plan !== "FREE" && user.avatar_gif_url ? user.avatar_gif_url : user.avatar_url || user.tg_photo || null;
}

function getProfileGradient(user: User | null | undefined) {
  return `linear-gradient(135deg,${user?.theme_color || "#1A1036"},${user?.theme_color_2 || "#4B2F89"})`;
}

function getOfferCover(offer: Offer) {
  if (offer.images?.length) {
    return offer.images[offer.cover_index || 0] || offer.images[0];
  }
  return offer.banner || null;
}

function getOfferSlotLimit(user: User) {
  return user.plan === "PREMIUM" ? 50 : 15;
}

function canCustomizeProfile(user: User) {
  return user.plan === "PREMIUM";
}

function isSystemMessage(message: Message) {
  return message.id.startsWith("sys_") || message.id.startsWith("admin_") || message.file_type === "system";
}

function isSupportMessage(message: Message) {
  return message.file_type === "support";
}

function parseReviewPrice(text: string) {
  const match = text.match(/^\[#price=(\d+)\s([A-Z]+)\]\s*/);
  if (!match) return null;
  return { price: Number(match[1]), cur: match[2], text: text.replace(match[0], "") };
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

function getTypeIcon(type: string) {
  return TYPE_ICONS[type] || "📦";
}

function getAppBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || "";
}

function getOfferRulesStorageKey(userId: string) {
  return `${OFFER_RULES_STORAGE_KEY}:${userId}`;
}

function getProfileScreenBackground(user: User | null | undefined) {
  const from = user?.theme_color || "#120F0A";
  const to = user?.theme_color_2 || "#080705";
  return `radial-gradient(circle at top right, rgba(212,168,67,.12), transparent 32%), linear-gradient(180deg, ${from}, ${to})`;
}

function RoleBadge({ user }: { user: User | null | undefined }) {
  if (!user?.badge_label) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: `${user.badge_color || T.gold}20`,
        border: `1px solid ${user.badge_color || T.gold}`,
        color: user.badge_color || T.gold2,
      }}
    >
      {user.badge_icon || "✅"} {user.badge_label}
    </span>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: `2px solid ${T.line2}`,
        borderTopColor: T.gold,
        animation: "spin .7s linear infinite",
      }}
    />
  );
}

function StarsBadge({ value }: { value: number }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 999,
        background: "linear-gradient(180deg,rgba(24,18,46,.8),rgba(11,8,24,.92))",
        border: `1px solid ${T.line2}`,
        color: T.text,
        fontWeight: 800,
        boxShadow: "0 12px 24px rgba(3,2,10,.28)",
        backdropFilter: "blur(18px)",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(135deg,rgba(154,99,255,.92),rgba(105,200,255,.88))",
          color: "#fff",
          fontSize: 12,
          boxShadow: "0 8px 18px rgba(95,89,255,.28)",
        }}
      >
        ✦
      </span>
      <span>{value}</span>
    </div>
  );
}

function CurBadge({ cur, price }: { cur: Currency; price?: number }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        background: "linear-gradient(135deg,rgba(139,95,255,.94),rgba(90,158,255,.84))",
        color: "#fff",
        fontWeight: 800,
        boxShadow: "0 14px 26px rgba(91,92,255,.26)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: "rgba(255,255,255,.18)",
          fontSize: 11,
        }}
      >
        {cur === "STARS" ? "✦" : "R"}
      </span>
      {price !== undefined && <span>{price}</span>}
    </div>
  );
}

function BalanceChip({
  kind,
  value,
  onClick,
}: {
  kind: Currency;
  value: number;
  onClick?: () => void;
}) {
  const isStars = kind === "STARS";
  return (
    <button
      onClick={onClick}
      className="tap-scale"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
        border: `1px solid ${isStars ? "rgba(255,255,255,.12)" : "rgba(35,151,255,.22)"}`,
        borderRadius: 999,
        padding: "7px 12px",
        background: isStars ? "linear-gradient(180deg,#2B2B2B,#1C1C1C)" : "linear-gradient(180deg,rgba(16,43,68,.98),rgba(13,34,55,.98))",
        color: T.text,
        fontWeight: 900,
        cursor: "pointer",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.1), 0 10px 22px rgba(0,0,0,.32)",
        backdropFilter: "blur(18px)",
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: isStars ? "rgba(255,255,255,.1)" : "rgba(35,151,255,.18)",
          color: "#fff",
          fontSize: isStars ? 16 : 13,
          fontWeight: 1000,
        }}
      >
        {isStars ? "$" : "R$"}
      </span>
      <span style={{ whiteSpace: "nowrap", fontSize: 14, letterSpacing: ".01em" }}>
        {isStars ? `$ ${formatWorth(value || 0)}` : `${formatWorth(value || 0)} Robux`}
      </span>
    </button>
  );
}

function RoundIconButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="tap-scale"
      style={{
        width: 38,
        height: 38,
        border: `1px solid ${T.line2}`,
        borderRadius: 999,
        background: "rgba(18,14,35,.72)",
        color: T.text,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        boxShadow: "0 14px 28px rgba(4,2,12,.32)",
        backdropFilter: "blur(18px)",
      }}
    >
      {children}
    </button>
  );
}

function Avatar({ user, size = 42, onClick }: { user: User | null | undefined; size?: number; onClick?: () => void }) {
  const [failed, setFailed] = useState(false);
  const src = getAvatar(user);
  const letter = (getDisplayName(user)[0] || "?").toUpperCase();
  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        overflow: "hidden",
        background: src && !failed ? "transparent" : T.blue,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
        border: "1px solid rgba(255,255,255,.12)",
        boxShadow: "0 12px 24px rgba(5,3,13,.35)",
      }}
    >
      {src && !failed ? (
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setFailed(true)} />
      ) : (
        <span style={{ fontFamily: "'Sora',sans-serif", fontSize: size * 0.42 }}>{letter}</span>
      )}
    </div>
  );
}

function Toast({ message, type }: { message: string; type: "ok" | "err" }) {
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 90,
        transform: "translateX(-50%)",
        zIndex: 200,
        padding: "12px 16px",
        borderRadius: 18,
        background: "linear-gradient(180deg,rgba(25,18,49,.84),rgba(11,8,25,.96))",
        border: `1px solid ${type === "ok" ? "rgba(103,242,209,.42)" : "rgba(255,115,180,.42)"}`,
        color: type === "ok" ? T.green : T.red,
        fontWeight: 800,
        boxShadow: "0 20px 40px rgba(4,2,12,.52)",
        backdropFilter: "blur(22px)",
      }}
    >
      {message}
    </div>
  );
}

function Sheet({
  onClose,
  children,
  maxWidth = 540,
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(4,2,12,.76)", backdropFilter: "blur(10px)" }} />
      <div
        className="scroll"
        style={{
          position: "relative",
          width: "100%",
          maxWidth,
          maxHeight: "min(92dvh, calc(100dvh - 12px))",
          background: "linear-gradient(180deg,rgba(17,12,35,.92),rgba(8,6,18,.98))",
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          border: `1px solid ${T.line2}`,
          borderBottom: "none",
          padding: 18,
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          overscrollBehavior: "contain",
          boxShadow: "0 -18px 60px rgba(2,1,8,.65)",
          backdropFilter: "blur(26px)",
        }}
      >
        <div style={{ width: 50, height: 5, borderRadius: 999, background: "rgba(255,255,255,.18)", margin: "0 auto 16px" }} />
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
        <div className="title" style={{ fontSize: 18, whiteSpace: "nowrap" }}>
          {children}
        </div>
        <div style={{ height: 1, flex: 1, minWidth: 18, background: `linear-gradient(90deg,${T.line2},transparent)` }} />
      </div>
      {right}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          width: 78,
          height: 78,
          borderRadius: 26,
          background: "linear-gradient(135deg,#8B5FFF,#5F8DFF 60%,#59CFFF)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Sora',sans-serif",
          fontSize: 32,
          fontWeight: 700,
          boxShadow: "0 26px 60px rgba(95,89,255,.35)",
        }}
      >
        R
      </div>
      <Spinner />
    </div>
  );
}

function TelegramLoginScreen() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "roworth_bot";

  useEffect(() => {
    const container = document.getElementById("telegram-widget");
    if (!container) return;
    container.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    container.appendChild(script);
  }, [botUsername]);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 392, padding: 28, textAlign: "center", background: "linear-gradient(180deg,rgba(28,20,56,.8),rgba(10,7,20,.96))" }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 24,
            margin: "0 auto 16px",
            background: "linear-gradient(135deg,#8B5FFF,#5F8DFF 58%,#59CFFF)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Sora',sans-serif",
            fontSize: 34,
            fontWeight: 700,
            boxShadow: "0 24px 50px rgba(95,89,255,.34)",
          }}
        >
          R
        </div>
        <div className="title" style={{ fontSize: 30, marginBottom: 8 }}>
          RoWorth
        </div>
        <div style={{ color: T.text2, fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
          Маркет для Roblox-разработчиков прямо в Telegram Web App.
        </div>
        <div className="panel" style={{ padding: 14, marginBottom: 16, background: "linear-gradient(135deg,rgba(149,100,255,.24),rgba(89,207,255,.12))" }}>
          <div id="telegram-widget" style={{ display: "flex", justifyContent: "center", minHeight: 52 }} />
        </div>
        <div style={{ color: T.text3, fontSize: 12, lineHeight: 1.6 }}>Открой маркет через Telegram-бота или войди через виджет.</div>
      </div>
    </div>
  );
}

function SetupUsername({
  tgUser,
  onDone,
}: {
  tgUser: TelegramUser;
  onDone: (user: User) => void;
}) {
  const [username, setUsername] = useState(tgUser.username || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (clean.length < 3) {
      setError("Минимум 3 символа: латиница, цифры и нижнее подчеркивание.");
      return;
    }

    setLoading(true);
    setError("");

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", clean)
      .neq("id", String(tgUser.id))
      .maybeSingle();

    if (existing) {
      setLoading(false);
      setError("Этот username уже занят.");
      return;
    }

    const payload = {
      id: String(tgUser.id),
      username: clean,
      tg_username: tgUser.username || null,
      tg_name: `${tgUser.first_name}${tgUser.last_name ? ` ${tgUser.last_name}` : ""}`,
      tg_photo: tgUser.photo_url || null,
      bio: "",
      stars: 300,
      robux: 0,
      rating: 0,
      sales: 0,
      verified: false,
      plan: "FREE",
      worth: 0,
      review_count: 0,
      avatar_url: tgUser.photo_url || null,
      avatar_gif_url: null,
      name_color: null,
      name_font: "Sora",
      badge_icon: null,
      badge_label: null,
      badge_color: null,
      theme_color: null,
      theme_color_2: null,
      profile_banner: null,
    };

    const { data, error: upsertError } = await supabase.from("users").upsert(payload, { onConflict: "id" }).select().single();
    setLoading(false);

    if (upsertError || !data) {
      setError(upsertError?.message || "Не удалось создать профиль.");
      return;
    }

    onDone(data as User);
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 392, padding: 24 }}>
        <SectionTitle>Добро пожаловать</SectionTitle>
        <div className="panel" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, padding: 14 }}>
          <Avatar
            user={{
              id: String(tgUser.id),
              username: tgUser.username || tgUser.first_name,
              tg_username: tgUser.username || null,
              tg_name: tgUser.first_name,
              tg_photo: tgUser.photo_url || null,
              bio: "",
              stars: 0,
              robux: 0,
              rating: 0,
              sales: 0,
              verified: false,
              plan: "FREE",
              created_at: new Date().toISOString(),
            }}
            size={64}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{tgUser.first_name}</div>
            <div style={{ color: T.text2, fontSize: 13, lineHeight: 1.6 }}>Выбери username для маркетплейса.</div>
          </div>
        </div>
        <input className="inp" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
        {error && <div style={{ color: T.red, fontSize: 12, marginTop: 10 }}>{error}</div>}
        <button className="btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={submit} disabled={loading}>
          {loading ? <Spinner /> : "Продолжить"}
        </button>
      </div>
    </div>
  );
}

function OfferCard({
  offer,
  onOpen,
}: {
  offer: Offer;
  onOpen: (offer: Offer) => void;
}) {
  const cover = getOfferCover(offer);
  const seller = offer.user;
  return (
    <button
      onClick={() => onOpen(offer)}
      className="portal-card tap-scale"
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "linear-gradient(180deg,#202020,#181818)",
        border: "1px solid rgba(255,255,255,.05)",
        borderRadius: 22,
        padding: 10,
        overflow: "hidden",
        cursor: "pointer",
        color: T.text,
        boxShadow: "0 14px 34px rgba(0,0,0,.36)",
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "2.15 / 1",
          borderRadius: 16,
          background: cover ? `url(${cover}) center/cover` : getProfileGradient(seller),
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,.08)",
          marginBottom: 10,
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: cover ? "linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.08))" : "radial-gradient(circle at 50% 45%,rgba(255,255,255,.25),transparent 28%)" }} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.08, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {offer.title} <span style={{ color: T.text2, fontSize: 13, fontWeight: 900 }}>{offer.type}</span>
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,.55)", marginBottom: 9 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <Avatar user={seller} size={38} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: T.text2, fontSize: 12, fontWeight: 900, lineHeight: 1 }}>Продавец</div>
            <div style={{ color: T.text, fontSize: 15, fontWeight: 900, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              @{getUsername(seller)}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="tap-scale"
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,.08)",
            background: "#3A3A3A",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9h12l-1 10H7L6 9Z" />
            <path d="M9 9a3 3 0 0 1 6 0" />
          </svg>
        </button>
        <div
          style={{
            borderRadius: 999,
            padding: "11px 16px",
            background: "linear-gradient(180deg,#289CFF,#178CFA)",
            color: "#fff",
            fontSize: 16,
            fontWeight: 900,
            minWidth: 92,
            textAlign: "center",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.2)",
            flexShrink: 0,
          }}
        >
          {offer.price} {offer.cur === "ROBUX" ? "R$" : "$"}
        </div>
      </div>
    </button>
  );
}

function OfferSheet({
  offer,
  me,
  onClose,
  onBuy,
  onOpenChat,
  onOpenProfile,
}: {
  offer: Offer;
  me: User;
  onClose: () => void;
  onBuy: (offer: Offer) => Promise<void>;
  onOpenChat: (user: User) => void;
  onOpenProfile: (user: User) => void;
}) {
  const seller = offer.user;
  const cover = getOfferCover(offer);
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            height: 196,
            borderRadius: 24,
            background: cover ? `url(${cover}) center/cover` : getProfileGradient(seller),
            border: `1px solid ${T.line}`,
            boxShadow: "0 18px 40px rgba(4,2,12,.34)",
          }}
        />
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div className="title" style={{ fontSize: 24, marginBottom: 4 }}>
                {offer.title}
              </div>
              <div style={{ color: T.text2, fontSize: 13 }}>
                {KIND_LABELS[offer.kind]} • {offer.type}
              </div>
            </div>
            <CurBadge cur={offer.cur} price={offer.price} />
          </div>
          <div style={{ color: T.text2, lineHeight: 1.7, marginTop: 12 }}>{offer.description}</div>
        </div>

        {seller && (
          <button
            onClick={() => onOpenProfile(seller)}
            className="panel"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 14,
              textAlign: "left",
              background: "linear-gradient(180deg,rgba(27,20,51,.82),rgba(12,9,25,.92))",
              color: T.text,
              cursor: "pointer",
            }}
          >
            <Avatar user={seller} size={54} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700 }}>@{getUsername(seller)}</span>
                {seller.verified && <span className="blue-badge">Проверен</span>}
                <RoleBadge user={seller} />
              </div>
              <div style={{ color: T.text2, fontSize: 12, marginTop: 4 }}>
                Market ID #{seller.marketplace_id || "—"} • Отзывов: {seller.review_count || 0} • Продаж: {seller.sales || 0}
              </div>
            </div>
          </button>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="panel" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>Продаж</div>
            <div style={{ fontWeight: 700, color: T.gold }}>{offer.sales || 0}</div>
          </div>
          <div className="panel" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>В наличии</div>
            <div style={{ fontWeight: 700 }}>{Math.max(0, Number(offer.stock ?? 1))} шт.</div>
          </div>
        </div>

        <div className="panel" style={{ padding: 12, color: T.text2, fontSize: 13 }}>
          Offer ID: {offer.id} • Создан: {formatDate(offer.created_at)}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {seller && seller.id !== me.id && (
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => onOpenChat(seller)}>
              Написать
            </button>
          )}
          <button className="btn-primary" style={{ flex: 1 }} onClick={() => onBuy(offer)} disabled={offer.uid === me.id || Number(offer.stock ?? 1) < 1}>
            {offer.uid === me.id ? "Ваш товар" : Number(offer.stock ?? 1) < 1 ? "Нет в наличии" : "Купить"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function CreateOfferSheet({
  me,
  onClose,
  onCreated,
  showToast,
}: {
  me: User;
  onClose: () => void;
  onCreated: (offer: Offer) => void;
  showToast: (message: string, type?: "ok" | "err") => void;
}) {
  const [kind, setKind] = useState<OfferKind>("PRODUCT");
  const [type, setType] = useState(OFFER_TYPES.PRODUCT[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [cur, setCur] = useState<Currency>("STARS");
  const [stock, setStock] = useState("1");
  const [banner, setBanner] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [auto, setAuto] = useState(false);
  const [autoContent, setAutoContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<number[]>(() => OFFER_QUIZ.map(() => -1));
  const [quizPassed, setQuizPassed] = useState(false);
  const bannerFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setType(OFFER_TYPES[kind][0]);
  }, [kind]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const passed = window.localStorage.getItem(getOfferRulesStorageKey(me.id)) === "1";
    if (passed) {
      setAcceptedRules(true);
      setQuizPassed(true);
    }
  }, [me.id]);

  const submitQuiz = () => {
    if (quizAnswers.some((answer) => answer < 0)) {
      showToast("Ответь на все вопросы теста.", "err");
      return;
    }
    const passed = OFFER_QUIZ.every((item, index) => quizAnswers[index] === item.correct);
    if (!passed) {
      setQuizAnswers(OFFER_QUIZ.map(() => -1));
      setAcceptedRules(false);
      showToast("Есть ошибки. Ознакомься с правилами и пройди тест заново.", "err");
      return;
    }
    setQuizPassed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(getOfferRulesStorageKey(me.id), "1");
    }
    showToast("Тест пройден. Теперь можно публиковать оффер.");
  };

  const submit = async () => {
    if (!title.trim() || !description.trim() || Number(price) < MIN_OFFER_PRICE_STARS) {
      showToast(`Минимальная цена товара ${MIN_OFFER_PRICE_STARS} Stars.`, "err");
      return;
    }

    if (Number(stock) < 1) {
      showToast("Укажи количество товара, минимум 1 шт.", "err");
      return;
    }

    setSaving(true);
    const payload = {
      id: `offer_${Date.now()}`,
      uid: me.id,
      title: title.trim(),
      description: description.trim(),
      kind,
      type,
      price: Number(price),
      cur,
      stock: Number(stock),
      auto,
      auto_content: auto ? autoContent.trim() || null : null,
      banner: (images[0] || banner).trim() || null,
      images: images.length ? images : null,
      cover_index: 0,
      boosted: 0,
      boost_end: 0,
      sales: 0,
      rating: 0,
    };

    let response = await supabase.from("offers").insert(payload).select("*, user:users(*)").single();

    if (response.error?.message?.includes("stock")) {
      const legacyPayload = {
        id: payload.id,
        uid: payload.uid,
        title: payload.title,
        description: payload.description,
        kind: payload.kind,
        type: payload.type,
        price: payload.price,
        cur: payload.cur,
        auto: payload.auto,
        auto_content: payload.auto_content,
        banner: payload.banner,
        images: payload.images,
        cover_index: 0,
        boosted: payload.boosted,
        boost_end: payload.boost_end,
        sales: payload.sales,
        rating: payload.rating,
      };
      response = await supabase.from("offers").insert(legacyPayload).select("*, user:users(*)").single();
    }

    setSaving(false);

    if (response.error || !response.data) {
      const message =
        response.error?.message?.includes("stock")
          ? "В базе не хватает новой колонки stock. Прогони sql/roworth_tz_upgrade.sql в Supabase."
          : response.error?.message || "Не удалось создать предложение.";
      showToast(message, "err");
      return;
    }

    onCreated(response.data as unknown as Offer);
    onClose();
    showToast("Предложение опубликовано.");
  };

  return (
    <Sheet onClose={onClose}>
      <SectionTitle>Новое предложение</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!quizPassed ? (
          <>
            <div className="panel" style={{ padding: 14 }}>
              <div className="title" style={{ fontSize: 18, marginBottom: 10 }}>
                Правила публикации
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, color: T.text2, lineHeight: 1.6 }}>
                {OFFER_RULES.map((rule) => (
                  <div key={rule}>• {rule}</div>
                ))}
              </div>
            </div>

            <label className="panel" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <input type="checkbox" checked={acceptedRules} onChange={(e) => setAcceptedRules(e.target.checked)} />
              <div style={{ color: T.text2, lineHeight: 1.6 }}>Я ознакомился с правилами и понимаю, что за нарушения можно получить бан на маркете.</div>
            </label>

            {acceptedRules && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {OFFER_QUIZ.map((item, index) => (
                  <div key={item.id} className="panel" style={{ padding: 14 }}>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>{index + 1}. {item.question}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {item.options.map((option, optionIndex) => (
                        <label key={option} style={{ display: "flex", alignItems: "center", gap: 10, color: T.text2 }}>
                          <input
                            type="radio"
                            name={item.id}
                            checked={quizAnswers[index] === optionIndex}
                            onChange={() =>
                              setQuizAnswers((current) => current.map((answer, currentIndex) => (currentIndex === index ? optionIndex : answer)))
                            }
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <button className="btn-primary" onClick={submitQuiz}>
                  Пройти тест
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="panel" style={{ padding: 12, color: T.green }}>
              Доступ к публикации открыт. Тест по правилам пройден.
            </div>
            <input className="inp" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="Название" />
            <textarea className="inp" rows={5} value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))} placeholder="Описание" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <select className="inp" value={kind} onChange={(e) => setKind(e.target.value as OfferKind)}>
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select className="inp" value={type} onChange={(e) => setType(e.target.value)}>
                {OFFER_TYPES[kind].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <input className="inp" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="Цена" />
              <input className="inp" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/[^\d]/g, ""))} placeholder="Количество" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <select className="inp" value={cur} onChange={(e) => setCur(e.target.value as Currency)}>
                <option value="STARS">Stars</option>
                <option value="ROBUX">Robux</option>
              </select>
              <div className="panel" style={{ padding: 12, color: T.text2, fontSize: 12 }}>
                Минимальная цена: {MIN_OFFER_PRICE_STARS} Stars
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input className="inp" style={{ flex: 1, minWidth: 220 }} value={banner} onChange={(e) => setBanner(e.target.value)} placeholder="Ссылка или data-url баннера" />
              <button className="btn-ghost" type="button" onClick={() => bannerFileRef.current?.click()}>
                Загрузить до 2 фото
              </button>
            </div>
            {images.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {images.map((image, index) => (
                  <div key={image} style={{ position: "relative" }}>
                    <img src={image} alt="" style={{ width: 74, height: 74, objectFit: "cover", borderRadius: 12, border: `1px solid ${T.line}` }} />
                    <button
                      type="button"
                      onClick={() => setImages((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                      style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 999, border: "none", background: T.red, color: "#fff", cursor: "pointer" }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={bannerFileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={async (event) => {
                const files = Array.from(event.target.files || []).slice(0, 2);
                if (!files.length) return;
                const nextImages = await Promise.all(files.map((file) => readImageAsDataUrl(file)));
                setImages(nextImages.slice(0, 2));
                setBanner(nextImages[0] || "");
                event.target.value = "";
              }}
            />
            <label className="panel" style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Автовыдача</div>
                <div style={{ fontSize: 12, color: T.text2 }}>Если включена, покупатель получает контент сразу после оплаты.</div>
              </div>
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            </label>
            {auto && (
              <textarea
                className="inp"
                rows={4}
                value={autoContent}
                onChange={(e) => setAutoContent(e.target.value)}
                placeholder="Что получит покупатель: ссылка, ключ, инструкция и т.д."
              />
            )}
            <button className="btn-primary" onClick={submit} disabled={saving}>
              {saving ? <Spinner /> : "Опубликовать"}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function UserProfileSheet({
  user,
  me,
  onClose,
  onOpenOffer,
  onOpenChat,
}: {
  user: User;
  me: User;
  onClose: () => void;
  onOpenOffer: (offer: Offer) => void;
  onOpenChat: (user: User) => void;
}) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: offersData }, { data: reviewsData }] = await Promise.all([
        supabase.from("offers").select("*, user:users(*)").eq("uid", user.id).order("created_at", { ascending: false }),
        supabase.from("reviews").select("*, buyer:users!buyer_uid(*)").eq("seller_uid", user.id).order("created_at", { ascending: false }).limit(20),
      ]);

      setOffers((offersData || []) as unknown as Offer[]);
      setReviews((reviewsData || []) as Review[]);
      setLoading(false);
    };

    load();
  }, [user.id]);

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            height: 130,
            borderRadius: 18,
            background: user.profile_banner ? `url(${user.profile_banner}) center/cover` : getProfileGradient(user),
            border: `1px solid ${T.line}`,
          }}
        />
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Avatar user={user} size={72} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div
                className="title"
                style={{
                  fontSize: 22,
                  color: user.name_color || T.text,
                  fontFamily: user.name_font ? `'${user.name_font}',sans-serif` : "'Sora',sans-serif",
                }}
              >
                @{getUsername(user)}
              </div>
              {user.verified && <span className="blue-badge">Проверен</span>}
              <RoleBadge user={user} />
            </div>
            <div style={{ fontSize: 12, color: T.text2, marginTop: 6 }}>
              Market ID #{user.marketplace_id || "—"} • Продаж: {user.sales || 0} • Отзывов: {user.review_count || 0}
            </div>
          </div>
        </div>
        {user.bio && <div className="panel" style={{ padding: 14, color: T.text2, lineHeight: 1.7 }}>{user.bio}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(88px,1fr))", gap: 10 }}>
          {[
            { label: "Офферы", value: offers.length },
            { label: "Рейтинг", value: user.rating || 0 },
            { label: "Отзывы", value: user.review_count || reviews.length },
            { label: "Продажи", value: user.sales || 0 },
          ].map((item) => (
            <div key={item.label} className="panel" style={{ padding: 12, textAlign: "center" }}>
              <div className="title" style={{ color: T.gold, fontSize: 20 }}>
                {item.value}
              </div>
              <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {user.id !== me.id && (
          <button className="btn-ghost" onClick={() => onOpenChat(user)}>
            Написать продавцу
          </button>
        )}

        <SectionTitle>Товары в продаже</SectionTitle>
        {loading && <Spinner />}
        {!loading && offers.length === 0 && <div style={{ color: T.text3, fontSize: 13 }}>У продавца пока нет активных предложений.</div>}
        {!loading && offers.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} onOpen={onOpenOffer} />
            ))}
          </div>
        )}

        <SectionTitle>Отзывы</SectionTitle>
        {reviews.length === 0 && <div style={{ color: T.text3, fontSize: 13 }}>Пока нет отзывов.</div>}
        {reviews.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {reviews.map((review) => (
              <div key={review.id} className="panel" style={{ padding: 14 }}>
                {(() => {
                  const priceMeta = parseReviewPrice(review.text || "");
                  const cleanText = priceMeta ? priceMeta.text : review.text;
                  return (
                    <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>@{getUsername(review.buyer)}</div>
                  <div style={{ color: T.gold }}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
                </div>
                {priceMeta && <div style={{ color: T.text3, fontSize: 12, marginBottom: 6 }}>Сумма сделки: {formatPrice(priceMeta.price, priceMeta.cur)}</div>}
                <div style={{ color: T.text2, lineHeight: 1.7 }}>{cleanText || "Без текста"}</div>
                <div style={{ color: T.text3, fontSize: 12, marginTop: 8 }}>{formatDate(review.created_at)}</div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function HomeScreen({
  me,
  onOpenOffer,
  onOpenMenu,
  onOpenWallet,
}: {
  me: User;
  onOpenOffer: (offer: Offer) => void;
  onOpenMenu: () => void;
  onOpenWallet: () => void;
}) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<OfferKind | "ALL">("ALL");
  const [currencyFilter, setCurrencyFilter] = useState<Currency | "ALL">("ALL");
  const [sort, setSort] = useState<"new" | "sales" | "price_asc" | "price_desc">("new");
  const [showFilters, setShowFilters] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [priceLimit, setPriceLimit] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("offers").select("*, user:users(*)").order("created_at", { ascending: false });
      setOffers((data || []) as unknown as Offer[]);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel("offers_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "offers" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    let result = [...offers];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((offer) => offer.title.toLowerCase().includes(q) || offer.description.toLowerCase().includes(q) || offer.type.toLowerCase().includes(q));
    }

    if (kindFilter !== "ALL") {
      result = result.filter((offer) => offer.kind === kindFilter);
    }

    if (currencyFilter !== "ALL") {
      result = result.filter((offer) => offer.cur === currencyFilter);
    }

    if (priceLimit > 0) {
      result = result.filter((offer) => offer.price <= priceLimit);
    }

    if (sort === "sales") result.sort((a, b) => (b.sales || 0) - (a.sales || 0));
    if (sort === "price_asc") result.sort((a, b) => a.price - b.price);
    if (sort === "price_desc") result.sort((a, b) => b.price - a.price);
    if (sort === "new") result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return result;
  }, [currencyFilter, kindFilter, offers, priceLimit, search, sort]);

  const maxOfferPrice = useMemo(() => Math.max(0, ...offers.map((offer) => Number(offer.price || 0))), [offers]);
  const openTelegram = (handle: string) => {
    window.open(`https://t.me/${handle.replace(/^@/, "")}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="scroll" style={{ flex: 1, padding: "14px 12px 108px", background: "#101010" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button
            className="btn-ghost tap-scale"
            style={{ borderRadius: 999, padding: "8px 13px", background: "#2B2B2B", color: "#fff", fontSize: 15, fontWeight: 900 }}
            onClick={() => getTelegramWebApp()?.close()}
          >
            × Закрыть
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RoundIconButton onClick={onOpenMenu} label="Меню">
              <span style={{ fontSize: 22, lineHeight: 1, marginTop: -6 }}>...</span>
            </RoundIconButton>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <BalanceChip kind="STARS" value={me.stars} onClick={onOpenWallet} />
          <BalanceChip kind="ROBUX" value={me.robux} onClick={onOpenWallet} />
        </div>

        {!compactMode && <button
          className="portal-appear"
          onClick={() => openTelegram("@RoWorth")}
          style={{
            position: "relative",
            overflow: "hidden",
            display: "block",
            width: "100%",
            textAlign: "left",
            border: "1px solid rgba(255,255,255,.08)",
            minHeight: 92,
            borderRadius: 22,
            padding: 16,
            marginBottom: 17,
            background: "radial-gradient(circle at 80% 34%,rgba(170,230,255,.86),transparent 18%),radial-gradient(circle at 62% 60%,rgba(63,142,255,.8),transparent 24%),radial-gradient(circle at 34% 48%,rgba(119,72,255,.85),transparent 32%),linear-gradient(135deg,#171128,#315DCE 58%,#B6EDFF)",
            boxShadow: "0 22px 48px rgba(0,0,0,.38)",
            cursor: "pointer",
            color: "#fff",
          }}
        >
          <div className="portal-float" style={{ position: "absolute", right: 18, top: 13, width: 86, height: 62, borderRadius: 18, background: "linear-gradient(135deg,rgba(255,255,255,.4),rgba(255,255,255,.08))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.28)" }} />
          <div style={{ position: "absolute", right: 105, bottom: 14, width: 40, height: 40, borderRadius: 999, border: "6px solid rgba(255,255,255,.28)", boxShadow: "0 0 22px rgba(255,255,255,.24)" }} />
          <div className="title" style={{ position: "relative", fontSize: 28, lineHeight: 1, textShadow: "0 2px 14px rgba(0,0,0,.34)" }}>
            Подпишись на новости
          </div>
          <div style={{ position: "relative", display: "inline-flex", marginTop: 6, padding: "4px 9px", borderRadius: 999, background: "rgba(88,55,160,.58)", color: "#fff", fontSize: 17, lineHeight: 1, fontWeight: 900 }}>
            @RoWorth
          </div>
        </button>}

        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14 }}>
          <button className="tap-scale" onClick={() => setKindFilter("ALL")} style={{ border: "none", background: "transparent", padding: 0, color: kindFilter === "ALL" ? "#fff" : "#3D3D3D", fontSize: 28, lineHeight: 1, fontWeight: 900, cursor: "pointer" }}>
            Все товары
          </button>
          <button className="tap-scale" onClick={onOpenWallet} style={{ border: "none", background: "transparent", padding: 0, color: "#3D3D3D", fontSize: 25, lineHeight: 1, fontWeight: 900, cursor: "pointer" }}>
            Корзина
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 46px 46px", gap: 8, marginBottom: 10 }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#6B6B6B", fontSize: 25, lineHeight: 1 }}>⌕</span>
            <input
              className="inp"
              style={{ height: 46, paddingLeft: 43, fontSize: 15, fontWeight: 900, borderRadius: 999, background: "#1A1A1A" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Быстрый поиск"
            />
          </div>
          <button className="btn-ghost tap-scale" title="Фильтры" style={{ width: 46, height: 46, borderRadius: 999, padding: 0, background: showFilters ? "#2F2F2F" : "#1E1E1E" }} onClick={() => setShowFilters((value) => !value)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D8D8D8" strokeWidth="2.8" strokeLinecap="round">
              <path d="M5 7h14M5 12h14M5 17h14" />
            </svg>
          </button>
          <button className="btn-ghost tap-scale" title="Свернуть баннер" style={{ width: 46, height: 46, borderRadius: 999, padding: 0, background: "#fff" }} onClick={() => setCompactMode((value) => !value)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path d={compactMode ? "m6 10 6 6 6-6" : "m6 14 6-6 6 6"} />
            </svg>
          </button>
        </div>

        {showFilters && <div className="panel portal-appear" style={{ display: "grid", gridTemplateColumns: "1fr 88px", alignItems: "center", minHeight: 54, borderRadius: 18, padding: "9px 12px", marginBottom: 10, background: "#1A1A1A" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <input
              className="range-clean"
              min={0}
              max={Math.max(1, maxOfferPrice)}
              step={1}
              value={priceLimit}
              onChange={(event) => setPriceLimit(Number(event.target.value))}
              aria-label="Фильтр по цене"
            />
          </div>
          <div style={{ borderLeft: "1px solid #555", paddingLeft: 14, textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>{priceLimit > 0 ? `$ ${priceLimit}` : "Любая"}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#686868" }}>{filtered.length} шт.</div>
          </div>
        </div>}

        {showFilters && <div className="hide-scrollbar portal-appear" style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>
          <button className="btn-ghost tap-scale" style={{ width: 42, height: 42, borderRadius: 999, padding: 0, background: "#222" }} onClick={() => setCurrencyFilter("ALL")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#A7A7A7"><path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" /></svg>
          </button>
          <button className="btn-ghost tap-scale" style={{ width: 42, height: 42, borderRadius: 999, padding: 0, background: "#222" }} onClick={() => setSort(sort === "price_asc" ? "price_desc" : "price_asc")}>
            <span style={{ color: "#A7A7A7", fontSize: 24, fontWeight: 900, lineHeight: 1 }}>↕</span>
          </button>
          <div style={{ width: 1, height: 30, background: "#444", margin: "0 5px" }} />
          <button className={`pill${currencyFilter === "STARS" ? " active" : ""}`} style={{ height: 42, padding: "0 15px", fontSize: 14 }} onClick={() => setCurrencyFilter(currencyFilter === "STARS" ? "ALL" : "STARS")}>Доллары</button>
          <button className={`pill${currencyFilter === "ROBUX" ? " active" : ""}`} style={{ height: 42, padding: "0 15px", fontSize: 14 }} onClick={() => setCurrencyFilter(currencyFilter === "ROBUX" ? "ALL" : "ROBUX")}>Robux</button>
          <button className={`pill${kindFilter === "SERVICE" ? " active" : ""}`} style={{ height: 42, padding: "0 15px", fontSize: 14 }} onClick={() => setKindFilter(kindFilter === "SERVICE" ? "ALL" : "SERVICE")}>Услуги</button>
        </div>}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Spinner />
          </div>
        )}

        {!loading && filtered.length === 0 && <div style={{ color: T.text3, textAlign: "center", padding: "60px 0" }}>Ничего не найдено.</div>}

        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((offer) => (
              <OfferCard key={offer.id} offer={offer} onOpen={onOpenOffer} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatsScreen({
  me,
  onOpenChat,
  onOpenSupportChat,
  onOpenSupport,
}: {
  me: User;
  onOpenChat: (user: User) => void;
  onOpenSupportChat: () => void;
  onOpenSupport: () => void;
}) {
  const [conversations, setConversations] = useState<Array<{ user: User; last: Message; unread: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*, from_user:users!from_uid(*), to_user:users!to_uid(*)")
        .or(`from_uid.eq.${me.id},to_uid.eq.${me.id}`)
        .order("created_at", { ascending: true });

      const map = new Map<string, { user: User; last: Message; unread: number }>();

      ((data || []) as Array<Message & { from_user: User; to_user: User }>).forEach((message) => {
        if (isSupportMessage(message)) return;
        const otherId = message.from_uid === me.id ? message.to_uid : message.from_uid;
        const otherUser = message.from_uid === me.id ? message.to_user : message.from_user;
        if (!otherUser || otherId === me.id) return;
        const prev = map.get(otherId);
        map.set(otherId, {
          user: otherUser,
          last: message,
          unread: (prev?.unread || 0) + (!message.read && message.to_uid === me.id ? 1 : 0),
        });
      });

      setConversations([...map.values()].sort((a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime()));
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`chat_list_${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me.id]);

  return (
    <div className="scroll" style={{ height: "100%", padding: 16, paddingBottom: "calc(118px + env(safe-area-inset-bottom, 0px))", background: getProfileScreenBackground(me) }}>
      <SectionTitle>Сообщения</SectionTitle>
      <div className="chat-shortcuts-grid">
        <button className="btn-ghost" style={{ width: "100%" }} onClick={onOpenSupportChat}>
          Чат саппорта
        </button>
        <button className="btn-ghost" style={{ width: "100%" }} onClick={onOpenSupport}>
          Заявка
        </button>
      </div>
      {loading && <Spinner />}
      {!loading && conversations.length === 0 && <div style={{ color: T.text3 }}>У тебя пока нет диалогов.</div>}
      {!loading && conversations.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {conversations.map((conversation) => (
            <button
              key={conversation.user.id}
              onClick={() => onOpenChat(conversation.user)}
              className="panel"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 14,
                textAlign: "left",
                background: T.bg2,
                color: T.text,
                cursor: "pointer",
              }}
            >
              <Avatar user={conversation.user} size={50} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                  <div style={{ fontWeight: 700 }}>@{getUsername(conversation.user)}</div>
                  <div style={{ color: T.text3, fontSize: 12 }}>{formatTime(conversation.last.created_at)}</div>
                </div>
                <div style={{ color: T.text2, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {conversation.last.from_uid === me.id ? "Вы: " : ""}
                  {conversation.last.text || "Новое сообщение"}
                </div>
              </div>
              {conversation.unread > 0 && (
                <div
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: 999,
                    background: T.red,
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 6px",
                  }}
                >
                  {conversation.unread}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatView({
  me,
  partner,
  messages,
  mode = "regular",
  onBack,
  onSend,
  onOpenProfile,
}: {
  me: User;
  partner: User;
  messages: Message[];
  mode?: ChatMode;
  onBack: () => void;
  onSend: (payload: { text?: string; img?: string | null; fileName?: string | null; fileType?: string | null }) => Promise<boolean>;
  onOpenProfile: (user: User) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = messageListRef.current;
    if (!node) return;
    const raf = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages]);

  return (
    <div className="chat-shell">
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 16, borderBottom: `1px solid ${T.line}`, background: "rgba(8,6,18,.46)", backdropFilter: "blur(18px)", flexShrink: 0 }}>
        <button className="btn-ghost" onClick={onBack}>
          Назад
        </button>
        <button
          onClick={() => onOpenProfile(partner)}
          style={{ display: "flex", alignItems: "center", gap: 12, background: "transparent", border: "none", color: T.text, cursor: "pointer", padding: 0, minWidth: 0, flex: 1 }}
        >
          <Avatar user={partner} size={46} />
          <div style={{ textAlign: "left", minWidth: 0 }}>
            <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mode === "support" ? `Саппорт • @${getUsername(partner)}` : `@${getUsername(partner)}`}</div>
            <div style={{ fontSize: 12, color: T.text3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mode === "support" ? "Отдельный чат поддержки" : `Market ID #${partner.marketplace_id || "—"}`}</div>
          </div>
        </button>
      </div>

      <div ref={messageListRef} className="scroll chat-feed">
        <div className="chat-feed-inner">
          <div className="chat-feed-stack">
            {messages.map((message) => {
              const mine = message.from_uid === me.id;
              const system = isSystemMessage(message);
              const support = isSupportMessage(message);
              if (system) {
                return (
                  <div key={message.id} style={{ display: "flex", justifyContent: "center" }}>
                    <div
                      style={{
                        maxWidth: "92%",
                        padding: "10px 14px",
                        borderRadius: 18,
                        background: "rgba(255,255,255,.04)",
                        border: `1px solid ${T.line2}`,
                        color: T.text2,
                        textAlign: "center",
                        backdropFilter: "blur(18px)",
                      }}
                    >
                      <div style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{message.text}</div>
                      <div style={{ fontSize: 11, color: T.text3, marginTop: 6 }}>{formatTime(message.created_at)}</div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={message.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <div
                    style={{
                      maxWidth: "82%",
                      padding: "12px 14px",
                      borderRadius: mine ? "22px 22px 8px 22px" : "22px 22px 22px 8px",
                      background: support
                        ? "linear-gradient(135deg,rgba(105,200,255,.20),rgba(154,99,255,.18))"
                        : mine
                          ? "linear-gradient(135deg,rgba(139,95,255,.34),rgba(89,207,255,.22))"
                          : "linear-gradient(180deg,rgba(27,20,51,.82),rgba(12,9,25,.92))",
                      border: `1px solid ${support ? "rgba(105,200,255,.26)" : mine ? "rgba(154,99,255,.26)" : T.line}`,
                      boxShadow: support ? "0 14px 30px rgba(60,120,255,.12)" : "0 14px 30px rgba(4,2,12,.2)",
                      backdropFilter: "blur(18px)",
                    }}
                  >
                    {support && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.blue, marginBottom: 6 }}>
                        {mine ? "Ответ саппорта" : "Сообщение саппорта"}
                      </div>
                    )}
                    {message.img ? (
                      <img src={message.img} alt={message.file_name || "attachment"} style={{ width: "100%", maxWidth: 260, borderRadius: 12, display: "block" }} />
                    ) : null}
                    {message.text ? <div style={{ lineHeight: 1.6, marginTop: message.img ? 10 : 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{message.text}</div> : null}
                    <div style={{ fontSize: 11, color: T.text3, marginTop: 6 }}>{formatTime(message.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${T.line}`, padding: 12, paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", background: "rgba(8,6,18,.56)", backdropFilter: "blur(18px)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button className={`pill${showStickerPicker ? " active" : ""}`} disabled={sending} onClick={() => setShowStickerPicker((current) => !current)}>
            Стикеры
          </button>
          <button className="btn-ghost" disabled={sending} onClick={() => fileRef.current?.click()}>
            Фото из галереи
          </button>
        </div>
        {showStickerPicker && (
          <div className="hide-scrollbar" style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 10 }}>
            {CHAT_STICKERS.map((sticker) => (
              <button
                key={sticker}
                className="btn-ghost"
                style={{ padding: 6, width: 54, height: 54, flexShrink: 0 }}
                disabled={sending}
                onClick={async () => {
                  setSending(true);
                  const ok = await onSend({ text: sticker, fileType: "emoji" });
                  setSending(false);
                  if (ok) setShowStickerPicker(false);
                }}
              >
                <span style={{ fontSize: 24, lineHeight: 1 }}>{sticker}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea className="inp" rows={2} value={text} onChange={(e) => setText(e.target.value.slice(0, 400))} placeholder="Сообщение..." style={{ width: "100%", minWidth: 0 }} />
          <button
            className="btn-primary"
            disabled={sending}
            style={{ width: "100%" }}
            onClick={async () => {
              if (!text.trim()) return;
              setSending(true);
              const ok = await onSend({ text: text.trim() });
              setSending(false);
              if (ok) setText("");
            }}
          >
            {sending ? <Spinner /> : "Отправить"}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              setSending(true);
              const img = await readImageAsDataUrl(file);
              await onSend({ img, fileName: file.name, fileType: file.type || "image" });
            } finally {
              setSending(false);
            }
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function SupportSheet({
  me,
  onClose,
  onSubmit,
}: {
  me: User;
  onClose: () => void;
  onSubmit: (payload: { reason: SupportReason; nickname: string; orderId: string; role: SupportRole; text: string }) => Promise<void>;
}) {
  const [reason, setReason] = useState<SupportReason>("ORDER");
  const [nickname, setNickname] = useState(me.username || "");
  const [orderId, setOrderId] = useState("");
  const [role, setRole] = useState<SupportRole>("BUYER");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <Sheet onClose={onClose}>
      <SectionTitle>Помощь и модерация</SectionTitle>
      <div style={{ color: T.text2, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
        Опиши проблему, и заявка уйдет в чат модераторов. Чем подробнее форма, тем быстрее ответ.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Что привело вас сюда?</div>
          <select className="inp" value={reason} onChange={(e) => setReason(e.target.value as SupportReason)}>
            {SUPPORT_REASONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Ваш ник на маркете</div>
          <input className="inp" value={nickname} onChange={(e) => setNickname(e.target.value.slice(0, 60))} placeholder="@username" />
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Номер заказа</div>
          <input className="inp" value={orderId} onChange={(e) => setOrderId(e.target.value.slice(0, 80))} placeholder="Если есть, укажи ID заказа" />
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Кто вы в этой ситуации?</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className={`pill${role === "BUYER" ? " active" : ""}`} onClick={() => setRole("BUYER")}>
              Покупатель
            </button>
            <button className={`pill${role === "SELLER" ? " active" : ""}`} onClick={() => setRole("SELLER")}>
              Продавец
            </button>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Комментарий</div>
          <textarea className="inp" rows={7} value={text} onChange={(e) => setText(e.target.value.slice(0, 1200))} placeholder="Опиши проблему подробно..." />
        </div>
        <button
          className="btn-primary"
          disabled={sending}
          onClick={async () => {
            if (!nickname.trim() || !text.trim()) return;
            setSending(true);
            await onSubmit({ reason, nickname: nickname.trim(), orderId: orderId.trim(), role, text: text.trim() });
            setSending(false);
          }}
        >
          {sending ? <Spinner /> : "Отправить заявку"}
        </button>
      </div>
    </Sheet>
  );
}

function OrdersScreen({
  me,
  showToast,
  notifyTelegram,
}: {
  me: User;
  showToast: (message: string, type?: "ok" | "err") => void;
  notifyTelegram: (chatId: string, text: string, buttonText?: string, buttonUrl?: string) => Promise<void>;
}) {
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<Order | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [savingReview, setSavingReview] = useState(false);

  const load = useCallback(async () => {
    const [{ data: sellerData }, { data: buyerData }] = await Promise.all([
      supabase.from("orders").select("*, buyer:users!buyer_uid(*)").eq("seller_uid", me.id).order("created_at", { ascending: false }),
      supabase.from("orders").select("*, seller:users!seller_uid(*)").eq("buyer_uid", me.id).order("created_at", { ascending: false }),
    ]);
    setSellerOrders((sellerData || []) as Order[]);
    setBuyerOrders((buyerData || []) as Order[]);
    setLoading(false);
  }, [me.id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`orders_${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, me.id]);

  const confirmOrder = async (order: Order) => {
    await supabase.from("orders").update({ status: "confirmed" }).eq("id", order.id);
    const text = `Заказ #${shortOrderId(order.id)} подтвержден продавцом. Теперь ты можешь оставить отзыв в разделе заказов.`;
    await supabase.from("messages").insert({
      id: `sys_${Date.now()}`,
      from_uid: me.id,
      to_uid: order.buyer_uid,
      text,
      img: null,
      read: false,
      file_type: "system",
    });
    await notifyTelegram(order.buyer_uid, text, "Открыть маркет", getAppBaseUrl());
    showToast("Заказ подтвержден.");
    await load();
  };

  const submitReview = async () => {
    if (!reviewing) return;
    if (reviewText.trim().length > 200) {
      showToast("Отзыв должен быть до 200 символов.", "err");
      return;
    }

    setSavingReview(true);

    const { error } = await supabase.from("reviews").insert({
      id: `rev_${Date.now()}`,
      order_id: reviewing.id,
      seller_uid: reviewing.seller_uid,
      buyer_uid: me.id,
      rating: reviewRating,
      text: `[#price=${reviewing.price} ${reviewing.cur}] ${reviewText.trim()}`,
    });

    if (error) {
      setSavingReview(false);
      showToast(error.message || "Не удалось сохранить отзыв.", "err");
      return;
    }

    await supabase.from("orders").update({ review_left: true }).eq("id", reviewing.id);
    const { data: ratingsData } = await supabase.from("reviews").select("rating").eq("seller_uid", reviewing.seller_uid);
    const ratings = (ratingsData || []).map((row: { rating: number }) => Number(row.rating || 0)).filter(Boolean);
    const average = ratings.length ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2)) : 0;
    await supabase.from("users").update({ rating: average, review_count: ratings.length }).eq("id", reviewing.seller_uid);

    const sellerUsername = getUsername(reviewing.seller);
    await notifyTelegram(
      reviewing.seller_uid,
      `Новый отзыв от @${getUsername(me)}\nОценка: ${reviewRating}/5\nПродавец: @${sellerUsername}`,
      "Открыть маркет",
      getAppBaseUrl()
    );

    setSavingReview(false);
    setReviewing(null);
    setReviewText("");
    setReviewRating(5);
    showToast("Отзыв сохранен.");
    await load();
  };

  const pendingSellerOrders = sellerOrders.filter((order) => order.status === "pending");
  const completedSellerOrders = sellerOrders.filter((order) => order.status === "confirmed");

  return (
    <div className="scroll" style={{ height: "100%", padding: 16, paddingBottom: "calc(118px + env(safe-area-inset-bottom, 0px))" }}>
      <SectionTitle>Заказы</SectionTitle>
      {loading && <Spinner />}
      {!loading && sellerOrders.length === 0 && buyerOrders.length === 0 && <div style={{ color: T.text3 }}>Пока нет заказов.</div>}

      {pendingSellerOrders.length > 0 && (
        <>
          <SectionTitle>Нужно подтвердить</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
            {pendingSellerOrders.map((order) => (
              <div key={order.id} className="panel" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{order.offer_snap?.title || "Товар"}</div>
                    <div style={{ fontSize: 12, color: T.text2, marginTop: 4 }}>
                      Заказ #{shortOrderId(order.id)} • Покупатель: @{getUsername(order.buyer)} • ID: {order.id}
                    </div>
                  </div>
                  <CurBadge cur={order.cur} price={order.price} />
                </div>
                <button className="btn-primary" style={{ width: "100%" }} onClick={() => confirmOrder(order)}>
                  Подтвердить выполнение
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {buyerOrders.length > 0 && (
        <>
          <SectionTitle>Мои покупки</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
            {buyerOrders.map((order) => (
              <div key={order.id} className="panel" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{order.offer_snap?.title || "Товар"}</div>
                    <div style={{ fontSize: 12, color: T.text2, marginTop: 4 }}>
                      Продавец: @{getUsername(order.seller)} • Заказ #{shortOrderId(order.id)} • ID: {order.id}
                    </div>
                  </div>
                  <CurBadge cur={order.cur} price={order.price} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ color: order.status === "confirmed" ? T.green : T.text2, fontSize: 13 }}>
                    {order.status === "confirmed" ? "Заказ подтвержден" : "Ожидает подтверждения"}
                  </div>
                  {order.status === "confirmed" && !order.review_left && (
                    <button className="btn-ghost" onClick={() => setReviewing(order)}>
                      Оставить отзыв
                    </button>
                  )}
                  {order.review_left && <span className="gold-badge">Отзыв оставлен</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {completedSellerOrders.length > 0 && (
        <>
          <SectionTitle>Завершенные продажи</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {completedSellerOrders.map((order) => (
              <div key={order.id} className="panel" style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{order.offer_snap?.title || "Товар"}</div>
                  <div style={{ color: T.text3, fontSize: 12, marginTop: 4 }}>
                    @{getUsername(order.buyer)} • {formatDate(order.created_at)}
                  </div>
                </div>
                <CurBadge cur={order.cur} price={order.price} />
              </div>
            ))}
          </div>
        </>
      )}

      {reviewing && (
        <Sheet onClose={() => setReviewing(null)}>
          <SectionTitle>Отзыв о заказе</SectionTitle>
          <div style={{ color: T.text2, fontSize: 13, marginBottom: 14 }}>
            Оцени продавца @{getUsername(reviewing.seller)} и расскажи, как прошла сделка.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => setReviewRating(value)}
                style={{ background: "transparent", border: "none", color: value <= reviewRating ? T.gold : T.text3, fontSize: 28, cursor: "pointer" }}
              >
                ★
              </button>
            ))}
          </div>
          <textarea className="inp" rows={5} value={reviewText} onChange={(e) => setReviewText(e.target.value.slice(0, 200))} placeholder="Напиши короткий отзыв..." />
          <div style={{ color: T.text3, fontSize: 12, marginTop: 8 }}>{reviewText.length}/200</div>
          <button className="btn-primary" style={{ width: "100%", marginTop: 14, position: "sticky", bottom: 0 }} onClick={submitReview} disabled={savingReview}>
            {savingReview ? <Spinner /> : "Сохранить отзыв"}
          </button>
        </Sheet>
      )}
    </div>
  );
}

function ProfileScreen({
  me,
  showToast,
  onOpenOffer,
  onOpenCreate,
  onOpenAdmin,
  onUserUpdated,
}: {
  me: User;
  showToast: (message: string, type?: "ok" | "err") => void;
  onOpenOffer: (offer: Offer) => void;
  onOpenCreate: () => void;
  onOpenAdmin: () => void;
  onUserUpdated: (user: User) => void;
}) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement | null>(null);
  const bannerFileRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState({
    bio: me.bio || "",
    avatar_url: me.avatar_url || "",
    avatar_gif_url: me.avatar_gif_url || "",
    name_color: me.name_color || "",
    name_font: me.name_font || "Sora",
    theme_color: me.theme_color || "",
    theme_color_2: me.theme_color_2 || "",
    profile_banner: me.profile_banner || "",
  });

  const load = useCallback(async () => {
    const [{ data: offersData }, { data: reviewsData }] = await Promise.all([
      supabase.from("offers").select("*, user:users(*)").eq("uid", me.id).order("created_at", { ascending: false }),
      supabase.from("reviews").select("*, buyer:users!buyer_uid(*)").eq("seller_uid", me.id).order("created_at", { ascending: false }),
    ]);
    setOffers((offersData || []) as unknown as Offer[]);
    setReviews((reviewsData || []) as Review[]);
  }, [me.id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveProfile = async () => {
    setSaving(true);
    const payload = {
      bio: draft.bio,
      avatar_url: draft.avatar_url || null,
      avatar_gif_url: canCustomizeProfile(me) ? draft.avatar_gif_url || null : null,
      name_color: canCustomizeProfile(me) ? draft.name_color || null : null,
      name_font: canCustomizeProfile(me) ? draft.name_font || "Sora" : "Sora",
      theme_color: canCustomizeProfile(me) ? draft.theme_color || null : null,
      theme_color_2: canCustomizeProfile(me) ? draft.theme_color_2 || null : null,
      profile_banner: canCustomizeProfile(me) ? draft.profile_banner || null : null,
    };
    const { data, error } = await supabase.from("users").update(payload).eq("id", me.id).select().single();
    setSaving(false);
    if (error || !data) {
      showToast(error?.message || "Не удалось сохранить профиль.", "err");
      return;
    }
    onUserUpdated(data as User);
    setEditing(false);
    showToast("Профиль обновлен.");
  };

  const deleteOffer = async (offerId: string) => {
    await supabase.from("offers").delete().eq("id", offerId);
    setOffers((current) => current.filter((offer) => offer.id !== offerId));
    showToast("Предложение удалено.");
  };

  return (
    <div className="scroll" style={{ height: "100%", padding: 16, paddingBottom: "calc(118px + env(safe-area-inset-bottom, 0px))", background: getProfileScreenBackground(me) }}>
      <div
        className="card"
        style={{
          padding: 14,
          marginBottom: 16,
          background: me.profile_banner ? `linear-gradient(180deg,rgba(10,7,20,.16),rgba(10,7,20,.65)),url(${me.profile_banner}) center/cover` : getProfileGradient(me),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar user={me} size={74} />
          <div style={{ flex: 1 }}>
            <div
              className="title"
              style={{
                fontSize: 24,
                color: me.name_color || T.text,
                fontFamily: me.name_font ? `'${me.name_font}',sans-serif` : "'Sora',sans-serif",
              }}
            >
              {getDisplayName(me)}
            </div>
            <div style={{ color: "rgba(255,255,255,.86)", marginTop: 4 }}>@{getUsername(me)}</div>
            <div style={{ color: "rgba(255,255,255,.66)", fontSize: 12, marginTop: 4 }}>Market ID #{me.marketplace_id || "—"}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {me.plan !== "FREE" && <span className="gold-badge">{me.plan}</span>}
        {me.verified && <span className="blue-badge">Проверен</span>}
        {me.market_banned && <span className="red-badge">Заблокирован</span>}
        <RoleBadge user={me} />
      </div>

      {me.bio && <div className="panel" style={{ padding: 14, color: T.text2, lineHeight: 1.7, marginBottom: 14 }}>{me.bio}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(88px,1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Stars", value: me.stars || 0 },
          { label: "Robux", value: me.robux || 0 },
          { label: "Продажи", value: me.sales || 0 },
          { label: "Рейтинг", value: me.rating || 0 },
          { label: "Отзывы", value: me.review_count || reviews.length },
        ].map((item) => (
          <div key={item.label} className="panel" style={{ padding: 12, textAlign: "center" }}>
            <div className="title" style={{ color: T.gold, fontSize: 18 }}>
              {item.value}
            </div>
            <div style={{ color: T.text3, fontSize: 11, marginTop: 4 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <button className="btn-ghost" onClick={() => setEditing(true)}>
          Редактировать
        </button>
        <button className="btn-primary" onClick={onOpenCreate}>
          Создать оффер
        </button>
        {me.is_admin && <button className="btn-ghost" onClick={onOpenAdmin}>Админка</button>}
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
        {me.plan !== "PREMIUM" ? (
          <div className="panel" style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Premium подписка</div>
              <div style={{ color: T.text2, fontSize: 13 }}>Баннер профиля, тема, GIF-аватар и расширенная кастомизация за {PREMIUM_PRICE_STARS} Stars.</div>
            </div>
            <button
              className="btn-primary"
              onClick={async () => {
                if (me.stars < PREMIUM_PRICE_STARS) {
                  showToast("Недостаточно Stars для покупки Premium.", "err");
                  return;
                }
                const { data } = await supabase
                  .from("users")
                  .update({ stars: me.stars - PREMIUM_PRICE_STARS, plan: "PREMIUM" })
                  .eq("id", me.id)
                  .select()
                  .single();
                if (data) {
                  onUserUpdated(data as User);
                  showToast("Premium активирован.");
                }
              }}
            >
              Купить
            </button>
          </div>
        ) : (
          <div className="panel" style={{ padding: 14, color: T.text2 }}>
            Premium уже активен. Баннер, тема профиля и GIF-аватар доступны в редакторе профиля.
          </div>
        )}

        <div className="panel" style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Пополнение баланса</div>
            <div style={{ color: T.text2, fontSize: 13 }}>Пока это временная заглушка. Позже подключим нормальную механику оплаты.</div>
          </div>
          <button className="btn-ghost" onClick={() => showToast("Пополнение пока в разработке. Заглушка подключена.", "ok")}>
            Скоро
          </button>
        </div>
      </div>

      <SectionTitle right={<span style={{ color: T.text3, fontSize: 12 }}>{offers.length}/{getOfferSlotLimit(me)}</span>}>Мои предложения</SectionTitle>
      {offers.length === 0 && <div style={{ color: T.text3, marginBottom: 18 }}>У тебя пока нет активных предложений.</div>}
      {offers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
          {offers.map((offer) => (
            <div key={offer.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <OfferCard offer={offer} onOpen={onOpenOffer} />
              <button
                onClick={() => deleteOffer(offer.id)}
                className="btn-ghost"
                style={{
                  alignSelf: "flex-end",
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Отзывы о тебе</SectionTitle>
      {reviews.length === 0 && <div style={{ color: T.text3 }}>Отзывов пока нет.</div>}
      {reviews.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {reviews.map((review) => (
              <div key={review.id} className="panel" style={{ padding: 14 }}>
                {(() => {
                  const priceMeta = parseReviewPrice(review.text || "");
                  const cleanText = priceMeta ? priceMeta.text : review.text;
                  return (
                    <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>@{getUsername(review.buyer)}</div>
                  <div style={{ color: T.gold }}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
                </div>
                {priceMeta && <div style={{ color: T.text3, fontSize: 12, marginBottom: 6 }}>Сумма сделки: {formatPrice(priceMeta.price, priceMeta.cur)}</div>}
                <div style={{ color: T.text2, lineHeight: 1.7 }}>{cleanText || "Без текста"}</div>
                <div style={{ color: T.text3, fontSize: 12, marginTop: 8 }}>
                  Review ID: {review.id} • Заказ: {review.order_id}
                </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}

      {editing && (
        <Sheet onClose={() => setEditing(false)}>
          <SectionTitle>Редактировать профиль</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <textarea className="inp" rows={5} value={draft.bio} onChange={(e) => setDraft((current) => ({ ...current, bio: e.target.value.slice(0, 400) }))} placeholder="Расскажи о себе" />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input className="inp" style={{ flex: 1, minWidth: 220 }} value={draft.avatar_url} onChange={(e) => setDraft((current) => ({ ...current, avatar_url: e.target.value }))} placeholder="Ссылка или data-url аватара" />
              <button className="btn-ghost" type="button" onClick={() => avatarFileRef.current?.click()}>
                Загрузить аватар
              </button>
            </div>
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const img = await readImageAsDataUrl(file);
                setDraft((current) => ({ ...current, avatar_url: img }));
                event.target.value = "";
              }}
            />
            {canCustomizeProfile(me) ? (
              <>
                <input className="inp" value={draft.avatar_gif_url} onChange={(e) => setDraft((current) => ({ ...current, avatar_gif_url: e.target.value }))} placeholder="GIF-аватар" />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input className="inp" style={{ flex: 1, minWidth: 220 }} value={draft.profile_banner} onChange={(e) => setDraft((current) => ({ ...current, profile_banner: e.target.value }))} placeholder="Ссылка или data-url баннера" />
                  <button className="btn-ghost" type="button" onClick={() => bannerFileRef.current?.click()}>
                    Загрузить баннер
                  </button>
                </div>
                <input
                  ref={bannerFileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const img = await readImageAsDataUrl(file);
                    setDraft((current) => ({ ...current, profile_banner: img }));
                    event.target.value = "";
                  }}
                />
                <div className="panel" style={{ padding: 12 }}>
                  <div style={{ color: T.text2, fontSize: 12, marginBottom: 8 }}>Цвет ника</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {PROFILE_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setDraft((current) => ({ ...current, name_color: color }))}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          border: `2px solid ${draft.name_color === color ? T.gold : T.line2}`,
                          background: color,
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <select className="inp" value={draft.name_font} onChange={(e) => setDraft((current) => ({ ...current, name_font: e.target.value }))}>
                  {PROFILE_FONTS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
                <div className="panel" style={{ padding: 12 }}>
                  <div style={{ color: T.text2, fontSize: 12, marginBottom: 8 }}>Тема профиля</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {PROFILE_GRADIENTS.map(([from, to]) => {
                      const active = draft.theme_color === from && draft.theme_color_2 === to;
                      return (
                        <button
                          key={`${from}_${to}`}
                          onClick={() => setDraft((current) => ({ ...current, theme_color: from, theme_color_2: to }))}
                          style={{
                            width: 48,
                            height: 28,
                            borderRadius: 999,
                            border: `2px solid ${active ? T.gold : T.line2}`,
                            background: `linear-gradient(135deg,${from},${to})`,
                            cursor: "pointer",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="panel" style={{ padding: 14, color: T.text2 }}>
                Расширенная кастомизация профиля открывается после покупки Premium за {PREMIUM_PRICE_STARS} Stars.
              </div>
            )}
            <button className="btn-primary" style={{ width: "100%", position: "sticky", bottom: 0 }} onClick={saveProfile} disabled={saving}>
              {saving ? <Spinner /> : "Сохранить"}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function AdminSheet({
  me,
  onClose,
  onUserUpdated,
  onOpenChat,
  onOpenSupportChat,
  showToast,
}: {
  me: User;
  onClose: () => void;
  onUserUpdated: (user: User) => void;
  onOpenChat: (user: User) => void;
  onOpenSupportChat: (user: User) => void;
  showToast: (message: string, type?: "ok" | "err") => void;
}) {
  const [stats, setStats] = useState({ users: 0, offers: 0, orders: 0, reviews: 0, banned: 0, pending: 0 });
  const [lookupId, setLookupId] = useState("");
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [foundOrderUsers, setFoundOrderUsers] = useState<{ buyer: User | null; seller: User | null; orderId: string } | null>(null);
  const [latestUsers, setLatestUsers] = useState<User[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);
  const [banReason, setBanReason] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [badgeDraft, setBadgeDraft] = useState({ label: "", icon: "", color: T.gold });
  const [starsAdjust, setStarsAdjust] = useState("0");
  const [robuxAdjust, setRobuxAdjust] = useState("0");
  const [supportUsers, setSupportUsers] = useState<User[]>([]);
  const [supportTickets, setSupportTickets] = useState<Array<{ id: string; user: User; text: string; created_at: string }>>([]);
  const [userDialogs, setUserDialogs] = useState<Array<{ user: User; last: Message }>>([]);
  const [dialogMessages, setDialogMessages] = useState<Message[]>([]);
  const [inspectedDialogUser, setInspectedDialogUser] = useState<User | null>(null);
  const [adminTab, setAdminTab] = useState<"users" | "support">("users");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const [users, offers, orders, reviews, banned, pending, latest, recentOrdersData, recentReviewsData, supportMessagesData] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("offers").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("reviews").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("market_banned", true),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("users").select("*").order("created_at", { ascending: false }).limit(8),
      supabase.from("orders").select("*, buyer:users!buyer_uid(*), seller:users!seller_uid(*)").order("created_at", { ascending: false }).limit(8),
      supabase.from("reviews").select("*, buyer:users!buyer_uid(*)").order("created_at", { ascending: false }).limit(8),
      supabase.from("messages").select("id,text,created_at,from_user:users!from_uid(*)").eq("file_type", "support").like("text", "[Тикет поддержки]%").order("created_at", { ascending: false }).limit(30),
    ]);

    setStats({
      users: users.count || 0,
      offers: offers.count || 0,
      orders: orders.count || 0,
      reviews: reviews.count || 0,
      banned: banned.count || 0,
      pending: pending.count || 0,
    });
    setLatestUsers((latest.data || []) as User[]);
    setRecentOrders((recentOrdersData.data || []) as Order[]);
    setRecentReviews((recentReviewsData.data || []) as Review[]);
    const uniqueSupportUsers = new Map<string, User>();
    const nextTickets: Array<{ id: string; user: User; text: string; created_at: string }> = [];
    ((supportMessagesData.data || []) as unknown as Array<{ id: string; text: string; created_at: string; from_user?: User | User[] | null }>).forEach((row) => {
      const fromUser = Array.isArray(row.from_user) ? row.from_user[0] : row.from_user;
      if (fromUser) {
        uniqueSupportUsers.set(fromUser.id, fromUser);
        nextTickets.push({ id: row.id, user: fromUser, text: row.text, created_at: row.created_at });
      }
    });
    setSupportUsers([...uniqueSupportUsers.values()]);
    setSupportTickets(nextTickets);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectUser = (user: User | null) => {
    setFoundUser(user);
    setFoundOrderUsers(null);
    setBanReason(user?.ban_reason || "");
    setStarsAdjust("0");
    setRobuxAdjust("0");
    setAdminMessage("");
    setBadgeDraft({
      label: user?.badge_label || "",
      icon: user?.badge_icon || "",
      color: user?.badge_color || T.gold,
    });
    setUserDialogs([]);
    setDialogMessages([]);
    setInspectedDialogUser(null);
  };

  const searchUser = async () => {
    if (!lookupId.trim()) return;
    const clean = lookupId.trim();
    if (clean.startsWith("ord_")) {
      const { data: order } = await supabase
        .from("orders")
        .select("id, buyer:users!buyer_uid(*), seller:users!seller_uid(*)")
        .eq("id", clean)
        .maybeSingle();
      if (order) {
        const buyer = (order as { buyer?: User | User[] | null }).buyer;
        const seller = (order as { seller?: User | User[] | null }).seller;
        setFoundOrderUsers({
          orderId: clean,
          buyer: Array.isArray(buyer) ? buyer[0] || null : buyer || null,
          seller: Array.isArray(seller) ? seller[0] || null : seller || null,
        });
        setFoundUser(null);
        return;
      }
    }
    const query = /^\d+$/.test(clean)
      ? supabase.from("users").select("*").eq("marketplace_id", Number(clean))
      : supabase.from("users").select("*").eq("username", clean.replace(/^@/, ""));
    const { data } = await query.maybeSingle();
    selectUser((data || null) as User | null);
    if (!data) showToast("Пользователь не найден.", "err");
  };

  const updateUser = async (payload: Partial<User>) => {
    if (!foundUser) return;
    setWorking(true);
    const { data, error } = await supabase.from("users").update(payload).eq("id", foundUser.id).select().single();
    setWorking(false);

    if (error || !data) {
      showToast(error?.message || "Не удалось обновить пользователя.", "err");
      return;
    }

    const next = data as User;
    selectUser(next);
    if (next.id === me.id) onUserUpdated(next);
    await load();
    showToast("Пользователь обновлен.");
  };

  const adjustBalances = async () => {
    if (!foundUser) return;
    const nextStars = Math.max(0, Number(foundUser.stars || 0) + Number(starsAdjust || 0));
    const nextRobux = Math.max(0, Number(foundUser.robux || 0) + Number(robuxAdjust || 0));
    await updateUser({ stars: nextStars, robux: nextRobux });
  };

  const sendAdminSupportMessage = async () => {
    if (!foundUser || !adminMessage.trim()) return;
    setWorking(true);
    await supabase.from("messages").insert({
      id: `admin_${Date.now()}`,
      from_uid: me.id,
      to_uid: foundUser.id,
      text: `[Админ] ${adminMessage.trim()}`,
      img: null,
      read: false,
      file_type: "system",
    });
    setWorking(false);
    setAdminMessage("");
    showToast("Админ-сообщение отправлено.");
  };

  const injectAdminMessageIntoDialog = async () => {
    if (!foundUser || !inspectedDialogUser || !adminMessage.trim()) {
      showToast("Сначала выбери пользователя, его чат и текст сообщения.", "err");
      return;
    }
    setWorking(true);
    const prefix = me.badge_label || "Админ";
    const payload = {
      id: `admin_dialog_${Date.now()}`,
      from_uid: foundUser.id,
      to_uid: inspectedDialogUser.id,
      text: `[${prefix}] ${getDisplayName(me)}\n${adminMessage.trim()}`,
      img: null,
      read: false,
      file_type: "system",
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("messages").insert({
      id: payload.id,
      from_uid: payload.from_uid,
      to_uid: payload.to_uid,
      text: payload.text,
      img: payload.img,
      read: payload.read,
      file_type: payload.file_type,
    });
    setWorking(false);
    if (error) {
      showToast(error.message || "Не удалось вмешаться в чат.", "err");
      return;
    }
    setDialogMessages((current) => [...current, payload as Message]);
    setAdminMessage("");
    showToast("Сообщение администрации добавлено в выбранный чат.");
  };

  const loadUserDialogs = useCallback(async () => {
    if (!foundUser) return;
    const { data } = await supabase
      .from("messages")
      .select("*, from_user:users!from_uid(*), to_user:users!to_uid(*)")
      .or(`from_uid.eq.${foundUser.id},to_uid.eq.${foundUser.id}`)
      .order("created_at", { ascending: true });

    const map = new Map<string, { user: User; last: Message }>();
    ((data || []) as Array<Message & { from_user?: User | null; to_user?: User | null }>).forEach((message) => {
      const otherUser = message.from_uid === foundUser.id ? message.to_user : message.from_user;
      if (!otherUser || otherUser.id === foundUser.id) return;
      map.set(otherUser.id, { user: otherUser, last: message });
    });
    setUserDialogs([...map.values()].sort((a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime()));
  }, [foundUser]);

  const inspectDialog = useCallback(async (otherUser: User) => {
    if (!foundUser) return;
    setInspectedDialogUser(otherUser);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(from_uid.eq.${foundUser.id},to_uid.eq.${otherUser.id}),and(from_uid.eq.${otherUser.id},to_uid.eq.${foundUser.id})`)
      .order("created_at", { ascending: true });
    setDialogMessages((data || []) as Message[]);
  }, [foundUser]);

  useEffect(() => {
    if (!foundUser) return;
    loadUserDialogs();
  }, [foundUser, loadUserDialogs]);

  const refundOrder = async (order: Order) => {
    setWorking(true);
    const { data: buyer } = await supabase.from("users").select("*").eq("id", order.buyer_uid).single();
    const { data: seller } = await supabase.from("users").select("*").eq("id", order.seller_uid).single();
    if (!buyer || !seller) {
      setWorking(false);
      showToast("Не удалось загрузить участников заказа.", "err");
      return;
    }

    if (order.cur === "STARS") {
      await supabase.from("users").update({ stars: Number(buyer.stars || 0) + order.price }).eq("id", order.buyer_uid);
      await supabase.from("users").update({ stars: Math.max(0, Number(seller.stars || 0) - order.price) }).eq("id", order.seller_uid);
    } else {
      await supabase.from("users").update({ robux: Number(buyer.robux || 0) + order.price }).eq("id", order.buyer_uid);
      await supabase.from("users").update({ robux: Math.max(0, Number(seller.robux || 0) - order.price) }).eq("id", order.seller_uid);
    }

    await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    await supabase.from("messages").insert({
      id: `sys_${Date.now()}`,
      from_uid: order.buyer_uid,
      to_uid: order.seller_uid,
      text: `Система: администратор оформил возврат по заказу #${shortOrderId(order.id)}.`,
      img: null,
      read: false,
      file_type: "system",
    });
    setWorking(false);
    await load();
    showToast("Возврат выполнен.");
  };

  const deleteReview = async (review: Review) => {
    setWorking(true);
    await supabase.from("reviews").delete().eq("id", review.id);
    const { data: ratingsData } = await supabase.from("reviews").select("rating").eq("seller_uid", review.seller_uid);
    const ratings = (ratingsData || []).map((row: { rating: number }) => Number(row.rating || 0)).filter(Boolean);
    const average = ratings.length ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2)) : 0;
    await supabase.from("users").update({ rating: average, review_count: ratings.length }).eq("id", review.seller_uid);
    setWorking(false);
    await load();
    showToast("Отзыв удален.");
  };

  return (
    <div className="scroll" style={{ height: "100%", padding: 16, paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))", background: "#0B0907" }}>
      <SectionTitle>Админка маркетплейса</SectionTitle>
      {loading && <Spinner />}
      {!loading && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <button className={`pill${adminTab === "users" ? " active" : ""}`} onClick={() => setAdminTab("users")}>
              Пользователи и чаты
            </button>
            <button className={`pill${adminTab === "support" ? " active" : ""}`} onClick={() => setAdminTab("support")}>
              Центр поддержки
            </button>
          </div>

          {adminTab === "users" && (
            <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Пользователи", value: stats.users },
              { label: "Офферы", value: stats.offers },
              { label: "Заказы", value: stats.orders },
              { label: "Отзывы", value: stats.reviews },
              { label: "Баны", value: stats.banned },
              { label: "Ожидают", value: stats.pending },
            ].map((item) => (
              <div key={item.label} className="panel" style={{ padding: 12 }}>
                <div className="title" style={{ color: T.gold, fontSize: 20 }}>
                  {item.value}
                </div>
                <div style={{ color: T.text3, fontSize: 11, marginTop: 4 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div className="panel" style={{ padding: 14, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Поиск по Market ID, username или Order ID</div>
            <div style={{ display: "flex", gap: 10 }}>
              <input className="inp" value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="Например: 12, @nickname или ord_..." />
              <button className="btn-primary" onClick={searchUser}>
                Найти
              </button>
            </div>
          </div>

          {foundOrderUsers && (
            <div className="panel" style={{ padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Участники заказа {foundOrderUsers.orderId}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {foundOrderUsers.buyer && (
                  <button className="btn-ghost" onClick={() => selectUser(foundOrderUsers.buyer)}>
                    Покупатель: @{getUsername(foundOrderUsers.buyer)}
                  </button>
                )}
                {foundOrderUsers.seller && (
                  <button className="btn-ghost" onClick={() => selectUser(foundOrderUsers.seller)}>
                    Продавец: @{getUsername(foundOrderUsers.seller)}
                  </button>
                )}
                {foundOrderUsers.buyer && foundOrderUsers.seller && (
                  <button
                    className="btn-primary"
                    onClick={async () => {
                      const buyer = foundOrderUsers.buyer;
                      const seller = foundOrderUsers.seller;
                      if (!buyer || !seller) return;
                      selectUser(buyer);
                      setFoundUser(buyer);
                      setInspectedDialogUser(seller);
                      const { data } = await supabase
                        .from("messages")
                        .select("*")
                        .or(`and(from_uid.eq.${buyer.id},to_uid.eq.${seller.id}),and(from_uid.eq.${seller.id},to_uid.eq.${buyer.id})`)
                        .order("created_at", { ascending: true });
                      setDialogMessages((data || []) as Message[]);
                    }}
                  >
                    Открыть их чат
                  </button>
                )}
              </div>
            </div>
          )}

          <SectionTitle>Новые пользователи</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {latestUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => selectUser(user)}
                className="panel"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: T.bg2, color: T.text, cursor: "pointer", textAlign: "left" }}
              >
                <Avatar user={user} size={42} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>@{getUsername(user)}</div>
                  <div style={{ color: T.text3, fontSize: 12 }}>Market ID #{user.marketplace_id || "—"}</div>
                </div>
                {user.market_banned && <span className="red-badge">Бан</span>}
              </button>
            ))}
          </div>

          {foundUser && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="panel" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <Avatar user={foundUser} size={56} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>@{getUsername(foundUser)}</div>
                    <div style={{ color: T.text3, fontSize: 12 }}>Market ID #{foundUser.marketplace_id || "—"} • DB ID {foundUser.id}</div>
                  </div>
                </div>
                <div style={{ color: T.text2, fontSize: 13, lineHeight: 1.6 }}>
                  Продажи: {foundUser.sales || 0} • Stars: {foundUser.stars || 0} • Robux: {foundUser.robux || 0} • Рейтинг: {foundUser.rating || 0}
                </div>
              </div>

              <div className="panel" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Модерация</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <button className="btn-ghost" disabled={working} onClick={() => updateUser({ verified: !foundUser.verified })}>
                    {foundUser.verified ? "Снять verified" : "Выдать verified"}
                  </button>
                  <button className="btn-ghost" disabled={working} onClick={() => updateUser({ is_admin: !foundUser.is_admin })}>
                    {foundUser.is_admin ? "Снять admin" : "Сделать admin"}
                  </button>
                  <button className="btn-ghost" disabled={working} onClick={() => updateUser({ plan: foundUser.plan === "PREMIUM" ? "FREE" : "PREMIUM" })}>
                    {foundUser.plan === "PREMIUM" ? "Снять Premium" : "Выдать Premium"}
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={working}
                    onClick={() => updateUser({ market_banned: !foundUser.market_banned, ban_reason: !foundUser.market_banned ? banReason || null : null })}
                  >
                    {foundUser.market_banned ? "Разбанить" : "Забанить"}
                  </button>
                </div>
                <textarea className="inp" rows={3} value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Причина бана" />
              </div>

              <div className="panel" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Префикс и роль</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {ROLE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      className="btn-ghost"
                      disabled={working}
                      onClick={() =>
                        updateUser({
                          badge_label: preset.badge_label,
                          badge_icon: preset.badge_icon,
                          badge_color: preset.badge_color,
                        })
                      }
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr .8fr", gap: 10 }}>
                  <input className="inp" value={badgeDraft.label} onChange={(e) => setBadgeDraft((current) => ({ ...current, label: e.target.value.slice(0, 24) }))} placeholder="Своя роль" />
                  <input className="inp" value={badgeDraft.icon} onChange={(e) => setBadgeDraft((current) => ({ ...current, icon: e.target.value.slice(0, 4) }))} placeholder="Иконка" />
                  <input className="inp" value={badgeDraft.color} onChange={(e) => setBadgeDraft((current) => ({ ...current, color: e.target.value.slice(0, 20) }))} placeholder="#D4A843" />
                </div>
                <button
                  className="btn-primary"
                  style={{ width: "100%", marginTop: 10 }}
                  disabled={working}
                  onClick={() => updateUser({ badge_label: badgeDraft.label || null, badge_icon: badgeDraft.icon || null, badge_color: badgeDraft.color || null })}
                >
                  Сохранить префикс
                </button>
              </div>

              <div className="panel" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Баланс</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <input className="inp" value={starsAdjust} onChange={(e) => setStarsAdjust(e.target.value)} placeholder="Изменить Stars, например +100" />
                  <input className="inp" value={robuxAdjust} onChange={(e) => setRobuxAdjust(e.target.value)} placeholder="Изменить Robux, например -50" />
                </div>
                <button
                  className="btn-primary"
                  style={{ width: "100%" }}
                  disabled={working}
                  onClick={adjustBalances}
                >
                  Применить баланс
                </button>
              </div>

              <div className="panel" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Вмешательство в чат</div>
                <textarea className="inp" rows={3} value={adminMessage} onChange={(e) => setAdminMessage(e.target.value)} placeholder="Сообщение от имени администрации" />
                <button
                  className="btn-primary"
                  style={{ width: "100%", marginTop: 10 }}
                  disabled={working}
                  onClick={sendAdminSupportMessage}
                >
                  Отправить [Админ]
                </button>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button className="btn-ghost" disabled={!foundUser} onClick={() => foundUser && onOpenChat(foundUser)}>
                    Открыть чат с пользователем
                  </button>
                  <button className="btn-ghost" disabled={!foundUser} onClick={loadUserDialogs}>
                    Обновить диалоги
                  </button>
                </div>
              </div>

              <div className="panel" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Диалоги пользователя</div>
                {userDialogs.length === 0 && <div style={{ color: T.text3 }}>У пользователя пока нет доступных диалогов.</div>}
                {userDialogs.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {userDialogs.map((dialog) => (
                      <button
                        key={dialog.user.id}
                        className="btn-ghost"
                        style={{ justifyContent: "space-between" }}
                        onClick={() => inspectDialog(dialog.user)}
                      >
                        <span>@{getUsername(dialog.user)}</span>
                        <span style={{ color: T.text3, fontSize: 12 }}>{formatTime(dialog.last.created_at)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {inspectedDialogUser && (
                  <div className="panel" style={{ padding: 12, marginTop: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      Просмотр: @{getUsername(foundUser)} ↔ @{getUsername(inspectedDialogUser)}
                    </div>
                    <div
                      className="scroll"
                      style={{
                        maxHeight: 320,
                        minHeight: 140,
                        padding: 4,
                        borderRadius: 18,
                        background: "rgba(10,8,22,.46)",
                        border: `1px solid ${T.line}`,
                        overflowY: "auto",
                        overscrollBehavior: "contain",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: "100%" }}>
                        {dialogMessages.length === 0 && <div style={{ color: T.text3, padding: 8 }}>Сообщений пока нет.</div>}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
                          {dialogMessages.map((message) => {
                            const fromOwner = message.from_uid === foundUser.id;
                            return (
                              <div key={message.id} style={{ display: "flex", justifyContent: fromOwner ? "flex-end" : "flex-start" }}>
                                <div
                                  style={{
                                    maxWidth: "88%",
                                    padding: "10px 12px",
                                    borderRadius: fromOwner ? "18px 18px 8px 18px" : "18px 18px 18px 8px",
                                    background: fromOwner
                                      ? "linear-gradient(135deg,rgba(139,95,255,.30),rgba(89,207,255,.18))"
                                      : "linear-gradient(180deg,rgba(27,20,51,.82),rgba(12,9,25,.92))",
                                    border: `1px solid ${fromOwner ? "rgba(154,99,255,.24)" : T.line}`,
                                    boxShadow: "0 12px 24px rgba(4,2,12,.18)",
                                  }}
                                >
                                  <div style={{ color: T.text3, fontSize: 11, marginBottom: 6 }}>
                                    {fromOwner ? `@${getUsername(foundUser)}` : `@${getUsername(inspectedDialogUser)}`} • {formatTime(message.created_at)}
                                  </div>
                                  {message.img ? (
                                    <img src={message.img} alt={message.file_name || "attachment"} style={{ width: "100%", maxWidth: 220, borderRadius: 10, display: "block", marginBottom: message.text ? 8 : 0 }} />
                                  ) : null}
                                  <div style={{ color: T.text2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                    {message.text || (message.img ? "" : "Пустое сообщение")}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <button className="btn-primary" style={{ width: "100%", marginTop: 10 }} disabled={working} onClick={injectAdminMessageIntoDialog}>
                      Отправить в этот чат как администрация
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
            </>
          )}

          {adminTab === "support" && (
            <>
              <SectionTitle>Центр поддержки</SectionTitle>
              {supportTickets.length === 0 && <div style={{ color: T.text3, marginBottom: 16 }}>Пока нет заявок в поддержку.</div>}
              {supportTickets.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  {supportTickets.map((ticket) => (
                    <div key={ticket.id} className="panel" style={{ padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                        <div style={{ fontWeight: 700 }}>@{getUsername(ticket.user)}</div>
                        <div style={{ color: T.text3, fontSize: 12 }}>{formatDate(ticket.created_at)} {formatTime(ticket.created_at)}</div>
                      </div>
                      <div style={{ color: T.text2, whiteSpace: "pre-wrap", lineHeight: 1.6, marginBottom: 10 }}>{ticket.text}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn-primary"
                          onClick={() => {
                            selectUser(ticket.user);
                            setAdminTab("users");
                          }}
                        >
                          Открыть пользователя
                        </button>
                        <button className="btn-ghost" onClick={() => onOpenSupportChat(ticket.user)}>
                          Перейти в чат саппорта
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <SectionTitle>Последние заказы</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {recentOrders.map((order) => (
              <div key={order.id} className="panel" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>Order #{order.id}</div>
                  <span className={order.status === "cancelled" ? "red-badge" : "gold-badge"}>{order.status}</span>
                </div>
                <div style={{ color: T.text2, fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                  @{getUsername(order.buyer)} → @{getUsername(order.seller)} • {formatPrice(order.price, order.cur)} • Offer {order.offer_id}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn-ghost" disabled={working || order.status === "cancelled"} onClick={() => refundOrder(order)}>
                    Возврат
                  </button>
                  <button className="btn-ghost" disabled={working} onClick={() => selectUser(order.seller || null)}>
                    Открыть продавца
                  </button>
                </div>
              </div>
            ))}
          </div>

          <SectionTitle>Последние отзывы</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recentReviews.map((review) => (
              <div key={review.id} className="panel" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>Review #{review.id}</div>
                  <div style={{ color: T.gold }}>{review.rating}/5</div>
                </div>
                <div style={{ color: T.text2, lineHeight: 1.6, marginBottom: 8 }}>{review.text || "Без текста"}</div>
                <div style={{ color: T.text3, fontSize: 12, marginBottom: 10 }}>
                  Заказ: {review.order_id} • Buyer: @{getUsername(review.buyer)} • Seller ID: {review.seller_uid}
                </div>
                <button className="btn-ghost" disabled={working} onClick={() => deleteReview(review)}>
                  Удалить отзыв
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BannedScreen({ me }: { me: User }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 400, padding: 26, textAlign: "center" }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>⛔</div>
        <div className="title" style={{ fontSize: 24, marginBottom: 8 }}>
          Доступ к маркету ограничен
        </div>
        <div style={{ color: T.text2, marginBottom: 10 }}>Market ID #{me.marketplace_id || "—"}</div>
        <div style={{ color: T.text2, lineHeight: 1.7 }}>{me.ban_reason || "Администратор ограничил доступ к аккаунту."}</div>
      </div>
    </div>
  );
}

function WalletSheet({
  me,
  onClose,
  showToast,
}: {
  me: User;
  onClose: () => void;
  showToast: (message: string, type?: "ok" | "err") => void;
}) {
  const action = (name: string) => showToast(`${name}: платежный провайдер будет подключен позже.`, "err");
  return (
    <Sheet onClose={onClose} maxWidth={540}>
      <SectionTitle>Баланс</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div className="panel" style={{ padding: 14, background: "linear-gradient(135deg,rgba(154,99,255,.24),rgba(105,200,255,.12))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ color: T.text2, fontSize: 12, fontWeight: 800 }}>Основной</span>
            <span className="blue-badge">$ баланс</span>
          </div>
          <div className="title" style={{ fontSize: 26, marginTop: 12 }}>{formatWorth(me.stars)}</div>
          <div style={{ color: T.text3, fontSize: 12, marginTop: 2 }}>внутренняя валюта</div>
        </div>
        <div className="panel" style={{ padding: 14, background: "linear-gradient(135deg,rgba(103,242,209,.18),rgba(105,200,255,.1))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ color: T.text2, fontSize: 12, fontWeight: 800 }}>Robux</span>
            <span className="gold-badge">R$</span>
          </div>
          <div className="title" style={{ fontSize: 26, marginTop: 12 }}>{formatWorth(me.robux)}</div>
          <div style={{ color: T.text3, fontSize: 12, marginTop: 2 }}>для Roblox-сделок</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <button className="btn-primary" onClick={() => action("Пополнение долларового баланса")}>Пополнить</button>
        <button className="btn-ghost" onClick={() => action("Вывод средств")}>Вывести</button>
      </div>

      <div className="panel" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Подготовлено для платежей</div>
        <div style={{ display: "grid", gap: 8, color: T.text2, fontSize: 13, lineHeight: 1.45 }}>
          <div>• покупка товаров за долларовый баланс;</div>
          <div>• покупка товаров за Robux баланс;</div>
          <div>• пополнение основного баланса через платежный провайдер;</div>
          <div>• пополнение/вывод Robux после подключения провайдера.</div>
        </div>
      </div>

      <div className="panel" style={{ padding: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 12 }}>История транзакций</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: T.text2, fontSize: 13 }}>
          <span>Бонус</span>
          <span style={{ color: T.gold2, fontWeight: 900 }}>+1 ✦</span>
        </div>
      </div>
    </Sheet>
  );
}

function MarketMenuSheet({
  onClose,
  showToast,
}: {
  onClose: () => void;
  showToast: (message: string, type?: "ok" | "err") => void;
}) {
  const openTelegram = (handle: string) => {
    window.open(`https://t.me/${handle.replace(/^@/, "")}`, "_blank", "noopener,noreferrer");
  };
  const showRules = () => showToast("Правила: безопасные сделки, без скама, спорные заказы через поддержку.");
  return (
    <Sheet onClose={onClose} maxWidth={540}>
      <SectionTitle>Настройки</SectionTitle>
      <div style={{ color: T.text3, fontSize: 11, fontWeight: 900, textTransform: "uppercase", marginBottom: 9 }}>Язык</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button className="pill active tap-scale">RU</button>
        <button className="pill tap-scale">EN</button>
      </div>

      <div style={{ color: T.text3, fontSize: 11, fontWeight: 900, textTransform: "uppercase", marginBottom: 9 }}>Каналы и сообщество</div>
      <div className="panel" style={{ overflow: "hidden", marginBottom: 16 }}>
        {[
          ["@Roblox24h", "24"],
          ["@Roblox_Developers", "RD"],
          ["@RoWorthNews", "RN"],
          ["@RobloxDevelopersRU", "RU"],
        ].map(([handle, icon], index) => (
          <button
            key={handle}
            className="tap-scale"
            onClick={() => openTelegram(handle)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "14px 15px",
              border: "none",
              borderTop: index ? `1px solid ${T.line}` : "none",
              background: "transparent",
              color: T.text,
              cursor: "pointer",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 800 }}>
              <span style={{ width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(35,151,255,.16)", color: T.blue, fontSize: 11 }}>{icon}</span>
              {handle}
            </span>
            <span style={{ color: T.text3 }}>›</span>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button className="btn-ghost tap-scale" onClick={showRules}>Правила</button>
        <button className="btn-primary tap-scale" onClick={() => openTelegram("@RoWorth")}>Поддержка</button>
      </div>
    </Sheet>
  );
}

function TabBar({
  tab,
  setTab,
  unread,
  pendingOrders,
  onCreate,
  isAdmin,
}: {
  tab: string;
  setTab: (tab: string) => void;
  unread: number;
  pendingOrders: number;
  onCreate: () => void;
  isAdmin?: boolean;
}) {
  const compact = Boolean(isAdmin);
  const NavIcon = ({ name, active }: { name: "home" | "chat" | "plus" | "orders" | "profile" | "admin"; active: boolean }) => {
    const color = active ? T.blue : "#777";
    const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    if (name === "home") return <svg {...common}><path d="M3 10.8 12 4l9 6.8" /><path d="M5.5 10.5V20h13V10.5" /></svg>;
    if (name === "chat") return <svg {...common}><path d="M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" /></svg>;
    if (name === "plus") return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
    if (name === "orders") return <svg {...common}><path d="M7 6h13l-1.3 7.2a2 2 0 0 1-2 1.6H9.2a2 2 0 0 1-2-1.6L5 3H3" /><circle cx="10" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></svg>;
    if (name === "admin") return <svg {...common}><path d="M12 3 4.5 6v5.2c0 4.8 3.2 9 7.5 10.8 4.3-1.8 7.5-6 7.5-10.8V6L12 3Z" /><path d="M9.5 12 11 13.5 14.5 10" /></svg>;
    return <svg {...common}><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>;
  };

  const items: Array<{ id: string; label: string; icon: "home" | "chat" | "plus" | "orders" | "profile" | "admin"; badge?: number; action?: () => void }> = [
    { id: "home", label: "Маркет", icon: "home" as const },
    { id: "chats", label: "Чаты", icon: "chat" as const, badge: unread },
    { id: "create", label: "Создать", icon: "plus" as const, action: onCreate },
    { id: "orders", label: "Заказы", icon: "orders" as const, badge: pendingOrders },
    { id: "profile", label: "Профиль", icon: "profile" as const },
  ];
  if (isAdmin) items.push({ id: "admin", label: "Админ", icon: "admin" as const });

  return (
    <div
      style={{
        position: "absolute",
        left: compact ? 12 : 16,
        right: compact ? 12 : 16,
        bottom: 10,
        display: "flex",
        alignItems: "center",
        padding: compact ? 6 : 8,
        borderRadius: 999,
        background: "linear-gradient(180deg,rgba(22,22,22,.72),rgba(12,12,12,.9))",
        border: "1px solid rgba(255,255,255,.08)",
        boxShadow: "0 24px 50px rgba(0,0,0,.62), inset 0 1px 0 rgba(255,255,255,.06)",
        backdropFilter: "blur(24px)",
        zIndex: 40,
        maxWidth: 420,
        margin: "0 auto",
        paddingBottom: compact ? "calc(6px + env(safe-area-inset-bottom, 0px))" : "calc(8px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {items.map((item) => {
        const active = tab === item.id;
        const handleClick = item.action || (() => setTab(item.id));
        return (
          <button
            key={item.id}
            onClick={handleClick}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: compact ? 2 : 5,
              cursor: "pointer",
              position: "relative",
              minWidth: 0,
              padding: compact ? "1px 0" : undefined,
            }}
          >
            <span
              style={{
                width: compact ? 36 : 58,
                height: compact ? 36 : 58,
                borderRadius: 999,
                background: active ? "radial-gradient(circle at 50% 50%,rgba(35,151,255,.26),rgba(0,0,0,.35) 62%,rgba(0,0,0,.2))" : "transparent",
                border: active ? "1px solid rgba(255,255,255,.12)" : "1px solid transparent",
                display: "grid",
                placeItems: "center",
                boxShadow: active ? "0 0 28px rgba(35,151,255,.32)" : "none",
              }}
            >
              <NavIcon name={item.icon} active={active} />
            </span>
            {!compact && <span style={{ fontSize: 13, fontWeight: 900, color: active ? T.blue : "#777", lineHeight: 1, whiteSpace: "nowrap" }}>{item.label}</span>}
            {item.badge ? (
              <span
                style={{
                  position: "absolute",
                  top: compact ? 2 : 8,
                  right: compact ? "12%" : "22%",
                  minWidth: compact ? 16 : 18,
                  height: compact ? 16 : 18,
                  borderRadius: 999,
                  background: item.id === "orders" ? T.blue : T.red,
                  color: "#fff",
                  fontSize: compact ? 9 : 10,
                  fontWeight: 800,
                  display: "grid",
                  placeItems: "center",
                  padding: compact ? "0 4px" : "0 5px",
                }}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState<"loading" | "widget" | "setup" | "ready">("loading");
  const [me, setMe] = useState<User | null>(null);
  const [tgUser, setTgUser] = useState<TelegramUser | null>(null);
  const [tab, setTab] = useState("home");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [chatUser, setChatUser] = useState<User | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>("regular");
  const [messages, setMessages] = useState<Message[]>([]);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [autoContent, setAutoContent] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "ok" | "err" } | null>(null);
  const [unread, setUnread] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const lastMessageAtRef = useRef(0);

  const showToast = useCallback((message: string, type: "ok" | "err" = "ok") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const notifyTelegram = useCallback(async (chatId: string, text: string, buttonText?: string, buttonUrl?: string) => {
    try {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, text, buttonText, buttonUrl }),
      });
    } catch {
      // noop
    }
  }, []);

  const refreshUnread = useCallback(async (userId: string) => {
    const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("to_uid", userId).eq("read", false);
    setUnread(count || 0);
  }, []);

  const authUser = useCallback(async (telegramUser: TelegramUser) => {
    const userId = String(telegramUser.id);
    const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();

    if (error) {
      setStatus("widget");
      return;
    }

    if (!data || !(data as User).username) {
      setStatus("setup");
      return;
    }

    const updates = {
      tg_username: telegramUser.username || null,
      tg_name: `${telegramUser.first_name}${telegramUser.last_name ? ` ${telegramUser.last_name}` : ""}`,
      tg_photo: telegramUser.photo_url || null,
    };

    await supabase.from("users").update(updates).eq("id", userId);
    setMe({ ...(data as User), ...updates });
    setStatus("ready");
  }, []);

  useEffect(() => {
    const telegramWebApp = getTelegramWebApp();
    const windowTelegramUser = (window as Window & { Telegram?: { WebApp?: { initDataUnsafe?: { user?: TelegramUser } } } }).Telegram?.WebApp?.initDataUnsafe?.user;
    if (telegramWebApp && windowTelegramUser) {
      telegramWebApp.ready();
      telegramWebApp.expand();
      setTgUser(windowTelegramUser);
      authUser(windowTelegramUser);
      return;
    }
    setStatus("widget");
  }, [authUser]);

  useEffect(() => {
    (window as Window & { onTelegramAuth?: (user: TelegramUser) => void }).onTelegramAuth = (user: TelegramUser) => {
      setTgUser(user);
      authUser(user);
    };
  }, [authUser]);

  useEffect(() => {
    if (!me) return;

    const loadUnread = async () => {
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("to_uid", me.id).eq("read", false).neq("file_type", "support");
      setUnread(count || 0);
    };

    const loadPendingOrders = async () => {
      const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("seller_uid", me.id).eq("status", "pending");
      setPendingOrders(count || 0);
    };

    loadUnread();
    loadPendingOrders();

    const unreadChannel = supabase
      .channel(`unread_${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => loadUnread())
      .subscribe();

    const orderChannel = supabase
      .channel(`pending_orders_${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadPendingOrders())
      .subscribe();

    return () => {
      supabase.removeChannel(unreadChannel);
      supabase.removeChannel(orderChannel);
    };
  }, [me, refreshUnread]);

  const openChat = useCallback(async (user: User) => {
    if (!me) return;
    setChatUser(user);
    setChatMode("regular");
    setTab("chats");
    lastMessageAtRef.current = 0;

    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(from_uid.eq.${me.id},to_uid.eq.${user.id}),and(from_uid.eq.${user.id},to_uid.eq.${me.id})`)
      .neq("file_type", "support")
      .order("created_at", { ascending: true });

    setMessages((data || []) as Message[]);
    await supabase.from("messages").update({ read: true }).eq("to_uid", me.id).eq("from_uid", user.id).neq("file_type", "support");
    await refreshUnread(me.id);
  }, [me, refreshUnread]);

  const openSupportChat = useCallback(async (user: User) => {
    if (!me) return;
    setChatUser(user);
    setChatMode("support");
    setTab("chats");
    lastMessageAtRef.current = 0;

    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(from_uid.eq.${me.id},to_uid.eq.${user.id}),and(from_uid.eq.${user.id},to_uid.eq.${me.id})`)
      .eq("file_type", "support")
      .order("created_at", { ascending: true });

    setMessages((data || []) as Message[]);
    await supabase.from("messages").update({ read: true }).eq("to_uid", me.id).eq("from_uid", user.id).eq("file_type", "support");
  }, [me]);

  useEffect(() => {
    if (!me || !chatUser) return;

    const channel = supabase
      .channel(`chat_${me.id}_${chatUser.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const message = payload.new as Message;
        const matches =
          (message.from_uid === me.id && message.to_uid === chatUser.id) ||
          (message.from_uid === chatUser.id && message.to_uid === me.id);

        if (!matches) return;
        if ((chatMode === "support") !== isSupportMessage(message)) return;

        setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
        if (message.to_uid === me.id) {
          await supabase.from("messages").update({ read: true }).eq("id", message.id);
          if (chatMode === "regular") await refreshUnread(me.id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatMode, chatUser, me, refreshUnread]);

  const sendMessage = useCallback(async (payload: { text?: string; img?: string | null; fileName?: string | null; fileType?: string | null }) => {
    if (!me || !chatUser) return false;
    if (!payload.text && !payload.img) return false;

    const now = Date.now();
    const remaining = MESSAGE_COOLDOWN_MS - (now - lastMessageAtRef.current);
    if (remaining > 0) {
      showToast(`Подожди ${Math.ceil(remaining / 1000)} сек. перед следующим сообщением.`, "err");
      return false;
    }

    const optimisticMessage: Message = {
      id: `msg_${now}`,
      from_uid: me.id,
      to_uid: chatUser.id,
      text: payload.text || "",
      img: payload.img || null,
      read: false,
      created_at: new Date(now).toISOString(),
      file_name: payload.fileName || null,
      file_type: payload.fileType || (chatMode === "support" ? "support" : null),
    };

    setMessages((current) => [...current, optimisticMessage]);

    const { error } = await supabase.from("messages").insert(optimisticMessage);

    if (error) {
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      showToast(error.message || "Не удалось отправить сообщение.", "err");
      return false;
    }
    lastMessageAtRef.current = now;

    const chatUrl = `${getAppBaseUrl()}?chat=${me.id}`;
    await notifyTelegram(
      chatUser.id,
      `${chatMode === "support" ? "Новое сообщение в чате поддержки" : `Вам пришло новое сообщение в чате от @${getUsername(me)}.`}\n\n${payload.img ? "Изображение" : (payload.text || "").slice(0, 120)}`,
      "Перейти в чат",
      chatUrl
    );
    return true;
  }, [chatMode, chatUser, me, notifyTelegram, showToast]);

  const submitSupportRequest = useCallback(
    async (payload: { reason: SupportReason; nickname: string; orderId: string; role: SupportRole; text: string }) => {
      if (!me) return;

      const { data: admins, error } = await supabase.from("users").select("*").eq("is_admin", true).limit(10);
      if (error || !admins || admins.length === 0) {
        showToast("Не удалось найти модераторов. Попробуй позже.", "err");
        return;
      }
      const supportAdmin = admins[0] as User;

      const reasonLabel = SUPPORT_REASONS.find((item) => item.value === payload.reason)?.label || payload.reason;
      const ticketText =
        `[Тикет поддержки]\n` +
        `Причина: ${reasonLabel}\n` +
        `Пользователь: ${payload.nickname}\n` +
        `Роль: ${payload.role === "BUYER" ? "Покупатель" : "Продавец"}\n` +
        `Order ID: ${payload.orderId || "не указан"}\n` +
        `Market ID: ${me.marketplace_id || "—"}\n\n` +
        `${payload.text}`;

      const rows = [{
        id: `support_${supportAdmin.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        from_uid: me.id,
        to_uid: supportAdmin.id,
        text: ticketText,
        img: null,
        read: false,
        file_type: "support",
      }];

      const { error: insertError } = await supabase.from("messages").insert(rows);
      if (insertError) {
        showToast(insertError.message || "Не удалось отправить заявку.", "err");
        return;
      }

      await Promise.all(
        admins.map((admin) =>
          notifyTelegram(
            admin.id,
            `Новая заявка в поддержку от @${getUsername(me)}\nПричина: ${reasonLabel}\nOrder ID: ${payload.orderId || "не указан"}`,
            "Открыть маркет",
            getAppBaseUrl()
          )
        )
      );

      setShowSupport(false);
      openSupportChat(supportAdmin);
      showToast("Заявка отправлена модераторам.");
    },
    [me, notifyTelegram, openSupportChat, showToast]
  );

  useEffect(() => {
    if (!me) return;
    const chatId = new URLSearchParams(window.location.search).get("chat");
    if (!chatId || chatId === me.id) return;
    supabase.from("users").select("*").eq("id", chatId).maybeSingle().then(({ data }) => {
      if (data) openChat(data as User);
    });
  }, [me, openChat]);

  const handleBuy = useCallback(async (offer: Offer) => {
    if (!me) return;
    if (offer.uid === me.id) {
      showToast("Нельзя купить свой собственный товар.", "err");
      return;
    }
    if (Number(offer.stock ?? 1) < 1) {
      showToast("Товар закончился.", "err");
      return;
    }

    const enoughBalance = offer.cur === "STARS" ? me.stars >= offer.price : me.robux >= offer.price;
    if (!enoughBalance) {
      showToast("Недостаточно средств.", "err");
      return;
    }

    const nextStars = offer.cur === "STARS" ? me.stars - offer.price : me.stars;
    const nextRobux = offer.cur === "ROBUX" ? me.robux - offer.price : me.robux;

    const { data: updatedBuyer } = await supabase.from("users").update({ stars: nextStars, robux: nextRobux }).eq("id", me.id).select().single();
    if (updatedBuyer) setMe(updatedBuyer as User);

    const currencyField = offer.cur === "STARS" ? "stars" : "robux";
    const { data: seller } = await supabase.from("users").select("stars,robux,worth,sales").eq("id", offer.uid).single();
    if (seller) {
      await supabase
        .from("users")
        .update({
          [currencyField]: Number(seller[currencyField as "stars" | "robux"] || 0) + offer.price,
          worth: Number(seller.worth || 0) + offer.price,
          sales: Number(seller.sales || 0) + 1,
        })
        .eq("id", offer.uid);
    }

    const orderId = `ord_${Date.now()}`;
    const nextStatus: OrderStatus = offer.auto ? "confirmed" : "pending";

    await supabase.from("orders").insert({
      id: orderId,
      offer_id: offer.id,
      buyer_uid: me.id,
      seller_uid: offer.uid,
      offer_snap: offer,
      price: offer.price,
      cur: offer.cur,
      status: nextStatus,
      review_left: false,
    });

    await supabase.from("purchases").insert({
      id: `purchase_${Date.now()}`,
      uid: me.id,
      offer_snap: offer,
      price: offer.price,
      cur: offer.cur,
    });

    await supabase.from("offers").update({ sales: Number(offer.sales || 0) + 1, stock: Math.max(0, Number(offer.stock ?? 1) - 1) }).eq("id", offer.id);

    await supabase.from("messages").insert({
      id: `sys_${Date.now()}`,
      from_uid: me.id,
      to_uid: offer.uid,
      text: `Система: покупатель оплатил заказ #${shortOrderId(orderId)}.\n1 шт. на сумму ${formatPrice(offer.price, offer.cur)}.\nПокупатель: @${getUsername(me)}`,
      img: null,
      read: false,
      file_type: "system",
    });
    await notifyTelegram(
      offer.uid,
      `Покупатель оплатил заказ #${shortOrderId(orderId)}\n1 шт. на сумму ${formatPrice(offer.price, offer.cur)}\nПокупатель: @${getUsername(me)}`,
      "Открыть чат",
      `${getAppBaseUrl()}?chat=${me.id}`
    );

    if (offer.auto) {
      await supabase.from("messages").insert({
        id: `sys_auto_${Date.now()}`,
        from_uid: offer.uid,
        to_uid: me.id,
        text: `Автовыдача по заказу #${shortOrderId(orderId)}\n\n${offer.auto_content || "Контент для автовыдачи не указан."}`,
        img: null,
        read: false,
        file_type: "system",
      });
      showToast("Покупка завершена, товар выдан автоматически.");
    } else {
      showToast("Покупка создана, продавец уже получил уведомление и оплату.");
    }
  }, [me, notifyTelegram, showToast]);

  if (status === "loading") {
    return (
      <>
        <style>{CSS}</style>
        <LoadingScreen />
      </>
    );
  }

  if (status === "widget") {
    return (
      <>
        <style>{CSS}</style>
        <TelegramLoginScreen />
      </>
    );
  }

  if (status === "setup" && tgUser) {
    return (
      <>
        <style>{CSS}</style>
        <SetupUsername
          tgUser={tgUser}
          onDone={(user) => {
            setMe(user);
            setStatus("ready");
          }}
        />
      </>
    );
  }

  if (!me) {
    return (
      <>
        <style>{CSS}</style>
        <LoadingScreen />
      </>
    );
  }

  if (me.market_banned) {
    return (
      <>
        <style>{CSS}</style>
        <BannedScreen me={me} />
      </>
    );
  }

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 14% -4%, rgba(155,96,255,.24), transparent 28%), radial-gradient(circle at 90% 14%, rgba(89,207,255,.16), transparent 24%), linear-gradient(180deg, rgba(11,8,23,.98), rgba(5,3,13,1))",
        borderLeft: `1px solid ${T.line}`,
        borderRight: `1px solid ${T.line}`,
      }}
    >
      <div style={{ position: "absolute", inset: -120, pointerEvents: "none", background: "radial-gradient(circle at 24% 18%, rgba(154,99,255,.16), transparent 24%), radial-gradient(circle at 78% 26%, rgba(105,200,255,.12), transparent 22%)" }} />
      <style>{`${CSS}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", zIndex: 1 }}>
        {chatUser ? (
          <ChatView
            me={me}
            partner={chatUser}
            messages={messages}
            mode={chatMode}
            onBack={() => setChatUser(null)}
            onSend={sendMessage}
            onOpenProfile={(user) => setProfileUser(user)}
          />
        ) : null}

        {!chatUser && tab === "home" && (
          <HomeScreen
            me={me}
            onOpenOffer={setSelectedOffer}
            onOpenMenu={() => setShowMenu(true)}
            onOpenWallet={() => setShowWallet(true)}
          />
        )}
        {!chatUser && tab === "chats" && <ChatsScreen me={me} onOpenChat={openChat} onOpenSupportChat={async () => {
          const { data } = await supabase.from("users").select("*").eq("is_admin", true).order("created_at", { ascending: true }).limit(1);
          const supportAdmin = (data?.[0] || null) as User | null;
          if (supportAdmin) {
            openSupportChat(supportAdmin);
          } else {
            showToast("Саппорт пока недоступен.", "err");
          }
        }} onOpenSupport={() => setShowSupport(true)} />}
        {!chatUser && tab === "orders" && <OrdersScreen me={me} showToast={showToast} notifyTelegram={notifyTelegram} />}
        {!chatUser && tab === "profile" && (
          <ProfileScreen
            me={me}
            showToast={showToast}
            onOpenOffer={setSelectedOffer}
            onOpenCreate={() => setShowCreate(true)}
            onOpenAdmin={() => setTab("admin")}
            onUserUpdated={setMe}
          />
        )}
        {!chatUser && tab === "admin" && me.is_admin && (
          <AdminSheet me={me} onClose={() => setTab("profile")} onUserUpdated={setMe} onOpenChat={openChat} onOpenSupportChat={openSupportChat} showToast={showToast} />
        )}
      </div>

      {!chatUser && <TabBar tab={tab} setTab={setTab} unread={unread} pendingOrders={pendingOrders} onCreate={() => setShowCreate(true)} isAdmin={Boolean(me.is_admin)} />}

      {showWallet && <WalletSheet me={me} onClose={() => setShowWallet(false)} showToast={showToast} />}
      {showMenu && <MarketMenuSheet onClose={() => setShowMenu(false)} showToast={showToast} />}

      {selectedOffer && (
        <OfferSheet
          offer={selectedOffer}
          me={me}
          onClose={() => setSelectedOffer(null)}
          onBuy={handleBuy}
          onOpenChat={(user) => {
            setSelectedOffer(null);
            openChat(user);
          }}
          onOpenProfile={(user) => {
            setSelectedOffer(null);
            setProfileUser(user);
          }}
        />
      )}

      {showCreate && (
        <CreateOfferSheet
          me={me}
          onClose={() => setShowCreate(false)}
          onCreated={(offer) => setSelectedOffer(offer)}
          showToast={showToast}
        />
      )}

      {profileUser && (
        <UserProfileSheet
          user={profileUser}
          me={me}
          onClose={() => setProfileUser(null)}
          onOpenOffer={(offer) => {
            setProfileUser(null);
            setSelectedOffer(offer);
          }}
          onOpenChat={(user) => {
            setProfileUser(null);
            openChat(user);
          }}
        />
      )}

      {showSupport && me && <SupportSheet me={me} onClose={() => setShowSupport(false)} onSubmit={submitSupportRequest} />}

      {autoContent && (
        <Sheet onClose={() => setAutoContent(null)} maxWidth={420}>
          <SectionTitle>Автовыдача</SectionTitle>
          <div className="panel" style={{ padding: 14, marginBottom: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {autoContent}
          </div>
          <button
            className="btn-primary"
            style={{ width: "100%", marginBottom: 10 }}
            onClick={() => {
              navigator.clipboard?.writeText(autoContent);
              showToast("Контент скопирован.");
            }}
          >
            Скопировать
          </button>
          <button className="btn-ghost" style={{ width: "100%" }} onClick={() => setAutoContent(null)}>
            Закрыть
          </button>
        </Sheet>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
