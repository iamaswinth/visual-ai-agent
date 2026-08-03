// Shared Anthropic client + model selection.
//
// Two model tiers by cost/quality:
//   - captions:  high volume, one-liner per screenshot -> cheap/fast Haiku.
//   - reasoning: session summaries + chat answers -> Sonnet for quality.
// Both are env-overridable.

import Anthropic from "@anthropic-ai/sdk";

let client;
export function getAnthropic() {
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN
  return client;
}

export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function captionModel() {
  return process.env.CAPTION_MODEL || "claude-haiku-4-5";
}

export function reasoningModel() {
  return process.env.REASONING_MODEL || "claude-sonnet-5";
}
