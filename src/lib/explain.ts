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

/**
 * Build a grounded prompt describing the whole architecture: the component inventory
 * grouped by type plus the resolved relationship list. Pure.
 */
export function buildArchitecturePrompt(blueprint: Blueprint): ExplainPrompt {
  const nameById = new Map(blueprint.nodes.map((n) => [n.id, n.name]));

  const byType = new Map<string, string[]>();
  for (const n of blueprint.nodes) {
    const bucket = byType.get(n.type) ?? [];
    bucket.push(n.name);
    byType.set(n.type, bucket);
  }
  const inventory = [...byType.entries()]
    .map(([type, names]) => `- ${type} (${names.length}): ${names.join(", ")}`)
    .join("\n");

  const relationships = blueprint.edges
    .map((e) => `- ${nameById.get(e.source) ?? e.source} ${e.relationship} ${nameById.get(e.target) ?? e.target}`)
    .join("\n");

  const system =
    "You are a software architecture assistant. Explain the overall architecture of a codebase " +
    "from its component blueprint for an engineer. Be concise and concrete. Respond in plain text " +
    "with exactly these sections and nothing else:\n" +
    "Overview: 1-2 sentences on what the system is and its overall shape.\n" +
    "Layers: lines starting with '- ' naming the main layers or groupings.\n" +
    "Data flow: 2-5 lines starting with '- ' tracing the key paths through the system.\n" +
    "Key components: lines starting with '- ' naming the most important components and their role.\n" +
    "External dependencies: lines starting with '- ' naming external systems, or '- none'.";

  const user = [
    `Components (${blueprint.nodes.length} total):`,
    inventory || "- none",
    "",
    relationships ? `Relationships:\n${relationships}` : "Relationships: none",
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
 * Send a prompt to an OpenAI-compatible chat completions endpoint and return the text.
 * Runs entirely client-side with a user-supplied key; there is no backend to proxy through.
 */
async function requestChat(prompt: ExplainPrompt, opts: ExplainOptions): Promise<string> {
  const { apiKey, model = "gpt-4o-mini", baseUrl = "https://api.openai.com/v1", signal } = opts;
  if (!apiKey) throw new Error("Missing API key.");

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
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
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

/** Explain a single component grounded in its graph neighborhood. */
export function explainComponent(
  node: BlueprintNode,
  blueprint: Blueprint,
  opts: ExplainOptions,
): Promise<string> {
  return requestChat(buildExplainPrompt(node, blueprint), opts);
}

/** Explain the whole architecture grounded in the component inventory and relationships. */
export function explainArchitecture(blueprint: Blueprint, opts: ExplainOptions): Promise<string> {
  return requestChat(buildArchitecturePrompt(blueprint), opts);
}
