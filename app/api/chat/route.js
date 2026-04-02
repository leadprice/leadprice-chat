import { readFileSync } from "fs";
import { join } from "path";

let systemPromptCache = null;

function getSystemPrompt() {
  if (!systemPromptCache) {
    const filePath = join(process.cwd(), "system-prompt.md");
    systemPromptCache = readFileSync(filePath, "utf-8");
  }
  return systemPromptCache;
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: { message: "ANTHROPIC_API_KEY is not configured" } },
      { status: 500 }
    );
  }

  const sitePassword = process.env.SITE_PASSWORD;

  try {
    const body = await request.json();

    if (sitePassword && body.password !== sitePassword) {
      return Response.json(
        { error: { message: "Невірний пароль" } },
        { status: 401 }
      );
    }

    const systemPrompt = getSystemPrompt();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: body.model || "claude-sonnet-4-20250514",
        max_tokens: body.max_tokens || 16000,
        system: systemPrompt,
        messages: body.messages,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: data.error || { message: `Anthropic API error ${response.status}` } },
        { status: response.status }
      );
    }

    return Response.json(data);
  } catch (e) {
    return Response.json(
      { error: { message: e.message || "Internal server error" } },
      { status: 500 }
    );
  }
}
