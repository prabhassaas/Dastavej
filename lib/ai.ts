/**
 * Bring-your-own-AI client. Talks to any OpenAI-compatible chat endpoint, so
 * the app stays free and serverless: point it at open-source models running
 * locally (Ollama, LM Studio, llama.cpp) for truly unlimited use, or at a
 * hosted provider's free tier (Groq, OpenRouter…). The endpoint URL, key and
 * model live in localStorage on the user's device only.
 */

export interface AiSettings {
  /** base URL ending in /v1, e.g. http://localhost:11434/v1 */
  endpoint: string;
  /** optional bearer token (not needed for local Ollama) */
  apiKey: string;
  /** model name, e.g. llama3.1, qwen2.5:14b, llama-3.3-70b-versatile */
  model: string;
}

const STORAGE_KEY = 'dastavej-ai-settings';

export const AI_PRESETS: { name: string; endpoint: string; note: string }[] = [
  {
    name: 'Ollama (local, unlimited)',
    endpoint: 'http://localhost:11434/v1',
    note: 'Install from ollama.com, run `ollama pull llama3.1` — free forever, fully private.',
  },
  {
    name: 'LM Studio (local)',
    endpoint: 'http://localhost:1234/v1',
    note: 'Start the local server in LM Studio.',
  },
  {
    name: 'Groq (hosted free tier)',
    endpoint: 'https://api.groq.com/openai/v1',
    note: 'Fast open-source models (Llama 3.x); needs a free API key.',
  },
  {
    name: 'OpenRouter (hosted)',
    endpoint: 'https://openrouter.ai/api/v1',
    note: 'Many open models, some free; needs an API key.',
  },
];

export function loadAiSettings(): AiSettings {
  const defaults: AiSettings = { endpoint: '', apiKey: '', model: '' };
  if (typeof window === 'undefined') return defaults;
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** One non-streaming chat completion. Throws with a readable message. */
export async function aiChat(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const s = loadAiSettings();
  if (!s.endpoint || !s.model) {
    throw new Error('Configure an AI endpoint and model first (AI tab → Provider settings).');
  }
  const res = await fetch(`${s.endpoint.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(s.apiKey ? { Authorization: `Bearer ${s.apiKey}` } : {}),
    },
    body: JSON.stringify({ model: s.model, messages, stream: false }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`AI endpoint returned ${res.status}: ${body}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('AI endpoint returned no content.');
  return content;
}

/** Extract a JSON object from a model reply that may be fenced or chatty. */
export function parseJsonReply(reply: string): Record<string, unknown> {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : reply;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The AI reply did not contain JSON.');
  return JSON.parse(candidate.slice(start, end + 1));
}
