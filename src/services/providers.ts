export interface AIProvider {
  id: string;
  name: string;
  endpoint: string;
  defaultModel: string;
  models: string[];
}

export const PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o1'],
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    endpoint: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    models: [
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-72B-Instruct',
      'Qwen/Qwen2.5-32B-Instruct',
      'Qwen/Qwen2.5-7B-Instruct',
      'Pro/zai-org/GLM-4.5',
    ],
  },
  {
    id: 'zhipu',
    name: '智谱AI',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    models: ['glm-4-plus', 'glm-4-flash', 'glm-4-air', 'glm-4-long'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    endpoint: 'https://api.hunyuan.cloud.tencent.com/v1',
    defaultModel: 'hunyuan-turbos-latest',
    models: ['hunyuan-turbos-latest', 'hunyuan-lite', 'hunyuan-standard', 'hunyuan-pro'],
  },
  {
    id: 'modelscope',
    name: '魔搭社区',
    endpoint: 'https://api.modelscope.cn/v1',
    defaultModel: 'qwen-plus',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'deepseek-v3'],
  },
  {
    id: 'tianyi',
    name: '天翼云',
    endpoint: 'https://api-ai.cloud.189.cn/v1',
    defaultModel: 'telechat-turbo',
    models: ['telechat-turbo', 'telechat-pro', 'qwen-max', 'deepseek-v3'],
  },
  {
    id: 'baishan',
    name: '白山智算',
    endpoint: 'https://api.baishancloud.com/v1',
    defaultModel: 'deepseek-v3',
    models: ['deepseek-v3', 'deepseek-r1', 'qwen2.5-72b'],
  },
];

// 默认 Key 已移除，用户需自行在设置页配置
export const DEFAULT_KEYS: Record<string, string> = {};
