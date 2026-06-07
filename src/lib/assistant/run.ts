import type Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_MODEL, ASSISTANT_MAX_TOKENS, getAnthropicClient } from "./anthropic";

/**
 * Manual server-side tool-use loop for the ABCAC assistant.
 *
 * We run the loop ourselves (rather than the SDK tool runner) so every tool
 * call is gated/audited server-side: member tools always operate on the
 * caller's own rows via the RLS-scoped Supabase client, and admin tools
 * re-check `is_admin()` before acting. The executor map is supplied per-request
 * by the route after it has resolved the caller's role.
 *
 * Per the Anthropic manual-loop guidance for opus-4-8: adaptive thinking, no
 * temperature/top_p/top_k/budget_tokens (those 400 on opus-4-8). We loop while
 * `stop_reason === "tool_use"`, append `response.content` to messages, execute
 * each tool_use block, then push a user message carrying the matching
 * `tool_result` blocks.
 */

/** A tool definition: plain JSON-schema, exactly what the API expects. */
export interface AssistantTool {
  name: string;
  description: string;
  input_schema: Anthropic.Tool["input_schema"];
}

/**
 * Executes one tool call. Receives the already-parsed input object (the SDK
 * parses tool inputs for us) and returns a string result for the model. Throw
 * to signal an error — the runner converts it to an `is_error` tool_result.
 */
export type ToolExecutor = (input: Record<string, unknown>) => Promise<string>;

/** One entry in the compact "Actions taken" log surfaced to the UI. */
export interface ActionLogEntry {
  tool: string;
  input: Record<string, unknown>;
  ok: boolean;
  summary: string;
}

export interface RunResult {
  reply: string;
  actions: ActionLogEntry[];
}

/** A safety cap so a misbehaving loop can never run unbounded. */
const MAX_ITERATIONS = 12;

export async function runAssistant(params: {
  system: string;
  messages: Anthropic.MessageParam[];
  tools: AssistantTool[];
  executors: Record<string, ToolExecutor>;
}): Promise<RunResult> {
  const { system, tools, executors } = params;
  const client = getAnthropicClient();

  // Work on a copy so we never mutate the caller's history array.
  const messages: Anthropic.MessageParam[] = [...params.messages];
  const actions: ActionLogEntry[] = [];

  let finalText = "";

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: ASSISTANT_MAX_TOKENS,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system,
      tools,
      messages,
    });

    // Capture any text the model produced this turn (the visible reply).
    const turnText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (turnText) finalText = turnText;

    if (response.stop_reason !== "tool_use") {
      // end_turn / max_tokens / refusal / stop_sequence — we're done.
      break;
    }

    // Preserve the full assistant turn (text + tool_use blocks) verbatim.
    messages.push({ role: "assistant", content: response.content });

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const input = (block.input ?? {}) as Record<string, unknown>;
      const executor = executors[block.name];
      if (!executor) {
        actions.push({ tool: block.name, input, ok: false, summary: "Unknown tool." });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Unknown tool: ${block.name}`,
          is_error: true,
        });
        continue;
      }
      try {
        const result = await executor(input);
        actions.push({ tool: block.name, input, ok: true, summary: summarize(result) });
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Tool execution failed.";
        actions.push({ tool: block.name, input, ok: false, summary: message });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: message,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  return {
    reply: finalText || "Sorry, I couldn't produce a response just now.",
    actions,
  };
}

/** Trim a tool result down to a short one-line summary for the UI action log. */
function summarize(result: string): string {
  const flat = result.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 137)}…` : flat;
}
