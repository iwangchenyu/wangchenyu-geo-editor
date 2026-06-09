import { PROVIDERS, DEFAULT_KEYS, type AIProvider } from './providers';

const STORAGE_PREFIX = 'ai_editor_provider_';
const ACTIVE_PROVIDER_KEY = 'ai_editor_active_provider';

export function getProviders(): AIProvider[] { return PROVIDERS; }
export function getProvider(id: string): AIProvider | undefined { return PROVIDERS.find(p => p.id === id); }
export function getApiKey(providerId: string): string { return localStorage.getItem(STORAGE_PREFIX + providerId) || DEFAULT_KEYS[providerId] || ''; }
export function setApiKey(providerId: string, key: string) { localStorage.setItem(STORAGE_PREFIX + providerId, key); }
export function getActiveProviderId(): string { return localStorage.getItem(ACTIVE_PROVIDER_KEY) || 'deepseek'; }
export function setActiveProviderId(id: string) { localStorage.setItem(ACTIVE_PROVIDER_KEY, id); }
export function getActiveProvider(): AIProvider { return getProvider(getActiveProviderId()) || PROVIDERS[0]; }
export function hasApiKey(providerId?: string): boolean { return !!getApiKey(providerId || getActiveProviderId()); }

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

// 按优先级排序的接口列表：当前激活的排第一，其余按顺序
function getFallbackOrder(): AIProvider[] {
  const activeId = getActiveProviderId();
  const active = PROVIDERS.find(p => p.id === activeId);
  const others = PROVIDERS.filter(p => p.id !== activeId && getApiKey(p.id));
  return active ? [active, ...others] : others;
}

// 尝试用单个 provider 调用（60s 超时）
async function tryProvider(provider: AIProvider, messages: ChatMessage[], options?: ChatOptions): Promise<string> {
  const apiKey = getApiKey(provider.id);
  if (!apiKey) throw new Error(`${provider.name}: 未配置 Key`);

  const body: any = {
    model: provider.defaultModel,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.max_tokens ?? 4096,
  };
  if (options?.response_format) {
    body.response_format = options.response_format;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);

  try {
    const res = await fetch(`${provider.endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${provider.name}: ${res.status} ${err.slice(0, 120)}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timer);
  }
}

// 带自动切换的调用
export async function chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
  const providers = getFallbackOrder();
  if (providers.length === 0) throw new Error('没有可用的 API 接口，请先在右上角配置 API Key');

  const errors: string[] = [];

  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    try {
      const result = await tryProvider(p, messages, options);
      // 如果切换了接口，更新激活状态
      if (i > 0) {
        setActiveProviderId(p.id);
        console.log(`🔄 自动切换到 ${p.name}`);
      }
      return result;
    } catch (e: any) {
      errors.push(e.message);
      // 如果是 JSON format 不支持或不识别，去掉后重试同一个 provider
      const isFormatErr = options?.response_format && (
        e.message?.includes('response_format') ||
        e.message?.includes('json_object') ||
        e.message?.includes('400')
      );
      if (isFormatErr) {
        try {
          const result = await tryProvider(p, messages, { ...options, response_format: undefined });
          if (i > 0) setActiveProviderId(p.id);
          return result;
        } catch (e2: any) {
          errors[errors.length - 1] += ' (JSON模式不支持，已回退)';
        }
      }
    }
  }

  throw new Error(`所有接口调用失败:\n${errors.map(e => `  • ${e}`).join('\n')}`);
}

export async function chatWithJSON<T>(messages: ChatMessage[], options?: { temperature?: number }): Promise<T> {
  // 给 system prompt 追加 JSON 输出指令，避免依赖 response_format（DeepSeek 等平台有限制）
  const msgs = messages.map((m, i) => {
    if (m.role === 'system' && i === 0) {
      return { ...m, content: m.content + '\n\n请严格输出JSON格式，不要包裹在markdown代码块中。' };
    }
    return m;
  });
  const text = await chat(msgs, { ...options, temperature: options?.temperature ?? 0.7, max_tokens: 8192 });
  let cleaned = text.trim();
  // 处理可能的 markdown 包裹
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  // 尝试找到第一个 { 或 [ 开始解析
  const jsonStart = Math.min(
    cleaned.indexOf('{') === -1 ? Infinity : cleaned.indexOf('{'),
    cleaned.indexOf('[') === -1 ? Infinity : cleaned.indexOf('[')
  );
  if (jsonStart !== Infinity && jsonStart > 0) {
    cleaned = cleaned.slice(jsonStart);
  }
  return JSON.parse(cleaned) as T;
}
