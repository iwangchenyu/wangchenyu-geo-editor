import React, { useState, useEffect } from 'react';
import { Search, Sparkles, RotateCcw, Check, ChevronRight, AlertTriangle, Loader2, Gauge, Target, FileText, Shield, BookOpen, ArrowRight, Eye, EyeOff, Copy, CopyCheck } from 'lucide-react';
import { useEnterprise } from '../../store/enterprise';
import { queryAll, execute, persistDatabase, generateId } from '../../db';
import { chatWithJSON, hasApiKey } from '../../services/ai';
import type { Article, OptimizationSuggestion } from '../../types';
import { markdownToHtml } from '../../utils/markdown';
import { platformLabel, contentFormLabel } from '../../utils/labels';

interface AIAnalysis {
  overall: {
    score: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
  };
  structure: { score: number; issues: string[] };
  data_density: { score: number; issues: string[]; citation_count: number };
  readability: { score: number; issues: string[]; grade_level: string };
  compliance: { score: number; issues: string[] };
  sections: SectionSuggestion[];
  title_alternatives: string[];
}

interface SectionSuggestion {
  heading: string;
  original: string;
  issue: string;
  suggestion: string;
  rewritten: string;
  applied: boolean;
}

export default function ArticleOptimizer() {
  const { currentEnterprise } = useEnterprise();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selected, setSelected] = useState<Article | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!currentEnterprise) return;
    const arts = queryAll<Article>(
      'SELECT * FROM articles WHERE enterprise_id=? AND status!=? ORDER BY generated_at DESC',
      [currentEnterprise.id, 'deleted']
    );
    for (const a of arts) {
      if (typeof a.tags === 'string') try { a.tags = JSON.parse(a.tags); } catch {}
      if (typeof a.citation_signals === 'string') try { a.citation_signals = JSON.parse(a.citation_signals); } catch {}
      if (typeof a.compliance === 'string') try { a.compliance = JSON.parse(a.compliance); } catch {}
    }
    setArticles(arts);
  }, [currentEnterprise]);

  const runAnalysis = async () => {
    if (!selected || !hasApiKey()) { setError('请先配置 API Key'); return; }
    setAnalyzing(true); setError(''); setAnalysis(null);
    try {
      const body = selected.body_markdown;
      const sig = selected.citation_signals || {};
      const comp = selected.compliance || {};
      const artExcerpt = body.slice(0, 3000);

      const systemMsg = `你是资深内容策略分析师。分析文章并从以下维度输出JSON（不要markdown包裹）：
{
  "overall": {"score":0-100,"summary":"一句话总结","strengths":["优势"],"weaknesses":["不足"]},
  "structure": {"score":0-100,"issues":["问题"]},
  "data_density": {"score":0-100,"issues":["问题"],"citation_count":0},
  "readability": {"score":0-100,"issues":["问题"],"grade_level":"等级"},
  "compliance": {"score":0-100,"issues":["问题"]},
  "sections": [{"heading":"章节标题（对应文章中的##标题）","original":"原文段落前100字（必须从原文逐字复制，用于精确定位替换）","issue":"具体问题","suggestion":"改进方向","rewritten":"改写后段落200-400字"}],
  "title_alternatives": ["备选标题1","备选标题2","备选标题3"]
}
规则：
- sections只列3-5个需改进段落
- original必须从原文逐字复制（用于精确查找替换位置），不少于50字
- rewrite保留核心信息改进表达，200-400字
- 标题含2026长尾关键词
- 评分真实不虚高。`;

      const userMsg = `文章标题：${selected.title}
平台：${selected.platform}，字数：${selected.word_count}
引用信号：${JSON.stringify(sig)}
合规状态：${JSON.stringify(comp)}

文章内容：
${artExcerpt}

请分析。`;

      const result = await chatWithJSON<AIAnalysis>(
        [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }],
        { temperature: 0.4 }
      );
      setAnalysis(result);
    } catch (e: any) {
      setError('分析失败: ' + e.message);
    }
    setAnalyzing(false);
  };

  const applySection = async (idx: number) => {
    if (!selected || !analysis || !currentEnterprise) return;
    setApplyingIdx(idx); setError('');
    const sec = analysis.sections[idx];
    let body = selected.body_markdown;
    let replaced = false;

    // 策略1: 用 original 精确替换
    if (body.includes(sec.original)) {
      body = body.replace(sec.original, sec.rewritten);
      replaced = true;
    } else {
      // 策略2: 用 heading 定位 —— 找到对应标题，替换该标题下的内容直到下一个标题或文章末尾
      const heading = sec.heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const hPat = new RegExp(`(^#{1,3}\\s*${heading}\\s*\\n)([\\s\\S]*?)(?=\\n#{1,3}\\s|$)`, 'im');
      if (hPat.test(body)) {
        body = body.replace(hPat, `$1\\n${sec.rewritten}\\n`);
        replaced = true;
      } else {
        // 策略3: 模糊匹配 —— 取 original 前30字做包含搜索
        const short = sec.original.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const fuzzyPat = new RegExp(`(${short}[\\s\\S]{0,500}?)`, 'g');
        if (fuzzyPat.test(body)) {
          body = body.replace(fuzzyPat, sec.rewritten);
          replaced = true;
        }
      }
    }

    if (!replaced) {
      setError(`无法定位原文段落「${sec.heading}」，已跳过。请确认AI返回的original与原文完全一致。`);
      setApplyingIdx(null);
      return;
    }

    try {
      execute(
        'UPDATE articles SET body_markdown=?, word_count=?, modified_at=? WHERE id=?',
        [body, body.length, new Date().toISOString(), selected.id]
      );
      await persistDatabase();
      setSelected({ ...selected, body_markdown: body, word_count: body.length });
      setAnalysis({
        ...analysis,
        sections: analysis.sections.map((s, i) => i === idx ? { ...s, applied: true } : s),
      });
    } catch (e: any) {
      setError('保存失败: ' + e.message);
    }
    setApplyingIdx(null);
  };

  const filtered = articles.filter(a =>
    !search || a.title.includes(search) || a.platform.includes(search) || (a.content_form && a.content_form.includes(search))
  );

  if (!currentEnterprise) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4"><Sparkles size={28} className="text-gray-300" /></div>
        <p className="text-base font-medium text-gray-400 mb-1">尚未选择企业</p><p className="text-sm text-gray-300">请先在上方选择企业</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto flex gap-5 h-[calc(100vh-140px)]">
      {/* Left: Article list */}
      <div className="w-72 shrink-0 card flex flex-col">
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-2 text-[13px] border border-gray-200 rounded-lg outline-none focus:border-indigo-400"
              placeholder="搜索文章..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">暂无文章</p>
          ) : (
            filtered.map(a => (
              <button
                key={a.id}
                onClick={() => { setSelected(a); setAnalysis(null); setError(''); setShowOriginal({}); }}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition-colors ${
                  selected?.id === a.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : 'hover:bg-gray-50'
                }`}
              >
                <p className="text-[12px] font-medium text-gray-900 truncate">{a.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-gray-400">{platformLabel(a.platform)}</span>
                  <span className="text-[10px] text-gray-300">·</span>
                  <span className="text-[10px] text-gray-400">{a.word_count}字</span>
                  <span className="text-[10px] text-gray-300">·</span>
                  <span className="text-[10px] text-gray-400">{a.status === 'published' ? '已发布' : a.status === 'draft' ? '草稿' : a.status}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: Analysis */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {!selected ? (
          <div className="card p-12 text-center">
            <Target size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-400 mb-1">选择一篇文章开始优化</p>
            <p className="text-xs text-gray-300">AI 将从结构、数据、可读性、合规四个维度诊断并给出改写建议</p>
          </div>
        ) : (
          <>
            {/* Article header */}
            <div className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">{selected.title}</h2>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{platformLabel(selected.platform)}</span><span>·</span>
                    <span>{contentFormLabel(selected.content_form)}</span><span>·</span>
                    <span>{selected.word_count}字</span>
                    {selected.citation_signals && (
                      <>
                        <span>·</span>
                        <span>信号{(selected.citation_signals as any).data_point || 0}项</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={runAnalysis}
                  disabled={analyzing || !hasApiKey()}
                  className="btn-base btn-primary text-xs"
                >
                  {analyzing ? <><Loader2 size={13} className="animate-spin" />分析中...</> : <><Sparkles size={13} />AI 诊断</>}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12} />{error}</p>}
            </div>

            {/* Score cards */}
            {analysis && (
              <>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: '综合', score: analysis.overall.score, icon: Gauge, color: 'indigo' },
                    { label: '结构', score: analysis.structure.score, icon: BookOpen, color: 'blue' },
                    { label: '数据', score: analysis.data_density.score, icon: Target, color: 'emerald' },
                    { label: '可读', score: analysis.readability.score, icon: FileText, color: 'amber' },
                    { label: '合规', score: analysis.compliance.score, icon: Shield, color: 'red' },
                  ].map(item => (
                    <div key={item.label} className="card p-3 text-center">
                      <item.icon size={16} className={`mx-auto mb-1 text-${item.color}-500`} />
                      <div className={`text-xl font-bold text-${item.color}-600`}>{item.score}</div>
                      <div className="text-[10px] text-gray-400">{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${analysis.overall.score >= 70 ? 'bg-emerald-100 text-emerald-600' : analysis.overall.score >= 50 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                      <Gauge size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{analysis.overall.summary}</p>
                      <div className="flex gap-4 mt-2">
                        <div className="flex-1">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">优势</p>
                          {analysis.overall.strengths.map((s, i) => (
                            <p key={i} className="text-xs text-emerald-600 flex items-center gap-1"><Check size={10} />{s}</p>
                          ))}
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">待改进</p>
                          {analysis.overall.weaknesses.map((w, i) => (
                            <p key={i} className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle size={10} />{w}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Title alternatives */}
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-500" />标题优化建议
                  </h3>
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-400 mb-1">当前标题：<span className="text-gray-600">{selected.title}</span></p>
                    {analysis.title_alternatives.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-indigo-50 transition-colors group">
                        <span className="text-[10px] text-gray-400 w-4">#{i + 1}</span>
                        <span className="flex-1 text-[13px] text-gray-700">{t}</span>
                        <button
                          onClick={() => {
                            const newTitle = t;
                            execute('UPDATE articles SET title=?, modified_at=? WHERE id=?', [newTitle, new Date().toISOString(), selected.id]);
                            persistDatabase();
                            setSelected({ ...selected, title: newTitle });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-[11px] text-indigo-600 hover:bg-indigo-100 px-2 py-0.5 rounded transition-all"
                        >
                          采用
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section suggestions */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <FileText size={14} className="text-indigo-500" />段落优化 ({analysis.sections.length}处)
                  </h3>
                  {analysis.sections.map((sec, idx) => (
                    <div key={idx} className={`card p-4 transition-all ${sec.applied ? 'border-emerald-300 bg-emerald-50/50' : ''}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="badge badge-blue text-[10px]">{sec.heading}</span>
                          <span className="text-xs text-gray-400">{sec.issue}</span>
                        </div>
                        {sec.applied ? (
                          <span className="badge badge-green text-[10px] flex items-center gap-1"><Check size={10} />已应用</span>
                        ) : (
                          <button
                            onClick={() => applySection(idx)}
                            disabled={applyingIdx === idx}
                            className="btn-base btn-primary text-[10px] py-1 px-2.5"
                          >
                            {applyingIdx === idx ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                            应用此改写
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 mt-3">
                        {/* Original */}
                        <div>
                          <button
                            onClick={() => setShowOriginal(p => ({ ...p, [idx]: !p[idx] }))}
                            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 mb-1"
                          >
                            {showOriginal[idx] ? <EyeOff size={11} /> : <Eye size={11} />}
                            {showOriginal[idx] ? '收起原文' : '查看原文'}
                          </button>
                          {showOriginal[idx] && (
                            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5 border border-gray-100 max-h-24 overflow-y-auto leading-relaxed">
                              {sec.original}
                            </div>
                          )}
                        </div>

                        {/* Suggestion */}
                        <div className="flex items-start gap-2">
                          <ArrowRight size={12} className="text-indigo-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-gray-500">{sec.suggestion}</p>
                        </div>

                        {/* Rewritten preview */}
                        <div className="bg-indigo-50/50 rounded-lg p-3 border border-indigo-100">
                          <p className="text-[10px] text-indigo-400 uppercase tracking-wider mb-1">改写预览</p>
                          <div className="text-[13px] text-gray-800 leading-relaxed richtext-content"
                            dangerouslySetInnerHTML={{ __html: markdownToHtml(sec.rewritten) }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!analysis && !analyzing && (
              <div className="card p-8 text-center">
                <Gauge size={32} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">点击「AI 诊断」开始分析这篇文章</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
