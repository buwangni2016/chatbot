import { generateText, stepCountIs } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { searchWeb } from "@/lib/ai/tools/search-web";
import { getWikipedia } from "@/lib/ai/tools/get-wikipedia";
import { getCurrentTime } from "@/lib/ai/tools/get-current-time";
import { convertCurrency } from "@/lib/ai/tools/convert-currency";
import { fetchUrl } from "@/lib/ai/tools/fetch-url";
import { calculate } from "@/lib/ai/tools/calculate";
import {
  getUser,
  createUser,
  saveChat,
  saveMessages,
  getMessagesByChatId,
  getChatsByUserId,
  deleteChatById,
  updateChatTitleById,
} from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN!;
const MATON_KEY    = process.env.MATON_API_KEY!;
const TELEGRAM_CONN = process.env.TELEGRAM_CONNECTION_ID!;

// In-memory: active chat per Telegram user (resets on redeploy)
const activeChatIds = new Map<number, string>();

// ── Telegram API ──────────────────────────────────────────────────────────
async function tg(method: string, body: object): Promise<any> {
  const url = BOT_TOKEN
    ? `https://api.telegram.org/bot${BOT_TOKEN}/${method}`
    : `https://api.maton.ai/telegram/:token/${method}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!BOT_TOKEN) {
    headers["Authorization"] = `Bearer ${MATON_KEY}`;
    headers["Maton-Connection"] = TELEGRAM_CONN;
  }
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  return res.json();
}

async function send(chatId: number, text: string): Promise<void> {
  const res = await tg("sendMessage", { chat_id: chatId, text, parse_mode: "Markdown" });
  if (!res.ok) {
    // Retry without markdown if formatting caused error
    await tg("sendMessage", { chat_id: chatId, text });
  }
}

async function typing(chatId: number): Promise<void> {
  await tg("sendChatAction", { chat_id: chatId, action: "typing" });
}

// ── DB helpers ────────────────────────────────────────────────────────────

// Get or create a virtual user for this Telegram chat
async function getOrCreateUser(telegramChatId: number, firstName: string) {
  const email = `tg_${telegramChatId}@telegram.local`;
  const existing = await getUser(email);
  if (existing.length > 0) return existing[0];

  const password = generateUUID();
  await createUser(email, password);
  const [newUser] = await getUser(email);
  return newUser;
}

// Get active chat or create a new one
async function getOrCreateChat(userId: string, telegramChatId: number, title: string) {
  let chatId = activeChatIds.get(telegramChatId);
  if (chatId) return chatId;

  // Try to find the most recent chat for this user
  const chats = await getChatsByUserId({ id: userId, limit: 1, startingAfter: null, endingBefore: null });
  if (chats.hasMore === false && chats.chats.length > 0) {
    chatId = chats.chats[0].id;
    activeChatIds.set(telegramChatId, chatId);
    return chatId;
  }

  // Create new chat
  chatId = generateUUID();
  await saveChat({ id: chatId, userId, title, visibility: "private" });
  activeChatIds.set(telegramChatId, chatId);
  return chatId;
}

// Extract text from message parts (AI SDK v6 format)
function extractText(parts: any): string {
  if (typeof parts === "string") return parts;
  if (Array.isArray(parts)) {
    return parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("");
  }
  return "";
}

// ── Webhook handler ───────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message?.chat?.id) return Response.json({ ok: true });

    const telegramChatId: number = message.chat.id;
    const firstName: string = message.from?.first_name ?? "用户";
    const text: string = message.text ?? "";

    // ── /start ──────────────────────────────────────────────────────────
    if (text === "/start") {
      activeChatIds.delete(telegramChatId);
      await send(telegramChatId,
        `👋 你好 ${firstName}！\n\n` +
        `我是 Claude AI 助手，通过 Telegram 为你提供服务。\n\n` +
        `💬 直接发消息开始对话\n` +
        `📋 /new — 开始新对话\n` +
        `🗂 /history — 查看所有对话记录\n` +
        `🗑 /clear — 清除当前对话\n` +
        `❓ /help — 帮助`
      );
      return Response.json({ ok: true });
    }

    // ── /new ────────────────────────────────────────────────────────────
    if (text === "/new") {
      activeChatIds.delete(telegramChatId);
      await send(telegramChatId, "✅ 已开始新对话！");
      return Response.json({ ok: true });
    }

    // ── /clear ──────────────────────────────────────────────────────────
    if (text === "/clear") {
      const chatId = activeChatIds.get(telegramChatId);
      if (chatId) {
        await deleteChatById({ id: chatId });
        activeChatIds.delete(telegramChatId);
      }
      await send(telegramChatId, "🗑 当前对话已清除，发消息开始新对话。");
      return Response.json({ ok: true });
    }

    // ── /history ────────────────────────────────────────────────────────
    if (text === "/history") {
      await send(telegramChatId,
        `🗂 在网页上查看所有对话记录：\n\n` +
        `登录邮箱：\`tg_${telegramChatId}@telegram.local\`\n` +
        `（首次需要先注册账号）`
      );
      return Response.json({ ok: true });
    }

    // ── /help ───────────────────────────────────────────────────────────
    if (text === "/help") {
      await send(telegramChatId,
        "🤖 *Claude AI 助手*\n\n" +
        "直接发消息即可与 AI 对话\n\n" +
        "命令：\n" +
        "/new — 开始新对话\n" +
        "/clear — 清除当前对话\n" +
        "/history — 在网页查看历史\n" +
        "/help — 显示帮助"
      );
      return Response.json({ ok: true });
    }

    // ── Regular message ──────────────────────────────────────────────────
    if (!text) return Response.json({ ok: true });

    await typing(telegramChatId);

    // Get or create DB user
    const dbUser = await getOrCreateUser(telegramChatId, firstName);
    if (!dbUser) return Response.json({ ok: true });

    // Get or create chat session
    const chatId = await getOrCreateChat(dbUser.id, telegramChatId, text.slice(0, 50));

    // Load history from DB
    const dbMessages = await getMessagesByChatId({ id: chatId });
    const history = dbMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: extractText(m.parts),
    })).filter((m) => m.content);

    // Add current message to history
    history.push({ role: "user", content: text });

    // Call Claude with tools
    const { text: reply } = await generateText({
      model: getLanguageModel(DEFAULT_CHAT_MODEL),
      system: "You are a helpful AI assistant. Reply in the same language as the user. Be concise and friendly. Always use tools to get real-time data: use getWeather for weather, searchWeb for current events, getWikipedia for facts, getCurrentTime for time/date, convertCurrency for exchange rates, fetchUrl to read a webpage, and calculate for math.",
      messages: history,
      tools: { getWeather, searchWeb, getWikipedia, getCurrentTime, convertCurrency, fetchUrl, calculate },
      stopWhen: stepCountIs(5),
    });

    // Save both messages to DB
    const now = new Date();
    const userMsgId = generateUUID();
    const assistantMsgId = generateUUID();

    await saveMessages({
      messages: [
        {
          id: userMsgId,
          chatId,
          role: "user",
          parts: [{ type: "text", text }],
          attachments: [],
          createdAt: now,
        },
        {
          id: assistantMsgId,
          chatId,
          role: "assistant",
          parts: [{ type: "text", text: reply }],
          attachments: [],
          createdAt: new Date(now.getTime() + 1),
        },
      ],
    });

    // Auto-update chat title from first message
    if (dbMessages.length === 0) {
      await updateChatTitleById({ chatId, title: text.slice(0, 60) });
    }

    await send(telegramChatId, reply);

  } catch (err) {
    console.error("[telegram]", err);
  }

  return Response.json({ ok: true });
}
