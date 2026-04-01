"use client";

import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `СИСТЕМНИЙ ПРОМПТ — AI-АГЕНТ: АУДИТ + PROJECT VISION (Meta Ads & Google Ads)

РОЛЬ ТА ІДЕНТИЧНІСТЬ
Ти — старший performance-маркетолог агентства LeadPrice з 5+ роками досвіду в Meta Ads та Google Ads. Ти створюєш два типи документів:
1. Аудит — об'єктивна діагностика рекламного кабінету.
2. Project Vision — 90-денний стратегічний Roadmap.

КРИТИЧНІ ПРАВИЛА:
1. Дані ТІЛЬКИ з поточного чату.
2. Мова — ТІЛЬКИ українська. Терміни латиницею.
3. ЗАБОРОНА EMOJI — абсолютна. Тільки: • — [OK] [!] [X] [?]
4. ЗАБОРОНЕНО: джерела бенчмарків, футери, згадки AI.
5. Тон: позитивний, конструктивний.
6. Шапка: "LeadPrice | digital agency" — завжди першим рядком.

СТАРТОВЕ ПОВІДОМЛЕННЯ (надішли його зараз):
Привіт! Готовий допомогти з документами для клієнта.

АУДИТ — напишіть «аудит»
— Діагностика рекламного кабінету: симптоми, точки зливу, резерв росту

PROJECT VISION — напишіть «pv»
— 90-денний стратегічний Roadmap з прогнозами та планом по місяцях

ОБИДВА — напишіть «аудит + pv»
— Спочатку аудит, потім Project Vision на його основі

Після вибору запитай платформу: meta / google / обидві. Потім прийми транскрибацію. Принцип: МІНІМУМ ПИТАНЬ, МАКСИМУМ ДІЙ. Deep Research автоматичний, джерела не вказувати.`;

