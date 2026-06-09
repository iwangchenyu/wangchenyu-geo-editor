import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Check, Plus, Zap, PenLine, FileText, Sparkles, AlertTriangle, BarChart3, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useEnterprise } from '../store/enterprise';
import { queryAll, queryOne, generateId, execute, persistDatabase } from '../db';
import { chat, chatWithJSON, hasApiKey } from '../services/ai';
import CompanyProfile from './Module1/CompanyProfile';
import Distillation from './Module2/Distillation';
import TopicCards from './Module3/TopicCards';
import InstructionPreview from './Module4/InstructionPreview';
import TaskConfirm from './Module5/TaskConfirm';
import BatchCreate from './Module6/BatchCreate';
import type { TopicCard, WritingInstruction, InstructionData, Article, CompanyProfile as CP, CitationSignalStat, ComplianceResult } from '../types';
import { platformLabel, contentFormLabel } from '../utils/labels';

type Step = 1|2|3|4|5|6;
const STEPS: { k: Step; l: string }[] = [
  { k:1, l:'公司画像' },{ k:2, l:'AI蒸馏' },{ k:3, l:'选题确认' },
  { k:4, l:'指令预览' },{ k:5, l:'任务确认' },{ k:6, l:'批量创作' }
];

type Mode = 'strategy' | 'daily';

const sigFn = (text:string):CitationSignalStat => ({data_point:(text.match(/数据|统计|据|%|\d+%/g)||[]).length,authority_citation:(text.match(/据.*研究|据.*报告|.*认证|.*专利/g)||[]).length,case_study:(text.match(/案例|项目|实例|客户/g)||[]).length,step_by_step:(text.match(/步骤|第一步|第二步|首先.*然后/g)||[]).length,comparison:(text.match(/对比|相比|vs|VS|优于/g)||[]).length,risk_warning:(text.match(/风险|注意|避免|防止|隐患/g)||[]).length});

const compFn = (text:string):ComplianceResult => { const rules=[{p:/(绝对|一定|肯定|100%)/g,r:'据现有数据',s:'auto_replace' as const},{p:/(最好|最强|第一|唯一|顶级|领先|独家)/g,r:'',s:'warn' as const}]; const issues=rules.flatMap(r=>{const m=text.match(r.p);return m?[{severity:r.s,pattern:r.p.source,found:m.join(', '),replacement:r.r||undefined,resolved:r.s==='auto_replace'}]:[];}); return {passed:!issues.filter(i=>!i.resolved).length,issues}; };

