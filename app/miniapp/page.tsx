"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const LINKS = [
  {
    group: "AI 助手",
    items: [
      {
        icon: "💬",
        label: "Chatbot 网页版",
        desc: "在浏览器中使用完整 AI 对话",
        url: "https://chatbot-beta-weld-29.vercel.app",
        color: "#2563eb",
      },
    ],
  },
  {
    group: "管理控制台",
    items: [
      {
        icon: "⚡",
        label: "Vercel 仪表板",
        desc: "查看部署状态、日志、资源用量",
        url: "https://vercel.com/buwangni2016s-projects",
        color: "#000000",
      },
      {
        icon: "🐙",
        label: "GitHub 仓库",
        desc: "查看 chatbot / claude-agent 代码",
        url: "https://github.com/buwangni2016",
        color: "#24292e",
      },
      {
        icon: "🔗",
        label: "Maton AI",
        desc: "管理连接器、查看任务历史",
        url: "https://www.maton.ai",
        color: "#7c3aed",
      },
    ],
  },
  {
    group: "AI 模型",
    items: [
      {
        icon: "🔀",
        label: "AnyRouter",
        desc: "AI 模型路由控制台",
        url: "https://anyrouter.top/console",
        color: "#059669",
      },
    ],
  },
  {
    group: "Bot 配置",
    items: [
      {
        icon: "🤖",
        label: "BotFather",
        desc: "修改 Bot 名称、命令、Mini App",
        url: "https://t.me/BotFather",
        color: "#0088cc",
      },
      {
        icon: "🗄️",
        label: "Neon 数据库",
        desc: "查看对话历史数据库",
        url: "https://console.neon.tech",
        color: "#00e5a0",
      },
      {
        icon: "📊",
        label: "Vercel Chatbot 项目",
        desc: "环境变量、域名、函数日志",
        url: "https://vercel.com/buwangni2016s-projects/chatbot",
        color: "#f59e0b",
      },
    ],
  },
];

export default function MiniAppPage() {
  const [tgReady, setTgReady] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      setTheme(tg.colorScheme ?? "light");
      setTgReady(true);
    }
  }, [tgReady]);

  const isDark = theme === "dark";

  const open = (url: string) => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.openLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div
        style={{
          minHeight: "100vh",
          background: isDark ? "#1a1a2e" : "#f0f4ff",
          color: isDark ? "#e2e8f0" : "#1e293b",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: "0 0 32px",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: isDark ? "#16213e" : "#2563eb",
            padding: "20px 16px 16px",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>
            🛠️ 管理面板
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
            Claude AI Bot · 快捷访问
          </div>
        </div>

        {/* Link Groups */}
        <div style={{ padding: "0 12px" }}>
          {LINKS.map((group) => (
            <div key={group.group} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isDark ? "#64748b" : "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 8,
                  paddingLeft: 4,
                }}
              >
                {group.group}
              </div>
              <div
                style={{
                  background: isDark ? "#16213e" : "#ffffff",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: isDark
                    ? "0 2px 8px rgba(0,0,0,0.3)"
                    : "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                {group.items.map((item, idx) => (
                  <button
                    key={item.label}
                    onClick={() => open(item.url)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                      padding: "14px 16px",
                      background: "transparent",
                      border: "none",
                      borderTop: idx > 0
                        ? `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`
                        : "none",
                      cursor: "pointer",
                      textAlign: "left",
                      color: "inherit",
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: item.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        flexShrink: 0,
                        marginRight: 12,
                      }}
                    >
                      {item.icon}
                    </div>
                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{item.label}</div>
                      <div
                        style={{
                          fontSize: 12,
                          color: isDark ? "#64748b" : "#94a3b8",
                          marginTop: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.desc}
                      </div>
                    </div>
                    {/* Arrow */}
                    <div style={{ color: isDark ? "#334155" : "#cbd5e1", fontSize: 18, marginLeft: 8 }}>›</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 12, color: isDark ? "#334155" : "#94a3b8", marginTop: 8 }}>
          Claude AI Bot · Powered by Vercel
        </div>
      </div>
    </>
  );
}
