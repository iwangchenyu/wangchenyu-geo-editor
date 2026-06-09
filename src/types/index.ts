// === 企业 ===
export interface Enterprise {
  id: string
  name: string
  industry?: string
  created_at: string
  updated_at: string
}

// === 模块一：公司画像 ===
export interface CompanyProfile {
  id: string
  enterprise_id: string
  raw_input: string
  profile_json: ProfileData
  status: 'draft' | 'diagnosed' | 'locked'
  created_at: string
  updated_at: string
}

export interface ProfileData {
  company_name: string
  established?: string
  location?: string
  scale?: string
  industry: string
  sub_sector?: string
  core_business: string
  products_services?: string[]
  application_scenarios?: string[]
  target_customers?: CustomerSegment[]
  differentiators?: string[]
  business_data?: BusinessMetrics
  certifications?: string[]
  diagnosis?: DiagnosisReport
}

export interface CustomerSegment {
  type: string
  persona: string
  pain_points: string[]
}

export interface BusinessMetrics {
  project_count?: number
  customer_count?: number
  coverage?: string
}

export interface DiagnosisReport {
  passed: boolean
  dimensions: DimensionResult[]
  total_coverage: number
  suggestions: string[]
}

export interface DimensionResult {
  dimension: string
  label: string
  required: boolean
  covered: boolean
  score: number
  feedback: string
  guiding_questions?: string[]
}

// === 模块二：蒸馏结果 ===
export interface DistillationResult {
  id: string
  enterprise_id: string
  result_json: DistillationData
  created_at: string
}

export interface DistillationData {
  problem_domains: ProblemDomain[]
  external_signals: ExternalSignals
}

export interface ProblemDomain {
  domain: string
  anchors: QuestionAnchor[]
}

export interface QuestionAnchor {
  id: string
  question: string
  dimension: 'What' | 'Why' | 'How' | 'Which' | 'HowMuch' | 'Risk'
  depth: 'surface' | 'middle' | 'deep' | 'very_deep'
  competition_level: 'blue_ocean' | 'red_ocean' | 'blank'
  reference_signals: ReferenceSignal[]
  content_form_suggestions: string[]
  platform_suggestions: string[]
}

export interface ReferenceSignal {
  type: 'data_point' | 'authority_citation' | 'case_study' | 'step_by_step' | 'comparison' | 'risk_warning'
  description: string
}

export interface ExternalSignals {
  hot_events: any[]
  competitor_coverage: any[]
  last_round_feedback: any
}

// === 模块三：选题卡 ===
export interface TopicCard {
  id: string
  enterprise_id: string
  distillation_id: string
  card_json: TopicCardData
  status: 'pending' | 'confirmed' | 'skipped' | 'edited'
  created_at: string
}

export interface TopicCardData {
  anchor_id: string
  question: string
  competition_level: 'blue_ocean' | 'red_ocean' | 'blank'
  priority: number
  content_form: string
  creative_tone: string
  recommended_platforms: string[]
  title_direction: string
  edited_question?: string
  edited_form?: string
}

// === 模块四：写作指令 ===
export interface WritingInstruction {
  id: string
  enterprise_id: string
  topic_card_id: string
  instruction_json: InstructionData
  status: 'pending' | 'confirmed' | 'edited'
  created_at: string
}

export interface InstructionData {
  body_layer: BodyLayer
  title_layer: TitleLayer
  platform_layer: PlatformLayer
}

export interface BodyLayer {
  paragraph_structure: string[]
  reference_signals: ReferenceSignal[]
  creative_tone: string
  word_count: number
  content_form: string
}

export interface TitleLayer {
  title_templates: string[]
  trigger_words: string[]
  click_triggers: string[]
}

export interface PlatformLayer {
  platform: string
  format_requirements: string
  word_count_range: [number, number]
  special_rules: string[]
}

// === 模块五：创作任务 ===
export interface CreationTask {
  id: string
  enterprise_id: string
  instruction_id: string
  task_json: TaskData
  status: 'pending' | 'in_progress' | 'completed'
  created_at: string
}

export interface TaskData {
  strategy: 'single_deep' | 'cluster' | 'hot_chase' | 'matrix'
  articles: TaskArticle[]
}

export interface TaskArticle {
  id: string
  title_direction: string
  platform: string
  content_form: string
  word_count: number
  status: 'pending' | 'generating' | 'done' | 'failed'
}

// === 模块六/九：文章 ===
export interface Article {
  id: string
  enterprise_id: string
  task_id?: string
  title: string
  body_markdown: string
  word_count: number
  platform: string
  content_form: string
  question_anchor?: string
  problem_domain?: string
  tags: string[]
  version: number
  status: 'draft' | 'published' | 'archived' | 'deleted'
  citations_embedded: CitationRef[]
  citation_signals: CitationSignalStat
  compliance: ComplianceResult
  generated_at: string
  published_at?: string
  modified_at: string
  deleted_at?: string
  language: string
  source_article_id?: string
  scheduled_publish_at?: string
  experiment_group?: string
}

export interface CitationRef {
  type: string
  source: string
  content: string
}

export interface CitationSignalStat {
  data_point: number
  authority_citation: number
  case_study: number
  step_by_step: number
  comparison: number
  risk_warning: number
}

export interface ComplianceResult {
  passed: boolean
  issues: ComplianceIssue[]
}

export interface ComplianceIssue {
  severity: 'block' | 'warn' | 'auto_replace'
  pattern: string
  found: string
  replacement?: string
  resolved: boolean
}

// === 预埋表类型 ===
export interface User {
  id: string
  name: string
  email: string
  created_at: string
}

export interface ArticleTemplate {
  id: string
  enterprise_id: string
  name: string
  instruction_json: InstructionData
  source_article_id?: string
  created_at: string
}

export interface Collection {
  id: string
  enterprise_id: string
  name: string
  description: string
  created_at: string
}

export interface ApiKey {
  id: string
  enterprise_id: string
  key_secret: string
  permissions: string[]
  rate_limit: number
  created_at: string
  expires_at?: string
}

export interface Competitor {
  id: string
  enterprise_id: string
  name: string
  platform_urls: string[]
  monitored_since: string
}

export interface OptimizationSuggestion {
  id: string
  article_id: string
  target_section: string
  issue_type: string
  suggestion_text: string
  generated_at: string
  status: 'pending' | 'applied' | 'dismissed'
}

export interface ABExperiment {
  id: string
  enterprise_id: string
  base_article_id: string
  variant_ids: string[]
  metric: string
  started_at: string
  ended_at?: string
  winner_id?: string
}

export interface PlatformConnection {
  id: string
  enterprise_id: string
  platform: string
  access_token: string
  refresh_token?: string
  expires_at?: string
}

export interface Subscription {
  id: string
  enterprise_id: string
  user_email: string
  report_type: 'monthly' | 'weekly'
  enabled: boolean
}

// === 配置表类型 ===
export interface ContentFormConfig {
  form_key: string
  label: string
  compatible_platforms: string[]
  instruction_template: string
}

export interface PlatformConfig {
  platform_key: string
  label: string
  crawl_frequency: string
  publish_api?: string
  format_rules: string
}

export interface ComplianceRule {
  rule_id: string
  industry_key: string
  severity: 'block' | 'warn' | 'auto_replace'
  pattern: string
  replacement?: string
}