export default function LeadPriceChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [attachedFileContent, setAttachedFileContent] = useState(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const callAPI = async (msgs) => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: msgs,
      }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API error ${response.status}`);
    }
    const data = await response.json();
    return data.content?.map((b) => b.text || "").join("") || "Порожня відповідь";
  };

  const startChat = async () => {
    setStarted(true);
    setLoading(true);
    setError(null);
    try {
      const text = await callAPI([
        { role: "user", content: "Почни роботу. Надішли стартове повідомлення." },
      ]);
      setMessages([{ role: "assistant", content: text }]);
    } catch (e) {
      setError(e.message);
      setMessages([
        {
          role: "assistant",
          content:
            "Привіт! Готовий допомогти з документами для клієнта.\n\n**АУДИТ** — напишіть «аудит»\n— Діагностика рекламного кабінету: симптоми, точки зливу, резерв росту\n\n**PROJECT VISION** — напишіть «pv»\n— 90-денний стратегічний Roadmap з прогнозами та планом по місяцях\n\n**ОБИДВА** — напишіть «аудит + pv»\n— Спочатку аудит, потім Project Vision на його основі",
        },
      ]);
    }
    setLoading(false);
  };

  const handleFileAttach = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setAttachedFileContent(text.slice(0, 50000));
      }
    };
    if (
      file.type === "text/csv" ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md")
    ) {
      reader.readAsText(file);
    } else {
      setAttachedFileContent(
        "[Файл прикріплено: " + file.name + " — для повної обробки використовуйте Claude Projects]"
      );
    }
  };

  const removeFile = () => {
    setAttachedFile(null);
    setAttachedFileContent(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachedFileContent) || loading) return;
    setError(null);

    let userContent = input.trim();
    if (attachedFileContent) {
      userContent =
        (userContent ? userContent + "\n\n" : "") +
        "--- Прикріплений файл: " +
        (attachedFile?.name || "file") +
        " ---\n" +
        attachedFileContent;
    }

    const userMsg = {
      role: "user",
      content: userContent,
      displayContent: input.trim(),
      fileName: attachedFile?.name,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    removeFile();
    setLoading(true);

    const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const text = await callAPI(apiMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
    } catch (e) {
      setError(e.message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Помилка з'єднання: " + e.message + "\n\nСпробуйте ще раз." },
      ]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (text) => {
    return text.split("\n").map((line, i) => {
      let html = line
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(
          /\|(.*?)\|/g,
          '<code style="background:#1a1a2e;padding:2px 6px;border-radius:4px;font-size:12px">$1</code>'
        );
      return (
        <div
          key={i}
          style={{ minHeight: line === "" ? "10px" : "auto" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    });
  };

  // === LANDING ===
  if (!started) {
    return (
      <div
        style={{
          fontFamily: "'DM Sans', system-ui, sans-serif",
          background: "#0a0a0a",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
        }}
      >
        <div
          style={{
            background: "#c41e1e",
            width: "72px",
            height: "72px",
            borderRadius: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "28px",
            boxShadow: "0 12px 40px rgba(196,30,30,0.4)",
          }}
        >
          <span style={{ color: "#fff", fontSize: "32px", fontWeight: 900 }}>LP</span>
        </div>
        <h1
          style={{
            color: "#fff",
            fontSize: "32px",
            fontWeight: 800,
            margin: "0 0 6px",
            letterSpacing: "-0.5px",
          }}
        >
          LeadPrice
        </h1>
        <p
          style={{
            color: "#666",
            fontSize: "14px",
            letterSpacing: "3px",
            textTransform: "uppercase",
            margin: "0 0 40px",
          }}
        >
          digital agency
        </p>
        <div
          style={{
            background: "#141414",
            border: "1px solid #222",
            borderRadius: "16px",
            padding: "32px 36px",
            maxWidth: "480px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "#e8e8e8", fontSize: "20px", fontWeight: 700, margin: "0 0 12px" }}>
            AI-агент: Аудит + Project Vision
          </h2>
          <p style={{ color: "#888", fontSize: "14px", lineHeight: "1.6", margin: "0 0 28px" }}>
            Meta Ads та Google Ads — діагностика кабінету, 90-денний Roadmap, прогнози та план по
            місяцях.
          </p>
          <button
            onClick={startChat}
            style={{
              background: "linear-gradient(135deg, #c41e1e 0%, #e83a3a 100%)",
              color: "#fff",
              border: "none",
              padding: "14px 40px",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              boxShadow: "0 4px 20px rgba(196,30,30,0.3)",
            }}
          >
            Почати роботу
          </button>
        </div>
      </div>
    );
  }

  // === CHAT ===
  return (
    <div
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: "#0a0a0a",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#111",
          borderBottom: "1px solid #1e1e1e",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            background: "#c41e1e",
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "#fff", fontSize: "15px", fontWeight: 900 }}>LP</span>
        </div>
        <div>
          <div style={{ color: "#fff", fontSize: "15px", fontWeight: 700 }}>LeadPrice AI</div>
          <div style={{ color: "#555", fontSize: "11px" }}>Аудит + Project Vision</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: loading ? "#f59e0b" : "#22c55e",
              boxShadow: loading
                ? "0 0 8px rgba(245,158,11,0.5)"
                : "0 0 8px rgba(34,197,94,0.5)",
            }}
          />
          <span style={{ color: "#666", fontSize: "12px" }}>
            {loading ? "Генерую..." : "Онлайн"}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: "#1a1212",
            borderBottom: "1px solid #331a1a",
            padding: "8px 24px",
            fontSize: "12px",
            color: "#f87171",
          }}
        >
          API: {error}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: "16px",
            }}
          >
            {m.role === "assistant" && (
              <div
                style={{
                  background: "#c41e1e",
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginRight: "10px",
                  marginTop: "2px",
                }}
              >
                <span style={{ color: "#fff", fontSize: "11px", fontWeight: 900 }}>LP</span>
              </div>
            )}
            <div
              style={{
                maxWidth: "80%",
                background: m.role === "user" ? "#1a1a2e" : "#141414",
                border: m.role === "user" ? "1px solid #252540" : "1px solid #1e1e1e",
                borderRadius:
                  m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                padding: "14px 18px",
                fontSize: "14px",
                lineHeight: "1.7",
                color: "#ddd",
              }}
            >
              {m.fileName && (
                <div
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    marginBottom: "10px",
                    fontSize: "12px",
                    color: "#999",
                  }}
                >
                  + {m.fileName}
                </div>
              )}
              {formatMessage(m.displayContent || m.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <div
              style={{
                background: "#c41e1e",
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ color: "#fff", fontSize: "11px", fontWeight: 900 }}>LP</span>
            </div>
            <div
              style={{
                background: "#141414",
                border: "1px solid #1e1e1e",
                borderRadius: "16px 16px 16px 4px",
                padding: "16px 20px",
                display: "flex",
                gap: "6px",
              }}
            >
              {[0, 1, 2].map((j) => (
                <div
                  key={j}
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#c41e1e",
                    animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          borderTop: "1px solid #1e1e1e",
          padding: "16px 24px",
          background: "#0d0d0d",
          flexShrink: 0,
        }}
      >
        {attachedFile && (
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "8px",
              padding: "8px 12px",
              marginBottom: "10px",
              fontSize: "12px",
              color: "#999",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{attachedFile.name}</span>
            <button
              onClick={removeFile}
              style={{
                background: "none",
                border: "none",
                color: "#666",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              x
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "10px",
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#777",
              fontSize: "20px",
              flexShrink: 0,
            }}
          >
            +
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.pdf,.docx,.md"
            style={{ display: "none" }}
            onChange={handleFileAttach}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишіть повідомлення..."
            rows={1}
            style={{
              flex: 1,
              background: "#141414",
              border: "1px solid #222",
              borderRadius: "12px",
              padding: "12px 16px",
              color: "#e8e8e8",
              fontSize: "14px",
              lineHeight: "1.5",
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
              maxHeight: "160px",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || (!input.trim() && !attachedFileContent)}
            style={{
              background:
                loading || (!input.trim() && !attachedFileContent) ? "#222" : "#c41e1e",
              border: "none",
              borderRadius: "10px",
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor:
                loading || (!input.trim() && !attachedFileContent) ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
        textarea::placeholder { color: #555; }
        textarea:focus { border-color: #333; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      `}</style>
    </div>
  );
}
