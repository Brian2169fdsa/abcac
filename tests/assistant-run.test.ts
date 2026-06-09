import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the manual server-side tool-use loop in src/lib/assistant/run.ts.
 *
 * We mock the Anthropic SDK so `new Anthropic()` (via getAnthropicClient) yields
 * a fake client whose `messages.create` is a queue of canned responses. This
 * lets us drive the loop deterministically: one `tool_use` turn followed by an
 * `end_turn` turn, an error path, an unknown-tool path, and the iteration cap.
 */

// A single mock function the fake Anthropic client delegates to. We override its
// implementation per-test via mockImplementation.
const create = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  // The SDK default export is the Anthropic class; `new Anthropic()` must expose
  // `.messages.create`. We also expose it as a named export for type-only imports.
  class Anthropic {
    messages = { create };
  }
  return { default: Anthropic };
});

import { runAssistant, type AssistantTool, type ToolExecutor } from "@/lib/assistant/run";

const tools: AssistantTool[] = [
  {
    name: "echo",
    description: "echo the input back",
    input_schema: { type: "object", properties: { value: { type: "string" } } },
  },
];

/** Build a fake Anthropic message response. */
function msg(opts: {
  stop_reason: string;
  text?: string;
  toolUse?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
}) {
  const content: unknown[] = [];
  if (opts.text) content.push({ type: "text", text: opts.text });
  for (const t of opts.toolUse ?? []) {
    content.push({ type: "tool_use", id: t.id, name: t.name, input: t.input });
  }
  return { stop_reason: opts.stop_reason, content };
}

beforeEach(() => {
  create.mockReset();
});

describe("runAssistant tool-use loop", () => {
  it("executes a tool, appends a matching tool_result, then returns the final reply + actions", async () => {
    create
      .mockResolvedValueOnce(
        msg({
          stop_reason: "tool_use",
          toolUse: [{ id: "tu_1", name: "echo", input: { value: "hi" } }],
        }),
      )
      .mockResolvedValueOnce(msg({ stop_reason: "end_turn", text: "All done." }));

    const executor = vi.fn<ToolExecutor>().mockResolvedValue("echoed: hi");
    const executors: Record<string, ToolExecutor> = { echo: executor };

    const result = await runAssistant({
      system: "sys",
      messages: [{ role: "user", content: "go" }],
      tools,
      executors,
    });

    // The executor ran with the parsed tool input.
    expect(executor).toHaveBeenCalledWith({ value: "hi" });

    // The final visible reply is the text from the end_turn turn.
    expect(result.reply).toBe("All done.");

    // The action log records one successful tool call.
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      tool: "echo",
      ok: true,
      summary: "echoed: hi",
    });

    // Two upstream calls: the tool_use turn, then the follow-up turn.
    expect(create).toHaveBeenCalledTimes(2);

    // The SECOND call must carry the assistant turn + a user tool_result whose
    // tool_use_id matches the original tool_use block id.
    const secondCallMessages = create.mock.calls[1][0].messages as Array<{
      role: string;
      content: unknown;
    }>;
    const toolResultTurn = secondCallMessages.find(
      (m) => m.role === "user" && Array.isArray(m.content),
    );
    expect(toolResultTurn).toBeTruthy();
    const block = (toolResultTurn!.content as Array<Record<string, unknown>>)[0];
    expect(block.type).toBe("tool_result");
    expect(block.tool_use_id).toBe("tu_1");
    expect(block.content).toBe("echoed: hi");
    expect(block.is_error).toBeUndefined();
  });

  it("does not mutate the caller's messages array", async () => {
    create
      .mockResolvedValueOnce(
        msg({ stop_reason: "tool_use", toolUse: [{ id: "tu_1", name: "echo", input: {} }] }),
      )
      .mockResolvedValueOnce(msg({ stop_reason: "end_turn", text: "ok" }));
    const original = [{ role: "user" as const, content: "go" }];
    await runAssistant({
      system: "sys",
      messages: original,
      tools,
      executors: { echo: vi.fn<ToolExecutor>().mockResolvedValue("r") },
    });
    expect(original).toHaveLength(1);
  });

  it("returns immediately on end_turn with no tool calls", async () => {
    create.mockResolvedValueOnce(msg({ stop_reason: "end_turn", text: "just text" }));
    const result = await runAssistant({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      tools,
      executors: {},
    });
    expect(result.reply).toBe("just text");
    expect(result.actions).toEqual([]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("records an is_error tool_result when the executor throws", async () => {
    create
      .mockResolvedValueOnce(
        msg({ stop_reason: "tool_use", toolUse: [{ id: "tu_err", name: "echo", input: {} }] }),
      )
      .mockResolvedValueOnce(msg({ stop_reason: "end_turn", text: "handled" }));

    const executors: Record<string, ToolExecutor> = {
      echo: vi.fn<ToolExecutor>().mockRejectedValue(new Error("boom")),
    };

    const result = await runAssistant({
      system: "sys",
      messages: [{ role: "user", content: "go" }],
      tools,
      executors,
    });

    expect(result.actions[0]).toMatchObject({ tool: "echo", ok: false, summary: "boom" });
    const secondCallMessages = create.mock.calls[1][0].messages as Array<{
      role: string;
      content: unknown;
    }>;
    const block = (
      secondCallMessages.find((m) => m.role === "user" && Array.isArray(m.content))!
        .content as Array<Record<string, unknown>>
    )[0];
    expect(block.is_error).toBe(true);
    expect(block.content).toBe("boom");
  });

  it("flags an unknown tool with an is_error result and does not call any executor", async () => {
    create
      .mockResolvedValueOnce(
        msg({ stop_reason: "tool_use", toolUse: [{ id: "tu_x", name: "nope", input: {} }] }),
      )
      .mockResolvedValueOnce(msg({ stop_reason: "end_turn", text: "ok" }));

    const result = await runAssistant({
      system: "sys",
      messages: [{ role: "user", content: "go" }],
      tools,
      executors: {},
    });
    expect(result.actions[0]).toMatchObject({ tool: "nope", ok: false });
    expect(result.actions[0].summary).toMatch(/unknown tool/i);
  });

  it("stops at the max-iteration cap when the model never ends the turn", async () => {
    // Always return tool_use so the loop would run forever without the cap.
    create.mockResolvedValue(
      msg({ stop_reason: "tool_use", toolUse: [{ id: "tu_loop", name: "echo", input: {} }] }),
    );
    const executor = vi.fn<ToolExecutor>().mockResolvedValue("again");

    const result = await runAssistant({
      system: "sys",
      messages: [{ role: "user", content: "go" }],
      tools,
      executors: { echo: executor },
    });

    // MAX_ITERATIONS in run.ts is 12.
    expect(create).toHaveBeenCalledTimes(12);
    expect(executor).toHaveBeenCalledTimes(12);
    // No text turn was ever produced → fallback reply.
    expect(result.reply).toMatch(/couldn't produce a response/i);
  });

  it("falls back to a default reply when no text is produced", async () => {
    create.mockResolvedValueOnce(msg({ stop_reason: "end_turn" }));
    const result = await runAssistant({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      tools,
      executors: {},
    });
    expect(result.reply).toMatch(/couldn't produce a response/i);
  });
});
