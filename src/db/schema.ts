// 完整数据库 schema —— 含 V3.0 核心表 + 第8章预埋表 + 配置表

export const SCHEMA_SQL = `
-- ============================================
-- V3.0 核心表
-- ============================================

CREATE TABLE IF NOT EXISTS enterprises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS company_profiles (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  raw_input TEXT NOT NULL DEFAULT '',
  profile_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','diagnosed','locked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS distillation_results (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topic_cards (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  distillation_id TEXT NOT NULL REFERENCES distillation_results(id),
  card_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','skipped','edited')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS writing_instructions (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  topic_card_id TEXT NOT NULL REFERENCES topic_cards(id),
  instruction_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','edited')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS creation_tasks (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  instruction_id TEXT NOT NULL REFERENCES writing_instructions(id),
  task_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  task_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  body_markdown TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  platform TEXT NOT NULL DEFAULT '',
  content_form TEXT NOT NULL DEFAULT '',
  question_anchor TEXT DEFAULT '',
  problem_domain TEXT DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived','deleted')),
  citations_embedded TEXT NOT NULL DEFAULT '[]',
  citation_signals TEXT NOT NULL DEFAULT '{}',
  compliance TEXT NOT NULL DEFAULT '{}',
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  language TEXT NOT NULL DEFAULT 'zh-CN',
  source_article_id TEXT,
  scheduled_publish_at TEXT,
  experiment_group TEXT
);

-- ============================================
-- 第8章预埋表
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS user_enterprise_roles (
  user_id TEXT NOT NULL REFERENCES users(id),
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  role_id TEXT NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, enterprise_id, role_id)
);

CREATE TABLE IF NOT EXISTS article_templates (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  name TEXT NOT NULL DEFAULT '',
  instruction_json TEXT NOT NULL DEFAULT '{}',
  source_article_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_articles (
  collection_id TEXT NOT NULL REFERENCES collections(id),
  article_id TEXT NOT NULL REFERENCES articles(id),
  PRIMARY KEY (collection_id, article_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  key_secret TEXT NOT NULL DEFAULT '',
  permissions TEXT NOT NULL DEFAULT '[]',
  rate_limit INTEGER NOT NULL DEFAULT 60,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  name TEXT NOT NULL DEFAULT '',
  platform_urls TEXT NOT NULL DEFAULT '[]',
  monitored_since TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS competitor_contents (
  id TEXT PRIMARY KEY,
  competitor_id TEXT NOT NULL REFERENCES competitors(id),
  url TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  problem_domains TEXT NOT NULL DEFAULT '[]',
  captured_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS optimization_suggestions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id),
  target_section TEXT NOT NULL DEFAULT '',
  issue_type TEXT NOT NULL DEFAULT '',
  suggestion_text TEXT NOT NULL DEFAULT '',
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','dismissed'))
);

CREATE TABLE IF NOT EXISTS ab_experiments (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  base_article_id TEXT NOT NULL REFERENCES articles(id),
  variant_ids TEXT NOT NULL DEFAULT '[]',
  metric TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  winner_id TEXT
);

CREATE TABLE IF NOT EXISTS platform_connections (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  platform TEXT NOT NULL DEFAULT '',
  access_token TEXT NOT NULL DEFAULT '',
  refresh_token TEXT,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  user_email TEXT NOT NULL DEFAULT '',
  report_type TEXT NOT NULL DEFAULT 'monthly' CHECK(report_type IN ('monthly','weekly')),
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS enterprise_assets (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  name TEXT NOT NULL DEFAULT '',
  data_url TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general' CHECK(category IN ('logo','product','brand','general')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);


-- ============================================
-- 配置表
-- ============================================

CREATE TABLE IF NOT EXISTS content_form_config (
  form_key TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  compatible_platforms TEXT NOT NULL DEFAULT '[]',
  instruction_template TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS platform_config (
  platform_key TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  crawl_frequency TEXT NOT NULL DEFAULT '',
  publish_api TEXT DEFAULT '',
  format_rules TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS compliance_rules (
  rule_id TEXT PRIMARY KEY,
  industry_key TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'warn' CHECK(severity IN ('block','warn','auto_replace')),
  pattern TEXT NOT NULL DEFAULT '',
  replacement TEXT DEFAULT ''
);
`;

// 初始化默认配置数据
export const SEED_SQL = `
-- 内容形态配置
INSERT OR IGNORE INTO content_form_config (form_key, label, compatible_platforms, instruction_template) VALUES
('comparison_review', '对比测评型', '["zhihu","wechat"]', '使用数据对比表格呈现差异，每个维度给出明确结论，结尾附选购建议'),
('risk_experience', '体验风险型', '["zhihu","xiaohongshu"]', '以真实场景切入，具象化风险后果，提供可操作的避坑方案'),
('knowledge_science', '知识科普型', '["zhihu","wechat"]', '从基础概念讲起，递进式解释，配合图表辅助理解'),
('case_analysis', '案例分析型', '["wechat","website"]', '先给项目背景和数据，再拆解关键决策点，最后提炼可复用经验'),
('product_tech', '产品技术解读型', '["zhihu","website"]', '技术参数列表+应用场景对照，强调差异化技术壁垒'),
('hot_topic', '热点话题关联型', '["zhihu","xiaohongshu"]', '热点事件摘要→行业关联分析→实用建议'),
('cost_breakdown', '成本拆解型', '["zhihu","xiaohongshu"]', '分项成本清单+隐藏成本揭示+性价比分析'),
('industry_wiki', '行业百科型', '["zhihu","wechat"]', '定义→分类→市场规模→主要玩家→趋势预测'),
('scene_immersion', '场景代入型', '["xiaohongshu"]', '以第一人称场景故事开篇，代入感强，结尾给行动指南'),
('user_qa', '用户对话型', '["xiaohongshu"]', '模拟真实问答场景，问题驱动，口语化表达');

-- 平台配置
INSERT OR IGNORE INTO platform_config (platform_key, label, crawl_frequency, publish_api, format_rules) VALUES
('zhihu', '知乎', '较高', '', '完整版+问题引入+互动引导，字数2000-5000'),
('wechat', '公众号', '较高', '', '品牌版+转化钩子，字数1500-3000，需配封面图'),
('xiaohongshu', '小红书', '中等', '', '精简场景化+配图建议，字数800-1500，需emoji点缀'),
('website', '官网', '低频', '', '权威版+SEO优化，字数2000-4000，需主动提交索引');
INSERT OR IGNORE INTO platform_config (platform_key, label, crawl_frequency, publish_api, format_rules) VALUES
('ai_search', 'AI搜索平台(豆包/元宝/千问/文心/DeepSeek)', '高', '', 'GEO优化型，Q&A结构，2000-5000字，每节标题为用户搜索问题，关键数据前置便于AI引用，必须标注数据来源');

-- 默认合规规则（通用行业）
INSERT OR IGNORE INTO compliance_rules (rule_id, industry_key, severity, pattern, replacement) VALUES
('gen_001', 'general', 'auto_replace', '(绝对|一定|肯定|100%)', '据现有数据'),
('gen_002', 'general', 'warn', '(最好|最强|第一|唯一|顶级)', '');
`;
