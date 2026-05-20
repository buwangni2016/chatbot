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
import { executeCode } from "@/lib/ai/tools/execute-code";
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

const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN!;
const MATON_KEY     = process.env.MATON_API_KEY!;
const TELEGRAM_CONN = process.env.TELEGRAM_CONNECTION_ID!;

// ── In-memory state ────────────────────────────────────────────────────────
const activeChatIds = new Map<number, string>();

// ── Keyboards ─────────────────────────────────────────────────────────────
const MAIN_KB = {
  keyboard: [
    ["🌤 天气查询", "📰 搜索新闻", "📖 百科查询"],
    ["🕐 当前时间", "💱 汇率换算", "🧮 数学计算"],
    ["💻 执行代码", "🔗 读取网页", "❓ 帮助"],
  ],
  resize_keyboard: true,
  persistent: true,
};

const REMOVE_KB = { remove_keyboard: true };

// ── Telegram API ──────────────────────────────────────────────────────────
async function tg(method: string, body: object): Promise<any> {
  const url = BOT_TOKEN
    ? `https://api.telegram.org/bot${BOT_TOKEN}/${method}`
    : `https://api.maton.ai/telegram/:token/${method}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!BOT_TOKEN) {
    headers["Authorization"]    = `Bearer ${MATON_KEY}`;
    headers["Maton-Connection"] = TELEGRAM_CONN;
  }
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  return res.json();
}

async function send(chatId: number, text: string, extra?: object): Promise<void> {
  const res = await tg("sendMessage", {
    chat_id: chatId, text,
    parse_mode: "Markdown",
    reply_markup: MAIN_KB,
    ...extra,
  });
  if (!res.ok) {
    await tg("sendMessage", {
      chat_id: chatId, text,
      reply_markup: MAIN_KB,
      ...extra,
    });
  }
}

async function typing(chatId: number): Promise<void> {
  await tg("sendChatAction", { chat_id: chatId, action: "typing" });
}

// Register commands with BotFather (called once on /start)
async function setCommands(): Promise<void> {
  await tg("setMyCommands", {
    commands: [
      { command: "weather",  description: "查询天气 — /weather 北京" },
      { command: "news",     description: "搜索新闻 — /news 关键词" },
      { command: "wiki",     description: "百科查询 — /wiki 主题" },
      { command: "time",     description: "当前时间 — /time 上海" },
      { command: "calc",     description: "数学计算 — /calc 1+1" },
      { command: "rate",     description: "汇率换算 — /rate 100 USD CNY" },
      { command: "code",     description: "执行代码 — /code python print(1+1)" },
      { command: "url",      description: "读取网页 — /url https://example.com" },
      { command: "new",      description: "开始新对话" },
      { command: "clear",    description: "清除当前对话" },
      { command: "history",  description: "在网页查看历史记录" },
      { command: "help",     description: "查看帮助" },
    ],
  });
}

// ── DB helpers ────────────────────────────────────────────────────────────
async function getOrCreateUser(telegramChatId: number) {
  const email = `tg_${telegramChatId}@telegram.local`;
  const existing = await getUser(email);
  if (existing.length > 0) return existing[0];
  const password = generateUUID();
  await createUser(email, password);
  const [newUser] = await getUser(email);
  return newUser;
}

async function getOrCreateChat(userId: string, telegramChatId: number, title: string) {
  let chatId = activeChatIds.get(telegramChatId);
  if (chatId) return chatId;
  const chats = await getChatsByUserId({ id: userId, limit: 1, startingAfter: null, endingBefore: null });
  if (chats.hasMore === false && chats.chats.length > 0) {
    chatId = chats.chats[0].id;
    activeChatIds.set(telegramChatId, chatId);
    return chatId;
  }
  chatId = generateUUID();
  await saveChat({ id: chatId, userId, title, visibility: "private" });
  activeChatIds.set(telegramChatId, chatId);
  return chatId;
}

function extractText(parts: any): string {
  if (typeof parts === "string") return parts;
  if (Array.isArray(parts))
    return parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join("");
  return "";
}

// ── AI call ───────────────────────────────────────────────────────────────
async function askClaude(telegramChatId: number, userMessage: string): Promise<string> {
  const dbUser = await getOrCreateUser(telegramChatId);
  if (!dbUser) return "系统错误，请稍后再试。";

  const chatId = await getOrCreateChat(dbUser.id, telegramChatId, userMessage.slice(0, 50));
  const dbMessages = await getMessagesByChatId({ id: chatId });

  const history = dbMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: extractText(m.parts),
  })).filter((m) => m.content);

  history.push({ role: "user", content: userMessage });

  const { text: reply } = await generateText({
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    system:
      "You are a helpful AI assistant. Reply in the same language as the user. Be concise and friendly. " +
      "Always use tools for real-time data: getWeather for weather, searchWeb for news/current events, " +
      "getWikipedia for facts, getCurrentTime for time/date, convertCurrency for exchange rates, " +
      "fetchUrl to read a webpage, calculate for math, executeCode to run Python/Node.js code.",
    messages: history,
    tools: { getWeather, searchWeb, getWikipedia, getCurrentTime, convertCurrency, fetchUrl, calculate, executeCode },
    stopWhen: stepCountIs(5),
  });

  const now = new Date();
  await saveMessages({
    messages: [
      { id: generateUUID(), chatId, role: "user",      parts: [{ type: "text", text: userMessage }], attachments: [], createdAt: now },
      { id: generateUUID(), chatId, role: "assistant", parts: [{ type: "text", text: reply }],       attachments: [], createdAt: new Date(now.getTime() + 1) },
    ],
  });

  if (dbMessages.length === 0) {
    await updateChatTitleById({ chatId, title: userMessage.slice(0, 60) });
  }

  return reply;
}

// ── Webhook handler ───────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body    = await req.json();
    const message = body?.message;
    if (!message?.chat?.id) return Response.json({ ok: true });

    const chatId    = message.chat.id as number;
    const firstName = message.from?.first_name ?? "用户";
    const text      = (message.text ?? "") as string;

    // ── /start ────────────────────────────────────────────────────────
    if (text === "/start") {
      activeChatIds.delete(chatId);
      await setCommands().catch(() => {});
      await send(chatId,
        `👋 你好 ${firstName}！我是 *Claude AI 助手*\n\n` +
        `我拥有以下实时能力：\n` +
        `🌤 天气 · 📰 新闻 · 📖 百科 · 🕐 时间\n` +
        `💱 汇率 · 🧮 计算 · 💻 代码执行 · 🔗 读网页\n\n` +
        `直接发消息聊天，或点击下方按钮快速使用`
      );
      return Response.json({ ok: true });
    }

    // ── /help ─────────────────────────────────────────────────────────
    if (text === "/help") {
      await send(chatId,
        "*🤖 Claude AI 助手 — 功能说明*\n\n" +
        "*快捷命令：*\n" +
        "/weather `城市` — 实时天气\n" +
        "/news `关键词` — 搜索新闻\n" +
        "/wiki `主题` — 百科查询\n" +
        "/time `城市` — 当前时间\n" +
        "/calc `表达式` — 数学计算\n" +
        "/rate `金额 源币 目标币` — 汇率换算\n" +
        "/code `python|node 代码` — 执行代码\n" +
        "/url `网址` — 读取网页内容\n\n" +
        "*对话管理：*\n" +
        "/new — 开始新对话\n" +
        "/clear — 清除当前对话\n" +
        "/history — 在网页查看历史"
      );
      return Response.json({ ok: true });
    }

    // ── /new ──────────────────────────────────────────────────────────
    if (text === "/new") {
      activeChatIds.delete(chatId);
      await send(chatId, "✅ 已开始新对话，直接发消息吧！");
      return Response.json({ ok: true });
    }

    // ── /clear ────────────────────────────────────────────────────────
    if (text === "/clear") {
      const cid = activeChatIds.get(chatId);
      if (cid) { await deleteChatById({ id: cid }); activeChatIds.delete(chatId); }
      await send(chatId, "🗑 当前对话已清除。");
      return Response.json({ ok: true });
    }

    // ── /history ──────────────────────────────────────────────────────
    if (text === "/history") {
      await send(chatId,
        `🗂 *在网页查看完整对话历史*\n\n` +
        `登录邮箱：\`tg_${chatId}@telegram.local\`\n` +
        `网址：https://chatbot-beta-weld-29.vercel.app`
      );
      return Response.json({ ok: true });
    }

    // ── 快捷命令 /weather /news /wiki /time /calc /rate /code /url ────
    const cmdMatch = text.match(/^\/(\w+)(?:\s+(.*))?$/s);
    if (cmdMatch) {
      const [, cmd, arg = ""] = cmdMatch;
      let prompt = "";

      switch (cmd) {
        case "weather": prompt = arg ? `查询${arg}的天气` : ""; break;
        case "news":    prompt = arg ? `搜索最新新闻：${arg}` : ""; break;
        case "wiki":    prompt = arg ? `用维基百科介绍：${arg}` : ""; break;
        case "time":    prompt = arg ? `${arg}现在是什么时间` : "现在是什么时间"; break;
        case "calc":    prompt = arg ? `计算：${arg}` : ""; break;
        case "rate":    prompt = arg ? `汇率换算：${arg}` : ""; break;
        case "code":    prompt = arg ? `执行代码：${arg}` : ""; break;
        case "url":     prompt = arg ? `读取并总结这个网页：${arg}` : ""; break;
      }

      // 无参数时给出提示
      if (cmdMatch && !prompt) {
        const hints: Record<string, string> = {
          weather: "请输入城市名，例如：\n`/weather 北京`",
          news:    "请输入关键词，例如：\n`/news 人工智能`",
          wiki:    "请输入查询主题，例如：\n`/wiki 量子计算`",
          time:    "请输入城市，例如：\n`/time 东京`",
          calc:    "请输入表达式，例如：\n`/calc 15% of 2000`",
          rate:    "请输入金额和货币，例如：\n`/rate 100 USD CNY`",
          code:    "请输入语言和代码，例如：\n`/code python print('hello')`",
          url:     "请输入网址，例如：\n`/url https://example.com`",
        };
        if (hints[cmd]) {
          await send(chatId, hints[cmd]);
          return Response.json({ ok: true });
        }
      }

      if (prompt) {
        await typing(chatId);
        const reply = await askClaude(chatId, prompt);
        await send(chatId, reply);
        return Response.json({ ok: true });
      }
    }

    // ── 按钮文本处理 ─────────────────────────────────────────────────
    const btnHints: Record<string, string> = {
      "🌤 天气查询": "请告诉我你想查哪个城市的天气？\n例如：北京天气 / 东京今天天气",
      "📰 搜索新闻": "请告诉我你想搜索什么新闻？\n例如：今日科技新闻 / 中美关系最新动态",
      "📖 百科查询": "请告诉我你想了解什么？\n例如：黑洞 / 人工智能历史",
      "🕐 当前时间": null as any, // 直接执行
      "💱 汇率换算": "请输入换算需求，例如：\n100美元换人民币 / 1000日元是多少港币",
      "🧮 数学计算": "请输入你要计算的内容，例如：\n1234 × 5678 / 15% 的 2000 是多少",
      "💻 执行代码": "请发送要执行的代码，格式：\n语言（python/node）+ 代码\n\n例如：python\n```\nprint('Hello World')\n```",
      "🔗 读取网页": "请发送你想读取的网页链接，例如：\nhttps://example.com",
      "❓ 帮助":     null as any,
    };

    if (text in btnHints) {
      if (text === "🕐 当前时间") {
        await typing(chatId);
        const reply = await askClaude(chatId, "现在是什么时间？显示北京时间和UTC时间");
        await send(chatId, reply);
        return Response.json({ ok: true });
      }
      if (text === "❓ 帮助") {
        // reuse /help
        await send(chatId,
          "*🤖 Claude AI 助手 — 功能说明*\n\n" +
          "*快捷命令：*\n" +
          "/weather `城市` — 实时天气\n" +
          "/news `关键词` — 搜索新闻\n" +
          "/wiki `主题` — 百科查询\n" +
          "/time `城市` — 当前时间\n" +
          "/calc `表达式` — 数学计算\n" +
          "/rate `金额 源币 目标币` — 汇率换算\n" +
          "/code `python|node 代码` — 执行代码\n" +
          "/url `网址` — 读取网页内容\n\n" +
          "*对话管理：*\n" +
          "/new — 开始新对话\n" +
          "/clear — 清除当前对话\n" +
          "/history — 在网页查看历史"
        );
        return Response.json({ ok: true });
      }
      await send(chatId, btnHints[text]);
      return Response.json({ ok: true });
    }

    // ── Regular message → Claude ──────────────────────────────────────
    if (!text) return Response.json({ ok: true });
    await typing(chatId);
    const reply = await askClaude(chatId, text);
    await send(chatId, reply);

  } catch (err) {
    console.error("[telegram]", err);
  }

  return Response.json({ ok: true });
}
