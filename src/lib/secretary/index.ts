import Anthropic from "@anthropic-ai/sdk";
import { loadSecretaryContext, formatContextForClaude } from "./context";
import { TOOL_DEFINITIONS, executeTool, type ToolName } from "./tools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are the Secretary — the intelligent operator interface for Phantom, an AI-powered X/Twitter lead generation and personal brand automation system.

You have full read and write access to the system via tools. You can read data, modify config, trigger jobs, manage leads, and generate content previews.

Rules:
- Speak directly and concisely. No fluff.
- When you take an action, confirm what you did in one line.
- When asked for data, format it cleanly — use bullet points or short tables where helpful.
- When you see the system state and spot something actionable, mention it briefly at the end.
- Keep responses under 400 characters when just confirming actions. Longer is fine for data queries.
- You are talking to the operator via Telegram — use markdown sparingly (bold for headings, code for values).`;

export async function handleSecretary(
  userMessage: string,
  userId: string | null,
): Promise<string> {
  const ctx = await loadSecretaryContext(userId);
  const systemState = formatContextForClaude(ctx);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  const appUrl = process.env.NEXTAUTH_URL ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";

  for (let round = 0; round < 5; round++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `${SYSTEM}\n\n${systemState}`,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    if (response.stop_reason === "end_turn") {
      return response.content
        .filter(b => b.type === "text")
        .map(b => (b as Anthropic.TextBlock).text)
        .join("")
        .trim() || "Done.";
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(b => b.type === "tool_use") as Anthropic.ToolUseBlock[];

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => ({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: await executeTool(
            block.name as ToolName,
            block.input as Parameters<typeof executeTool>[1],
            userId,
            appUrl,
            cronSecret,
          ),
        }))
      );

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    return response.content
      .filter(b => b.type === "text")
      .map(b => (b as Anthropic.TextBlock).text)
      .join("")
      .trim() || "Done.";
  }

  return "Reached max tool rounds. Try a more specific question.";
}
