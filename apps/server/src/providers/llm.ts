import { store } from '../store.js';
import { extractJson } from '../util.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  text: string;
  provider: string;
  model: string;
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms = 90_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function openaiChat(messages: ChatMessage[], json: boolean): Promise<ChatResult> {
  const settings = store.settings().providers.openai;
  if (!settings.apiKey) throw new ProviderError('OpenAI API key belum diisi / OpenAI API key is not set.');
  const response = await withTimeout((signal) =>
    fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.chatModel,
        messages,
        temperature: 0.8,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    }),
  );
  if (!response.ok) {
    throw new ProviderError(`OpenAI chat failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return { text: payload.choices?.[0]?.message?.content ?? '', provider: 'openai', model: settings.chatModel };
}

async function anthropicChat(messages: ChatMessage[]): Promise<ChatResult> {
  const settings = store.settings().providers.anthropic;
  if (!settings.apiKey) throw new ProviderError('Anthropic API key belum diisi / Anthropic API key is not set.');
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system');
  const response = await withTimeout((signal) =>
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: settings.model, system, max_tokens: 4096, messages: rest }),
    }),
  );
  if (!response.ok) {
    throw new ProviderError(`Anthropic request failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }
  const payload = (await response.json()) as { content?: { text?: string }[] };
  return { text: payload.content?.map((part) => part.text ?? '').join('') ?? '', provider: 'anthropic', model: settings.model };
}

async function geminiChat(messages: ChatMessage[]): Promise<ChatResult> {
  const settings = store.settings().providers.gemini;
  if (!settings.apiKey) throw new ProviderError('Gemini API key belum diisi / Gemini API key is not set.');
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const response = await withTimeout((signal) =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${encodeURIComponent(settings.apiKey)}`,
      {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents, systemInstruction: system ? { parts: [{ text: system }] } : undefined }),
      },
    ),
  );
  if (!response.ok) {
    throw new ProviderError(`Gemini request failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }
  const payload = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return { text, provider: 'gemini', model: settings.model };
}

async function ollamaChat(messages: ChatMessage[], json: boolean): Promise<ChatResult> {
  const settings = store.settings().providers.ollama;
  const response = await withTimeout(
    (signal) =>
      fetch(`${settings.baseUrl.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: settings.model, messages, stream: false, ...(json ? { format: 'json' } : {}) }),
      }),
    120_000,
  );
  if (!response.ok) {
    throw new ProviderError(`Ollama request failed (${response.status}). Pastikan Ollama berjalan.`);
  }
  const payload = (await response.json()) as { message?: { content?: string } };
  return { text: payload.message?.content ?? '', provider: 'ollama', model: settings.model };
}

export function activeLlmProvider(): string {
  return store.settings().providers.llm;
}

/**
 * Runs a chat completion against the configured provider. Returns `null` when the
 * app is in demo mode (or the provider is unavailable) so callers can fall back
 * to deterministic local content.
 */
export async function chat(messages: ChatMessage[], options: { json?: boolean } = {}): Promise<ChatResult | null> {
  const provider = store.settings().providers.llm;
  if (provider === 'demo') return null;
  const json = options.json ?? false;
  try {
    if (provider === 'openai') return await openaiChat(messages, json);
    if (provider === 'anthropic') return await anthropicChat(messages);
    if (provider === 'gemini') return await geminiChat(messages);
    if (provider === 'ollama') return await ollamaChat(messages, json);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(error instanceof Error ? error.message : 'Unknown provider failure');
  }
  return null;
}

/** Ask the model for JSON, falling back to deterministic content on any failure. */
export async function chatJson<T>(messages: ChatMessage[]): Promise<{ data: T; source: 'provider' | 'demo'; model?: string } | null> {
  const result = await chat(messages, { json: true });
  if (!result) return null;
  const parsed = extractJson<T>(result.text);
  if (!parsed) return null;
  return { data: parsed, source: 'provider', model: result.model };
}
