"use client";

import { useState, useRef, useEffect } from "react";

export default function LeadPriceChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Restore chat from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lp-chat");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.messages?.length) {
          setMessages(data.messages);
          setStarted(true);
          setAuthorized(true);
        }
      }
    } catch (e) {}
  }, []);

  // Save chat to localStorage when messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("lp-chat", JSON.stringify({ messages }));
    }
  }, [messages]);

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
        max_tokens: 16000,
        messages: msgs,
        password: password
      })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API error ${response.status}`);
    }
    const data = await response.json();
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
    return { text, stop_reason: data.stop_reason };
  };

  const callAPIWithContinuation = async (msgs) => {
    let fullText = "";
    let currentMsgs = [...msgs];
    let maxLoops = 5;
    while (maxLoops-- > 0) {
      const result = await callAPI(currentMsgs);
      fullText += result.text;
      if (result.stop_reason !== "max_tokens") break;
      currentMsgs = [...currentMsgs, { role: "assistant", content: fullText }, { role: "user", content: "Продовжуй з того місця, де зупинився. Не повторюй те, що вже написав." }];
    }
    return fullText;
  };

  const startChat = async () => {
    setStarted(true);
    setLoading(true);
    setError(null);
    try {
      const result = await callAPI([{ role: "user", content: "Почни роботу." }]);
      setMessages([{ role: "assistant", content: result.text }]);
    } catch (e) {
      if (e.message === "Невірний пароль") {
        setStarted(false);
        setAuthorized(false);
        setPassword("");
        setPasswordError("Невірний пароль. Спробуйте ще раз.");
        setLoading(false);
        return;
      }
      setError(e.message);
      setMessages([{ role: "assistant", content: "Привіт! Готовий допомогти з документами для клієнта.\n\nНапишіть що потрібно і для якої платформи:\n\n— Аудит Meta / Аудит Google\n— Project Vision Meta / Project Vision Google\n— Аудит + PV Meta / Аудит + PV Google\n\nАбо натисніть одну з кнопок нижче." }]);
    }
    setLoading(false);
  };

  // --- FILE HANDLING ---
  const processFiles = (fileList) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    const textTypes = [".csv", ".txt", ".md", ".json", ".tsv"];
    files.forEach(file => {
      const entry = { file, name: file.name, content: null };
      if (textTypes.some(ext => file.name.toLowerCase().endsWith(ext)) || file.type.startsWith("text/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result;
          if (typeof text === "string") {
            entry.content = text.slice(0, 80000);
            setAttachedFiles(prev => prev.map(f => f === entry ? { ...f, content: entry.content } : f));
          }
        };
        reader.readAsText(file);
      } else {
        entry.content = "[Файл: " + file.name + " — тип: " + (file.type || "невідомий") + ", розмір: " + (file.size / 1024).toFixed(1) + "KB]";
      }
      setAttachedFiles(prev => [...prev, entry]);
    });
  };

  const handleFileAttach = (e) => { processFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ""; };
  const removeFile = (index) => { setAttachedFiles(prev => prev.filter((_, i) => i !== index)); };
  const removeAllFiles = () => { setAttachedFiles([]); };

  // --- DRAG & DROP ---
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
    if (e.dataTransfer?.files?.length) processFiles(e.dataTransfer.files);
  };

  // --- RESET CHAT ---
  const resetChat = async () => {
    setShowResetConfirm(false);
    setMessages([]);
    setInput("");
    removeAllFiles();
    setError(null);
    localStorage.removeItem("lp-chat");
    setLoading(true);
    try {
      const result = await callAPI([{ role: "user", content: "Почни роботу." }]);
      setMessages([{ role: "assistant", content: result.text }]);
    } catch (e) {
      setMessages([{ role: "assistant", content: "Привіт! Готовий допомогти з документами для клієнта.\n\nНапишіть що потрібно і для якої платформи:\n\n— Аудит Meta / Аудит Google\n— Project Vision Meta / Project Vision Google\n— Аудит + PV Meta / Аудит + PV Google\n\nАбо натисніть одну з кнопок нижче." }]);
    }
    setLoading(false);
  };

  // --- DOCX EXPORT ---
  const getDocType = (text) => {
    const lower = text.toLowerCase();
    const hasAuditMarkers = (lower.includes("блок 1") || lower.includes("блок 2")) && (lower.includes("audit") || lower.includes("аудит"));
    const hasPvMarkers = (lower.includes("місяць 1") || lower.includes("місяць 2")) && (lower.includes("project vision") || lower.includes("roadmap") || lower.includes("стратегічне рішення"));
    if (hasAuditMarkers) return "audit";
    if (hasPvMarkers) return "pv";
    return "other";
  };

  const getDocLabel = (type) => {
    if (type === "audit") return "Вивантажити Аудит у DOCX";
    if (type === "pv") return "Вивантажити Project Vision у DOCX";
    return "Вивантажити у DOCX";
  };

  const getDocFilename = (type) => {
    const date = new Date().toISOString().slice(0, 10);
    if (type === "audit") return `LeadPrice_Audit_${date}.doc`;
    if (type === "pv") return `LeadPrice_Project_Vision_${date}.doc`;
    return `LeadPrice_${date}.doc`;
  };

  const exportDocx = (text) => {
    const clean = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    const type = getDocType(text);
    let tableOpen = false;
    const lines = clean.split("\n").filter(line => !isTableSeparator(line)).map(line => {
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("---")) return "<hr>";
      if (line.startsWith("|")) {
        const cells = line.split("|").filter(c => c.trim());
        if (!cells.length) return "";
        let prefix = "";
        if (!tableOpen) { prefix = '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;margin:12px 0;">'; tableOpen = true; }
        return prefix + `<tr>${cells.map(c => `<td style="border:1px solid #ccc;padding:6px 10px;font-size:10pt;">${c.trim()}</td>`).join("")}</tr>`;
      }
      if (tableOpen && !line.startsWith("|")) { tableOpen = false; return "</table>" + (line.trim() ? `<p style="margin:4px 0;">${line}</p>` : "<br>"); }
      if (line.startsWith("• ") || line.startsWith("- ")) return `<p style="margin:2px 0 2px 24px;">${line}</p>`;
      if (line.trim() === "") return "<br>";
      return `<p style="margin:4px 0;">${line}</p>`;
    });
    if (tableOpen) lines.push("</table>");

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.6;margin:40px 50px;}
h1{font-size:16pt;margin:24px 0 8px;color:#1a1a1a;}
h2{font-size:13pt;margin:20px 0 6px;color:#333;}
h3{font-size:11pt;margin:16px 0 4px;color:#444;}
b{font-weight:bold;}
table{border-collapse:collapse;width:100%;margin:12px 0;}
td,th{border:1px solid #bbb;padding:6px 10px;font-size:10pt;}
hr{border:none;border-top:1px solid #ddd;margin:20px 0;}
</style></head><body>${lines.join("")}</body></html>`;

    const blob = new Blob(['\ufeff' + html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getDocFilename(type);
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- SEND ---
  const sendMessage = async () => {
    const hasFiles = attachedFiles.some(f => f.content);
    if ((!input.trim() && !hasFiles) || loading) return;
    setError(null);
    let userContent = input.trim();
    if (hasFiles) {
      const filesText = attachedFiles.filter(f => f.content).map(f => "--- Файл: " + f.name + " ---\n" + f.content).join("\n\n");
      userContent = (userContent ? userContent + "\n\n" : "") + filesText;
    }
    const fileNames = attachedFiles.map(f => f.name);
    const userMsg = { role: "user", content: userContent, displayContent: input.trim(), fileNames: fileNames.length ? fileNames : undefined };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    removeAllFiles();
    setLoading(true);
    try {
      const text = await callAPIWithContinuation(newMessages.map(m => ({ role: m.role, content: m.content })));
      setMessages(prev => [...prev, { role: "assistant", content: text }]);
    } catch (e) {
      setError(e.message);
      setMessages(prev => [...prev, { role: "assistant", content: "Помилка: " + e.message }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const isTableSeparator = (line) => { const t = line.trim(); return t.startsWith("|") && t.includes("-") && /^[|\s:-]+$/.test(t); };
  const formatMessage = (text) => text.split("\n").filter(line => !isTableSeparator(line)).map((line, i) => {
    let html = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return <div key={i} style={{ minHeight: line === "" ? "10px" : "auto" }} dangerouslySetInnerHTML={{ __html: html }} />;
  });

  // === PASSWORD SCREEN ===
  if (!authorized) {
    return (
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#0a0a0a", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ background: "#c41e1e", width: "72px", height: "72px", borderRadius: "18px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "28px", boxShadow: "0 12px 40px rgba(196,30,30,0.4)" }}>
          <span style={{ color: "#fff", fontSize: "32px", fontWeight: 900 }}>LP</span>
        </div>
        <h1 style={{ color: "#fff", fontSize: "32px", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px" }}>LeadPrice</h1>
        <p style={{ color: "#666", fontSize: "14px", letterSpacing: "3px", textTransform: "uppercase", margin: "0 0 40px" }}>digital agency</p>
        <div style={{ background: "#141414", border: "1px solid #222", borderRadius: "16px", padding: "32px 36px", maxWidth: "400px", width: "100%", textAlign: "center" }}>
          <h2 style={{ color: "#e8e8e8", fontSize: "18px", fontWeight: 700, margin: "0 0 20px" }}>Введіть пароль</h2>
          <input type="password" value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && password.trim()) setAuthorized(true); }}
            placeholder="Пароль"
            style={{ width: "100%", background: "#1a1a1a", border: passwordError ? "1px solid #c41e1e" : "1px solid #333", borderRadius: "10px", padding: "12px 16px", color: "#e8e8e8", fontSize: "15px", outline: "none", fontFamily: "inherit", marginBottom: "8px" }}
          />
          {passwordError && <p style={{ color: "#f87171", fontSize: "13px", margin: "0 0 12px" }}>{passwordError}</p>}
          <button onClick={() => { if (password.trim()) setAuthorized(true); }}
            style={{ background: "linear-gradient(135deg, #c41e1e 0%, #e83a3a 100%)", color: "#fff", border: "none", padding: "14px 40px", borderRadius: "10px", fontSize: "15px", fontWeight: 700, cursor: "pointer", width: "100%", marginTop: "8px", boxShadow: "0 4px 20px rgba(196,30,30,0.3)" }}>
            Увійти
          </button>
        </div>
      </div>
    );
  }

  // === LANDING ===
  if (!started) {
    return (
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#0a0a0a", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ background: "#c41e1e", width: "72px", height: "72px", borderRadius: "18px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "28px", boxShadow: "0 12px 40px rgba(196,30,30,0.4)" }}>
          <span style={{ color: "#fff", fontSize: "32px", fontWeight: 900 }}>LP</span>
        </div>
        <h1 style={{ color: "#fff", fontSize: "32px", fontWeight: 800, margin: "0 0 6px" }}>LeadPrice</h1>
        <p style={{ color: "#666", fontSize: "14px", letterSpacing: "3px", textTransform: "uppercase", margin: "0 0 40px" }}>digital agency</p>
        <div style={{ background: "#141414", border: "1px solid #222", borderRadius: "16px", padding: "32px 36px", maxWidth: "480px", width: "100%", textAlign: "center" }}>
          <h2 style={{ color: "#e8e8e8", fontSize: "20px", fontWeight: 700, margin: "0 0 12px" }}>AI-агент: Аудит + Project Vision</h2>
          <p style={{ color: "#888", fontSize: "14px", lineHeight: "1.6", margin: "0 0 28px" }}>Meta Ads та Google Ads — діагностика кабінету, 90-денний Roadmap, прогнози та план по місяцях.</p>
          <button onClick={startChat} style={{ background: "linear-gradient(135deg, #c41e1e 0%, #e83a3a 100%)", color: "#fff", border: "none", padding: "14px 40px", borderRadius: "10px", fontSize: "15px", fontWeight: 700, cursor: "pointer", width: "100%", boxShadow: "0 4px 20px rgba(196,30,30,0.3)" }}>
            Почати роботу
          </button>
        </div>
      </div>
    );
  }

  // === CHAT ===
  return (
    <div
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#0a0a0a", height: "100vh", display: "flex", flexDirection: "column", position: "relative" }}
    >

      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #1e1e1e", padding: "14px 24px", display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 }}>
        <div style={{ background: "#c41e1e", width: "36px", height: "36px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "#fff", fontSize: "15px", fontWeight: 900 }}>LP</span>
        </div>
        <div>
          <div style={{ color: "#fff", fontSize: "15px", fontWeight: 700 }}>LeadPrice AI</div>
          <div style={{ color: "#555", fontSize: "11px" }}>Аудит + Project Vision</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
          <button
              onClick={() => messages.length > 1 ? setShowResetConfirm(true) : null}
              style={{
                background: "transparent",
                border: "2px solid #f5c518",
                borderRadius: "10px",
                padding: "8px 22px",
                fontSize: "14px",
                color: "#fff",
                cursor: messages.length > 1 ? "pointer" : "default",
                fontWeight: 700,
                fontFamily: "inherit",
                transition: "all 0.3s",
                opacity: messages.length > 1 ? 1 : 0.35,
                boxShadow: messages.length > 1 ? "0 0 12px rgba(245,197,24,0.25)" : "none"
              }}
              onMouseEnter={e => { if (messages.length > 1) { e.target.style.boxShadow = "0 0 20px rgba(245,197,24,0.5)"; }}}
              onMouseLeave={e => { if (messages.length > 1) { e.target.style.boxShadow = "0 0 12px rgba(245,197,24,0.25)"; }}}
            >
              Новий чат
            </button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: loading ? "#f59e0b" : "#22c55e", boxShadow: loading ? "0 0 8px rgba(245,158,11,0.5)" : "0 0 8px rgba(34,197,94,0.5)" }} />
            <span style={{ color: "#666", fontSize: "12px" }}>{loading ? "Генерую..." : "Онлайн"}</span>
          </div>
        </div>
      </div>

      {/* Reset confirmation modal */}
      {showResetConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "16px", padding: "28px 32px", maxWidth: "400px", width: "90%", textAlign: "center" }}>
            <p style={{ color: "#fff", fontSize: "16px", fontWeight: 700, margin: "0 0 8px" }}>Почати новий чат?</p>
            <p style={{ color: "#888", fontSize: "13px", lineHeight: "1.5", margin: "0 0 24px" }}>Вся переписка буде видалена. Спочатку вивантажте документи у DOCX, якщо ще не зробили.</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => setShowResetConfirm(false)}
                style={{ background: "#252525", border: "1px solid #444", borderRadius: "8px", padding: "10px 24px", fontSize: "13px", color: "#ccc", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>
                Скасувати
              </button>
              <button onClick={resetChat}
                style={{ background: "#c41e1e", border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "13px", color: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
                Так, новий чат
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div style={{ background: "#1a1212", borderBottom: "1px solid #331a1a", padding: "8px 24px", fontSize: "12px", color: "#f87171" }}>API: {error}</div>}

      {/* Messages */}
      <div onDragOver={handleDragOver} onDrop={handleDrop} style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: "16px" }}>
            {m.role === "assistant" && (
              <div style={{ background: "#c41e1e", width: "28px", height: "28px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: "10px", marginTop: "2px" }}>
                <span style={{ color: "#fff", fontSize: "11px", fontWeight: 900 }}>LP</span>
              </div>
            )}
            <div style={{ maxWidth: "80%" }}>
              <div style={{
                background: m.role === "user" ? "#1a1a2e" : "#141414",
                border: m.role === "user" ? "1px solid #252540" : "1px solid #1e1e1e",
                borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                padding: "14px 18px", fontSize: "14px", lineHeight: "1.7", color: "#ddd"
              }}>
                {m.fileNames?.length > 0 && (
                  <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", padding: "6px 12px", marginBottom: "10px", fontSize: "12px", color: "#999" }}>
                    {m.fileNames.map((fn, fi) => <div key={fi}>+ {fn}</div>)}
                  </div>
                )}
                {formatMessage(m.displayContent !== undefined ? m.displayContent : m.content)}
              </div>
              {/* "Зробити Project Vision" button after audit */}
              {m.role === "assistant" && getDocType(m.content) === "audit" && !messages.some(msg => msg.role === "assistant" && getDocType(msg.content) === "pv") && !loading && (
                <button
                  onClick={async () => {
                    const pvRequest = { role: "user", content: "Зроби Project Vision на основі цього аудиту. Та сама платформа, ті самі дані.", displayContent: "Зробити Project Vision" };
                    const newMsgs = [...messages, pvRequest];
                    setMessages(newMsgs);
                    setLoading(true);
                    try {
                      const text = await callAPIWithContinuation(newMsgs.map(msg => ({ role: msg.role, content: msg.content })));
                      setMessages(prev => [...prev, { role: "assistant", content: text }]);
                    } catch (e) {
                      setMessages(prev => [...prev, { role: "assistant", content: "Помилка: " + e.message }]);
                    }
                    setLoading(false);
                  }}
                  onMouseEnter={e => { e.target.style.background = "#c41e1e"; e.target.style.borderColor = "#c41e1e"; }}
                  onMouseLeave={e => { e.target.style.background = "#1a1a1a"; e.target.style.borderColor = "#fff"; }}
                  style={{ background: "#1a1a1a", border: "2px solid #fff", borderRadius: "8px", padding: "10px 20px", marginTop: "12px", fontSize: "14px", color: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s", display: "inline-block" }}
                >
                  Зробити Project Vision
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <div style={{ background: "#c41e1e", width: "28px", height: "28px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "#fff", fontSize: "11px", fontWeight: 900 }}>LP</span>
            </div>
            <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: "16px 16px 16px 4px", padding: "16px 20px", display: "flex", gap: "6px" }}>
              {[0, 1, 2].map(j => (
                <div key={j} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#c41e1e", animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: "1px solid #1e1e1e", padding: "12px 24px 16px", background: "#0d0d0d", flexShrink: 0, position: "relative" }}>
        {/* Drag overlay — only on input area */}
        {dragging && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(196,30,30,0.12)", border: "2px dashed #c41e1e", borderRadius: "8px", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(2px)" }}>
            <div style={{ background: "#1a1a1a", padding: "14px 28px", borderRadius: "10px", border: "1px solid #c41e1e" }}>
              <p style={{ color: "#fff", fontSize: "15px", fontWeight: 700, margin: 0 }}>Перетягніть файли сюди</p>
              <p style={{ color: "#888", fontSize: "12px", margin: "4px 0 0", textAlign: "center" }}>CSV, TXT, PDF, DOCX</p>
            </div>
          </div>
        )}

        {/* Quick action buttons - show at start */}
        {messages.length <= 1 && !loading && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            {[
              { label: "Аудит Meta", value: "аудит meta" },
              { label: "Аудит Google", value: "аудит google" },
              { label: "Project Vision Meta", value: "project vision meta" },
              { label: "Project Vision Google", value: "project vision google" }
            ].map(btn => (
              <button
                key={btn.value}
                onClick={async () => {
                  const userMsg = { role: "user", content: btn.value, displayContent: btn.value };
                  const newMsgs = [...messages, userMsg];
                  setMessages(newMsgs);
                  setLoading(true);
                  try {
                    const text = await callAPIWithContinuation(newMsgs.map(m => ({ role: m.role, content: m.content })));
                    setMessages(prev => [...prev, { role: "assistant", content: text }]);
                  } catch (e) {
                    setMessages(prev => [...prev, { role: "assistant", content: "Помилка: " + e.message }]);
                  }
                  setLoading(false);
                }}
                onMouseEnter={e => { e.target.style.borderColor = "#c41e1e"; e.target.style.color = "#fff"; }}
                onMouseLeave={e => { e.target.style.borderColor = "#333"; e.target.style.color = "#aaa"; }}
                style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", color: "#aaa", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s" }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
            {attachedFiles.map((f, i) => (
              <div key={i} style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", color: "#999", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>{f.name}</span>
                <button onClick={() => removeFile(i)} style={{ background: "none", border: "none", color: "#c41e1e", cursor: "pointer", fontSize: "18px", fontWeight: 900, padding: "0 2px", lineHeight: 1 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
          <button onClick={() => fileInputRef.current?.click()} style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "10px", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#777", fontSize: "20px", flexShrink: 0 }}>+</button>
          <input ref={fileInputRef} type="file" multiple accept=".csv,.txt,.pdf,.docx,.md,.tsv,.json" style={{ display: "none" }} onChange={handleFileAttach} />
          <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Напишіть повідомлення або перетягніть файл..." rows={1}
            style={{ flex: 1, background: "#141414", border: "1px solid #222", borderRadius: "12px", padding: "12px 16px", color: "#e8e8e8", fontSize: "14px", lineHeight: "1.5", resize: "none", outline: "none", fontFamily: "inherit", maxHeight: "160px" }} />
          <button onClick={sendMessage} disabled={loading || (!input.trim() && !attachedFiles.length)}
            style={{ background: (loading || (!input.trim() && !attachedFiles.length)) ? "#222" : "#c41e1e", border: "none", borderRadius: "10px", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", cursor: (loading || (!input.trim() && !attachedFiles.length)) ? "not-allowed" : "pointer", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>

        {/* Export buttons - always visible, below input */}
        {(() => {
          const docs = messages.filter(m => m.role === "assistant" && m.content.length > 500);
          const auditMsg = docs.find(m => getDocType(m.content) === "audit");
          const pvMsg = docs.find(m => getDocType(m.content) === "pv");
          return (
            <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
              <button onClick={() => auditMsg ? exportDocx(auditMsg.content) : null}
                style={{
                  background: auditMsg ? "#1a1a1a" : "transparent",
                  border: auditMsg ? "2px solid #fff" : "1px dashed #444",
                  borderRadius: "8px", padding: "8px 16px", fontSize: "13px",
                  color: auditMsg ? "#fff" : "#666",
                  cursor: auditMsg ? "pointer" : "default",
                  fontWeight: 600, fontFamily: "inherit", transition: "all 0.2s"
                }}
                onMouseEnter={e => { if (auditMsg) { e.target.style.borderColor = "#c41e1e"; e.target.style.background = "#c41e1e"; e.target.style.color = "#fff"; }}}
                onMouseLeave={e => { if (auditMsg) { e.target.style.borderColor = "#fff"; e.target.style.background = "#1a1a1a"; e.target.style.color = "#fff"; }}}
              >
                {auditMsg ? "Вивантажити Аудит у DOCX" : "Аудит — очікую документ"}
              </button>
              <button onClick={() => pvMsg ? exportDocx(pvMsg.content) : null}
                style={{
                  background: pvMsg ? "#1a1a1a" : "transparent",
                  border: pvMsg ? "2px solid #fff" : "1px dashed #444",
                  borderRadius: "8px", padding: "8px 16px", fontSize: "13px",
                  color: pvMsg ? "#fff" : "#666",
                  cursor: pvMsg ? "pointer" : "default",
                  fontWeight: 600, fontFamily: "inherit", transition: "all 0.2s"
                }}
                onMouseEnter={e => { if (pvMsg) { e.target.style.borderColor = "#c41e1e"; e.target.style.background = "#c41e1e"; e.target.style.color = "#fff"; }}}
                onMouseLeave={e => { if (pvMsg) { e.target.style.borderColor = "#fff"; e.target.style.background = "#1a1a1a"; e.target.style.color = "#fff"; }}}
              >
                {pvMsg ? "Вивантажити Project Vision у DOCX" : "Project Vision — очікую документ"}
              </button>
            </div>
          );
        })()}
      </div>
      <style>{`
        @keyframes pulse { 0%,80%,100%{opacity:.3;transform:scale(.8)} 40%{opacity:1;transform:scale(1.1)} }
        textarea::placeholder{color:#555} textarea:focus{border-color:#333}
        ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
      `}</style>
    </div>
  );
}
