import { generateText, stepCountIs } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { searchWeb } from "@/lib/ai/tools/search-web";
import { getCurrentTime } from "@/lib/ai/tools/get-current-time";

// CRON_SECRET is automatically injected by Vercel for cron jobs
const CRON_SECRET   = process.env.CRON_SECRET ?? "";
const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_CHATS   = (process.env.TELEGRAM_ADMIN_CHAT_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);

async function sendTg(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const { searchParams } = new URL(req.url);
  const manualKey = searchParams.get("key");

  // Allow: Vercel Cron (CRON_SECRET header) OR manual trigger with correct key
  const isVercelCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  const isManual     = manualKey && ADMIN_CHATS.includes(manualKey);

  if (!isVercelCron && !isManual) {
    // If no CRON_SECRET set yet (first deploy), allow to check setup
    if (!CRON_SECRET) {
      return Response.json({ status: "CRON_SECRET not yet configured by Vercel" });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (ADMIN_CHATS.length === 0) {
    return Response.json({ error: "No TELEGRAM_ADMIN_CHAT_IDS configured" }, { status: 400 });
  }

  try {
    const city = process.env.BRIEF_CITY ?? "上海";

    const { text: brief } = await generateText({
      model: getLanguageModel(DEFAULT_CHAT_MODEL),
      system:
        "You are a morning briefing assistant. Create a concise daily brief in Chinese. " +
        "Format with clear sections. Keep it under 600 characters total.",
      messages: [{
        role: "user",
        content:
          `生成今日早报，包含：\n` +
          `1. 今天日期和${city}天气（温度、天气状况）\n` +
          `2. 今日3条重要新闻标题\n` +
          `3. 一句鼓励语\n` +
          `格式简洁，适合手机阅读。`,
      }],
      tools: { getWeather, searchWeb, getCurrentTime },
      stopWhen: stepCountIs(4),
    });

    await Promise.all(ADMIN_CHATS.map(id => sendTg(id, `🌅 *每日早报*\n\n${brief}`)));

    return Response.json({ ok: true, sent: ADMIN_CHATS.length });
  } catch (err: any) {
    console.error("[cron/daily-brief]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
