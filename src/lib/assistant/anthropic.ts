import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic client factory + configuration gate for the ABCAC conversational
 * assistant.
 *
 * GRACEFUL DEGRADATION: nothing here reads the key at module load. The route
 * calls `isAssistantConfigured()` first and returns a 503
 * `{ error: "assistant_not_configured" }` when `ANTHROPIC_API_KEY` is unset, so
 * `npm run build` passes with NO env vars and the chat widget shows a friendly
 * "AI assistant isn't enabled yet" message instead of erroring.
 */

/** The model + request surface the assistant always uses. */
export const ASSISTANT_MODEL = "claude-opus-4-8";
export const ASSISTANT_MAX_TOKENS = 8000;

/** True only when the API key is present in the environment. */
export function isAssistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Construct the Anthropic client. The SDK reads `ANTHROPIC_API_KEY` from the
 * environment. Callers MUST gate on `isAssistantConfigured()` first.
 */
export function getAnthropicClient(): Anthropic {
  return new Anthropic();
}