export default function CreationCenter() {
  const { currentEnterprise } = useEnterprise();
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<Mode>('daily');
  const [dailyCards, setDailyCards] = useState<TopicCard[]>([]);
  const [dailyInstrs, setDailyInstrs] = useState<WritingInstruction[]>([]);
  const [dailyArticles, setDailyArticles] = useState(0);
  const [genIdx, setGenIdx] = useState(-1);
  const [genTotal, setGenTotal] = useState(0);
  const [dailyError, setDailyError] = useState('');
  const [genning, setGenning] = useState(false);
  const [genCardId, setGenCardId] = useState<string | null>(null);
  const [showDash, setShowDash] = useState(false);
  const [dashStats, setDashStats] = useState<Record<string,any>>({});

  useEffect(() => {
    if (!currentEnterprise) return;
    const cards = queryAll<TopicCard>('SELECT * FROM topic_cards WHERE enterprise_id=? AND status IN (?,?)', [currentEnterprise.id, 'confirmed', 'edited']);
    for (const c of cards) { if (typeof c.card_json === 'string') try { c.card_json = JSON.parse(c.card_json); } catch {} }
    setDailyCards(cards);
    const instrs = queryAll<WritingInstruction>('SELECT * FROM writing_instructions WHERE enterprise_id=?', [currentEnterprise.id]);
    for (const i of instrs) { if (typeof i.instruction_json === 'string') try { i.instruction_json = JSON.parse(i.instruction_json); } catch {} }
    setDailyInstrs(instrs);
    const arts = queryAll<any>('SELECT COUNT(*) as cnt FROM articles WHERE enterprise_id=? AND status!=?', [currentEnterprise.id, 'deleted']);
    setDailyArticles(arts[0]?.cnt || 0);
    if (cards.length > 0) setMode('daily');
    // 数据看板统计
    const platformStats = queryAll<any>("SELECT platform, COUNT(*) as cnt, AVG(word_count) as avg_wc FROM articles WHERE enterprise_id=? AND status!=? GROUP BY platform", [currentEnterprise.id, 'deleted']);
    const formStats = queryAll<any>("SELECT content_form, COUNT(*) as cnt FROM articles WHERE enterprise_id=? AND status!=? GROUP BY content_form", [currentEnterprise.id, 'deleted']);
    const sigAvg = queryAll<any>("SELECT AVG(json_extract(citation_signals,'$.data_point')) as dp, AVG(json_extract(citation_signals,'$.authority_citation')) as ac, AVG(json_extract(citation_signals,'$.case_study')) as cs, AVG(json_extract(citation_signals,'$.comparison')) as cp FROM articles WHERE enterprise_id=? AND status!=?", [currentEnterprise.id, 'deleted']);
    const compPass = queryAll<any>("SELECT COUNT(*) as total, SUM(CASE WHEN json_extract(compliance,'$.passed')='true' THEN 1 ELSE 0 END) as passed FROM articles WHERE enterprise_id=? AND status!=?", [currentEnterprise.id, 'deleted']);
    setDashStats({ platforms: platformStats, forms: formStats, signals: sigAvg[0] || {}, compliance: compPass[0] || {} });
  }, [currentEnterprise]);

  const quickGen = async (card: TopicCard) => {
    if (!hasApiKey()) { setDailyError('请先配置 API Key'); return; }
    if (!currentEnterprise) return;
    let instr = dailyInstrs.find(i => i.topic_card_id === card.id);
    if (!instr) {
      try {
        const d = await chatWithJSON<InstructionData>([{role:'system',content:`你是AI写作指令工程师。生成三层写作指令JSON。平台：${card.card_json?.recommended_platforms?.[0]||'zhihu'}。选题卡：${JSON.stringify(card.card_json)}`},{role:'user',content:'组装写作指令。'}],{temperature:0.4});
        const iid = generateId('wi');
        execute('INSERT INTO writing_instructions (id,enterprise_id,topic_card_id,instruction_json,status,created_at) VALUES (?,?,?,?,?,?)',[iid,currentEnterprise.id,card.id,JSON.stringify(d),'confirmed',new Date().toISOString()]);
        await persistDatabase();
        instr = {id:iid,enterprise_id:currentEnterprise.id,topic_card_id:card.id,instruction_json:d,status:'confirmed',created_at:new Date().toISOString()};
        setDailyInstrs(p=>[...p,instr!]);
      } catch(e:any) { setDailyError('生成指令失败: '+e.message); return; }
    }
    setGenning(true); setGenCardId(card.id); setDailyError('');
    const pd = (queryOne<CP>('SELECT * FROM company_profiles WHERE enterprise_id=? AND status=?',[currentEnterprise.id,'locked'])?.profile_json as any) || {};
    const prevArts = queryAll<{title: string}>('SELECT title FROM articles WHERE enterprise_id=? AND question_anchor=? AND status!=? ORDER BY generated_at DESC LIMIT 5', [currentEnterprise.id, card.card_json?.question||'', 'deleted']);
    const uniquenessCue = prevArts.length > 0
      ? `\n已有同主题文章（请避免雷同）：${prevArts.map((a,i)=>`${i+1}. ${a.title}`).join('；')}\n请从全新角度切入，标题和核心论据必须与已有文章明显不同。`
      : '\n这是该主题的首篇文章，请做最详尽全面的覆盖。';
    try {
      const body = await chat([{role:'system',content:`你是资深行业编辑（非AI助手），为「${pd.company_name||''}」写一篇面向${card.card_json?.recommended_platforms?.[0]||'zhihu'}的文章。主题：${card.card_json?.question||''}。要求：1)标题含2026年+长尾关键词 2)直接切入，不用"在当今""随着发展"开头 3)长短句交替，加入编辑口吻如"说实话""这里有个坑" 4)数据标注来源和时间 5)不用"首先其次最后"等机械连接词 6)观点明确不骑墙 7)极限词合规替换：最好→更优、第一→位居前列、100%→绝大多数、唯一→为数不多。${uniquenessCue}输出Markdown。`},{role:'user',content:'生成文章。'}],{temperature:0.85});
      const title=(body.match(/^#\s+(.+)/m)||[card.card_json?.question||''])[1];
      const sig=sigFn(body); const comp=compFn(body);
      const aid=generateId('art');const now=new Date().toISOString();
      const plat = instr.instruction_json?.platform_layer?.platform || card.card_json?.recommended_platforms?.[0] || 'zhihu';
      const form = instr.instruction_json?.body_layer?.content_form || 'knowledge_science';
      execute('INSERT INTO articles (id,enterprise_id,title,body_markdown,word_count,platform,content_form,question_anchor,tags,version,status,citations_embedded,citation_signals,compliance,generated_at,modified_at,language) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[aid,currentEnterprise.id,title,body,body.length,plat,form,card.card_json?.question||'','[]',1,'draft','[]',JSON.stringify(sig),JSON.stringify(comp),now,now,'zh-CN']);
      await persistDatabase();
      setDailyArticles(p=>p+1);
    } catch(e:any) { setDailyError(e.message); }
    setGenning(false); setGenCardId(null); setGenIdx(-1); setGenTotal(0);
  };

  const batchGen = async (cards: TopicCard[]) => {
    if (cards.length === 0) return;
    setGenning(true);
    setGenTotal(cards.length);
    for (let i = 0; i < cards.length; i++) { setGenIdx(i); setGenCardId(cards[i].id); await quickGen(cards[i]); }
  };

  if (!currentEnterprise) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4"><Plus size={28} className="text-gray-300" /></div>
        <p className="text-base font-medium text-gray-400 mb-1">尚未选择企业</p><p className="text-sm text-gray-300">请先在上方创建或选择一个企业</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={()=>setMode('daily')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${mode==='daily'?'bg-indigo-600 text-white shadow-sm':'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
          <Zap size={15} />日常创作
        </button>
        <button onClick={()=>setMode('strategy')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${mode==='strategy'?'bg-indigo-600 text-white shadow-sm':'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
          <PenLine size={15} />策略搭建
        </button>
        <span className="ml-auto text-xs text-gray-400">{dailyCards.length} 选题 · {dailyArticles} 文章</span>
      </div>

      {mode === 'daily' && (
        <div className="space-y-4">
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">今日创作</h2>
                <p className="text-sm text-gray-400 mt-0.5">从选题库快速生成文章，每天打开就能写</p>
              </div>
              {dailyCards.length > 0 && (
                <button onClick={() => batchGen(dailyCards)} disabled={genning} className="btn-base btn-primary text-xs">
                  <Sparkles size={13} />{genning ? `生成中 ${genIdx+1}/${genTotal}...` : `一键生成全部 (${dailyCards.length})`}
                </button>
              )}
            </div>
            {dailyCards.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-400 mb-1">暂无选题卡</p>
                <p className="text-xs text-gray-300 mb-4">切换到「策略搭建」，先完成 AI 蒸馏生成选题库</p>
                <button onClick={()=>setMode('strategy')} className="btn-base btn-primary text-xs">进入策略搭建 <ArrowRight size={13}/></button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {dailyCards.map(card => {
                  const hasInstr = dailyInstrs.find(i => i.topic_card_id === card.id);
                  const cd = card.card_json;
                  return (
                    <div key={card.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{background: hasInstr ? '#10b981' : '#d1d5db'}} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-900 truncate">{cd?.question || '(空)'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-gray-400">{platformLabel(cd?.recommended_platforms?.[0] || 'zhihu')}</span>
                          <span className="text-[11px] text-gray-400">{contentFormLabel(cd?.content_form)}</span>
                        </div>
                      </div>
                      <button onClick={() => quickGen(card)} disabled={!!genCardId && genCardId !== card.id} className="btn-base btn-primary text-xs py-1.5 shrink-0">
                        <Sparkles size={12} />{genCardId === card.id ? '生成中...' : hasInstr ? '再写一篇' : '生成文章'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {dailyError && <p className="mt-3 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12}/>{dailyError}</p>}
          </div>
          {dailyArticles > 0 && (
            <div className="card p-4 sm:p-5">
              <button onClick={() => setShowDash(!showDash)} className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <BarChart3 size={15} className="text-indigo-500" />
                  <h3 className="text-sm font-semibold text-gray-900">数据看板</h3>
                </div>
                {showDash ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
              </button>
              {showDash && (
                <div className="mt-4 space-y-4">
                  {/* Platform distribution */}
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">平台分布</p>
                    <div className="flex gap-2 flex-wrap">
                      {(dashStats.platforms || []).map((p: any) => (
                        <div key={p.platform} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                          <span className="text-[12px] font-medium text-gray-700">{platformLabel(p.platform)}</span>
                          <span className="badge badge-blue text-[10px]">{p.cnt}篇</span>
                          <span className="text-[10px] text-gray-400">{Math.round(p.avg_wc || 0)}字/篇</span>
                        </div>
                      ))}
                      {(!dashStats.platforms || dashStats.platforms.length === 0) && <span className="text-xs text-gray-400">暂无数据</span>}
                    </div>
                  </div>
                  {/* Content form distribution */}
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">内容形态</p>
                    <div className="flex gap-2 flex-wrap">
                      {(dashStats.forms || []).map((f: any) => (
                        <div key={f.content_form} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                          <span className="text-[12px] font-medium text-gray-700">{contentFormLabel(f.content_form)}</span>
                          <span className="badge badge-purple text-[10px]">{f.cnt}篇</span>
                        </div>
                      ))}
                      {(!dashStats.forms || dashStats.forms.length === 0) && <span className="text-xs text-gray-400">暂无数据</span>}
                    </div>
                  </div>
                  {/* Signal strength */}
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">引用信号强度（均值）</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: '数据点', value: dashStats.signals?.dp || 0, color: 'indigo' },
                        { label: '权威引用', value: dashStats.signals?.ac || 0, color: 'emerald' },
                        { label: '案例', value: dashStats.signals?.cs || 0, color: 'amber' },
                        { label: '对比', value: dashStats.signals?.cp || 0, color: 'rose' },
                      ].map(s => (
                        <div key={s.label} className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                          <div className={`text-lg font-bold text-${s.color}-600`}>{Number(s.value).toFixed(1)}</div>
                          <div className="text-[10px] text-gray-400">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Compliance */}
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">合规通过率</p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[12px] text-gray-600">通过 {dashStats.compliance?.passed || 0} 篇</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[12px] text-gray-600">待处理 {(dashStats.compliance?.total || 0) - (dashStats.compliance?.passed || 0)} 篇</span>
                      </div>
                      <span className="text-[12px] font-medium text-gray-700">
                        通过率 {dashStats.compliance?.total ? Math.round((dashStats.compliance.passed / dashStats.compliance.total) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'strategy' && (
        <>
          <div className="card p-1.5 mb-5 flex items-center gap-0.5 overflow-x-auto">
            {STEPS.map((s,i) => (
              <React.Fragment key={s.k}>
                <button onClick={()=>setStep(s.k)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-all shrink-0 ${
                  s.k===step?'bg-indigo-600 text-white shadow-sm':s.k<step?'bg-indigo-50 text-indigo-600 hover:bg-indigo-100':'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${s.k===step?'bg-white/20 text-white':s.k<step?'bg-indigo-600 text-white':'bg-gray-100 text-gray-400'}`}>
                    {s.k<step?<Check size={11} strokeWidth={3}/>:s.k}
                  </span>
                  <span className="hidden sm:inline">{s.l}</span>
                </button>
                {i<5&&<ArrowRight size={13} className="text-gray-300 shrink-0 mx-0.5"/>}
              </React.Fragment>
            ))}
          </div>
          <div key={step}>
            {step===1&&<CompanyProfile onNext={()=>setStep(2)}/>}
            {step===2&&<Distillation onNext={()=>setStep(3)} onBack={()=>setStep(1)}/>}
            {step===3&&<TopicCards onNext={()=>setStep(4)} onBack={()=>setStep(2)}/>}
            {step===4&&<InstructionPreview onNext={()=>setStep(5)} onBack={()=>setStep(3)}/>}
            {step===5&&<TaskConfirm onNext={()=>setStep(6)} onBack={()=>setStep(4)}/>}
            {step===6&&<BatchCreate onBack={()=>setStep(5)}/>}
          </div>
        </>
      )}
    </div>
  );
}
