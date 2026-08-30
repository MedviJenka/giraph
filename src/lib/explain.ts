// AI semantic explanation for a single blueprint component (PLAN.md §7 Semantic Layer).
// Intentionally a single stateless LLM call — not a multi-agent framework. The task is
// one prompt -> one response grounded in the node and its graph neighborhood; there is no
// role delegation or tool loop that would justify something like CrewAI.

import type { Blueprint, BlueprintNode } from "../types";

export interface ExplainPrompt {
  system: string;
  user: string;
}

/** Build a grounded prompt from the node plus its incoming/outgoing relationships. Pure. */
export function buildExplainPrompt(node: BlueprintNode, blueprint: Blueprint): ExplainPrompt {
  const nameById = new Map(blueprint.nodes.map((n) => [n.id, n.name]));

  const outgoing = blueprint.edges
    .filter((e) => e.source === node.id)
    .map((e) => `${e.relationship} ${nameById.get(e.target) ?? e.target}`);
  const incoming = blueprint.edges
    .filter((e) => e.target === node.id)
    .map((e) => `${nameById.get(e.source) ?? e.source} ${e.relationship} this`);

  const system =
    "You are a software architecture assistant. Explain a single component of a codebase " +
    "blueprint for an engineer. Be concise and concrete. Respond in plain text with exactly " +
    "these sections and nothing else:\n" +
    "Purpose: one sentence.\n" +
    "Responsibilities: 2-4 lines each starting with '- '.\n" +
    "Dependencies: lines starting with '- ' naming what this relies on, or '- none'.";

  const user = [
    `Component: ${node.name}`,
    `Type: ${node.type}`,
    `Path: ${node.path}`,
    `Language: ${node.language}`,
    `Existing description: ${node.description}`,
    outgoing.length
      ? `Outgoing relationships:\n${outgoing.map((x) => `- ${x}`).join("\n")}`
      : "Outgoing relationships: none",
    incoming.length
      ? `Incoming relationships:\n${incoming.map((x) => `- ${x}`).join("\n")}`
      : "Incoming relationships: none",
  ].join("\n");

  return { system, user };
}

export interface ExplainOptions {
  apiKey: string;
  /** OpenAI-compatible chat model id. */
  model?: string;
  /** OpenAI-compatible base URL (override for Azure/OpenRouter/local proxies). */
  baseUrl?: string;
  signal?: AbortSignal;
}

/**
 * Request an explanation from an OpenAI-compatible chat completions endpoint.
 * Runs entirely client-side with a user-supplied key; there is no backend to proxy through.
 */
export async function explainComponent(
  node: BlueprintNode,
  blueprint: Blueprint,
  opts: ExplainOptions,
): Promise<string> {
  const { apiKey, model = "gpt-4o-mini", baseUrl = "https://api.openai.com/v1", signal } = opts;
  if (!apiKey) throw new Error("Missing API key.");

  const { system, user } = buildExplainPrompt(node, blueprint);

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}). ${detail.slice(0, 200)}`.trim());
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Empty response from LLM.");
  }
  return content.trim();
}
