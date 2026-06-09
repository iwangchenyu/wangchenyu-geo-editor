// 平台中文名
export const PLATFORM_LABELS: Record<string, string> = {
  zhihu: '知乎',
  wechat: '公众号',
  xiaohongshu: '小红书',
  website: '官网',
  ai_search: 'AI搜索',
};

// 内容形态中文名
export const CONTENT_FORM_LABELS: Record<string, string> = {
  knowledge_science: '知识科普',
  comparison_review: '对比测评',
  case_analysis: '案例分析',
  scene_immersion: '场景代入',
  product_tech: '产品技术',
  hot_topic: '热点话题',
  cost_breakdown: '成本拆解',
  industry_wiki: '行业百科',
  user_qa: '用户问答',
  risk_experience: '体验风险',
};

// 文章状态中文名
export const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
  deleted: '已删除',
};

export function platformLabel(key: string): string {
  return PLATFORM_LABELS[key] || key;
}

export function contentFormLabel(key: string): string {
  return CONTENT_FORM_LABELS[key] || key || '未分类';
}

export function statusLabel(key: string): string {
  return STATUS_LABELS[key] || key;
}
