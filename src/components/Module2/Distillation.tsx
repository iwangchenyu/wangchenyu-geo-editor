import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowLeft, ArrowRight, Network, Target, Zap, AlertTriangle, Search, X } from 'lucide-react';
import { useEnterprise } from '../../store/enterprise';
import { generateId, queryOne, execute, persistDatabase } from '../../db';
import { chatWithJSON, hasApiKey } from '../../services/ai';
import type { CompanyProfile, DistillationResult, DistillationData, ProblemDomain, QuestionAnchor } from '../../types';

interface Props { onNext: () => void; onBack: () => void; }

export default function Distillation({ onNext, onBack }: Props) {
  const { currentEnterprise } = useEnterprise();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [result, setResult] = useState<DistillationResult | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const DIM_CN: Record<string,string> = {What:'是什么',Why:'为什么',How:'怎么做',Which:'哪个',HowMuch:'多少',Risk:'风险'};
  const DEPTH_CN: Record<string,string> = {surface:'浅层',middle:'中层',deep:'深层',very_deep:'极深'};
  const SIG_CN: Record<string,string> = {data_point:'数据点',authority_citation:'权威引用',case_study:'案例分析',step_by_step:'分步指南',comparison:'对比',risk_warning:'风险警示'};


  useEffect(() => {
    if (!currentEnterprise) return;
    try {
      const cp = queryOne<CompanyProfile>(
        'SELECT * FROM company_profiles WHERE enterprise_id=? AND status=? ORDER BY created_at DESC LIMIT 1',
        [currentEnterprise.id, 'locked']
      );
      setProfile(cp);
      const ex = queryOne<DistillationResult>(
        'SELECT * FROM distillation_results WHERE enterprise_id=? ORDER BY created_at DESC LIMIT 1',
        [currentEnterprise.id]
      );
      if (ex) {
        if (typeof ex.result_json === 'string') {
          try { ex.result_json = JSON.parse(ex.result_json); } catch {}
        }
        setResult(ex);
      }
    } catch (e: any) {
      setError('数据加载失败: ' + e.message);
    }
  }, [currentEnterprise]);

  const getProfileData = () => {
    if (!profile) return null;
    try {
      if (typeof profile.profile_json === 'string') return JSON.parse(profile.profile_json);
      return profile.profile_json;
    } catch {
      return profile.profile_json;
    }
  };

  const distill = async () => {
    if (!hasApiKey()) { setError('请先设置 API Key'); return; }
    if (!profile || !currentEnterprise) { setError('请先完成公司画像并锁定'); return; }
    if (keywords.length === 0) { setError('请输入核心关键词'); return; }
    setLoading(true); setError('');
    try {
      const pd = getProfileData();
      if (!pd || !pd.company_name) { setError('公司画像数据不完整，请返回第一步重新诊断'); setLoading(false); return; }
      const data = await chatWithJSON<DistillationData>([
        { role:'system', content:`你是AI搜索优化专家。根据公司画像和核心关键词，做5W2H蒸馏分析：拆解问题域→生成长尾问题锚点→标注竞争程度→匹配引用信号类型。每个问题域生成3-5个锚点。公司画像：${JSON.stringify(pd)}` },
        { role:'user', content:`核心关键词：${keywords.join('、')}。请进行AI蒸馏分析，生成问题域覆盖网络。返回JSON格式：{"problem_domains":[{"domain":"问题域名","anchors":[{"id":"a1","question":"具体问题","dimension":"What|Why|How|Which|HowMuch|Risk","depth":"surface|middle|deep|very_deep","competition_level":"blue_ocean|red_ocean|blank","reference_signals":[{"type":"data_point|authority_citation|case_study|step_by_step|comparison|risk_warning","description":"信号描述"}],"content_form_suggestions":["形式"],"platform_suggestions":["平台"]}]}],"external_signals":{"hot_events":[],"competitor_coverage":[],"last_round_feedback":null}}` }
      ], { temperature:0.5 });
      const id = generateId('dist');
      execute('DELETE FROM distillation_results WHERE enterprise_id=?',[currentEnterprise.id]);
      execute('INSERT INTO distillation_results (id,enterprise_id,result_json,created_at) VALUES (?,?,?,?)',[id,currentEnterprise.id,JSON.stringify(data),new Date().toISOString()]);
      await persistDatabase();
      setResult({id,enterprise_id:currentEnterprise.id,result_json:data,created_at:new Date().toISOString()});
    } catch(e:any) { setError(e.message); } finally { setLoading(false); }
  };

  // --- No profile ---
  if (!profile) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-center">
        <AlertTriangle size={24} className="text-amber-500 mx-auto mb-3" />
        <p className="text-sm text-gray-600 mb-1">尚未锁定公司画像</p>
        <p className="text-xs text-gray-400 mb-4">请先完成第一步的公司诊断并锁定画像</p>
        <button onClick={onBack} className="btn-base btn-primary text-xs"><ArrowLeft size={13}/>返回第一步</button>
      </div>
    );
  }

  const rd = result?.result_json;
  const ta = rd?.problem_domains?.reduce((s:number,dm:any)=>s+(dm.anchors?.length||0),0)||0;
  const bc = rd?.problem_domains?.reduce((s:number,dm:any)=>s+(dm.anchors?.filter((a:any)=>a.competition_level!=='red_ocean')?.length||0),0)||0;

  return (
    <div className="space-y-4">
      {/* Input card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">2</span>
          <h2 className="text-base font-semibold text-gray-900">AI 蒸馏 · 问题域覆盖网络</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">输入核心关键词，将业务转化为可被 AI 搜索引擎匹配的结构化选题网络。</p>

        {!rd && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">核心关键词（可添加多个，回车或逗号分隔）</label>
              <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-xl bg-white min-h-[42px] items-center focus-within:border-indigo-400 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] transition-all">
                {keywords.map((kw, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[13px] font-medium">
                    {kw}
                    <button
                      onClick={() => setKeywords(prev => prev.filter((_, j) => j !== i))}
                      className="ml-0.5 p-0.5 rounded-md hover:bg-indigo-200 transition-colors text-indigo-400 hover:text-indigo-600"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={inputVal}
                  onChange={e => {
                    const v = e.target.value;
                    if (v.includes(',') || v.includes('，')) {
                      const parts = v.split(/[,，]/).map(s => s.trim()).filter(Boolean);
                      setKeywords(prev => [...prev, ...parts.filter(kw => !prev.includes(kw))]);
                      setInputVal('');
                    } else {
                      setInputVal(v);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && inputVal.trim()) {
                      e.preventDefault();
                      const kw = inputVal.trim();
                      if (!keywords.includes(kw)) setKeywords(prev => [...prev, kw]);
                      setInputVal('');
                    } else if (e.key === 'Backspace' && !inputVal && keywords.length > 0) {
                      setKeywords(prev => prev.slice(0, -1));
                    }
                  }}
                  placeholder={keywords.length === 0 ? '输入关键词，回车添加，如：智能写作、工业AI质检...' : '继续添加...'}
                  className="flex-1 min-w-[120px] border-none outline-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 py-1"
                  disabled={loading}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={distill} disabled={loading || keywords.length === 0} className="btn-base btn-primary text-xs">
                <Sparkles size={13}/>{loading ? '分析中...' : '开始 AI 蒸馏'}
              </button>
              <button onClick={onBack} className="btn-base btn-secondary text-xs"><ArrowLeft size={13}/>返回</button>
            </div>
          </div>
        )}

        {loading && <p className="mt-3 text-sm text-indigo-600 flex items-center gap-2"><div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"/>正在进行5W2H+长尾深挖+竞争标注...</p>}
        {error && <p className="mt-2 text-xs text-red-500 flex items-center gap-1.5"><AlertTriangle size={12}/>{error}</p>}
      </div>

      {/* Results */}
      {rd && (<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[{icon:Target,c:'text-indigo-600',l:'问题域',v:rd.problem_domains?.length||0},{icon:Network,c:'text-gray-700',l:'锚点',v:ta},{icon:Zap,c:'text-emerald-600',l:'蓝海/空白',v:bc},{icon:Target,c:'text-amber-600',l:'引用信号',v:rd.problem_domains?.reduce((s:number,dm:any)=>s+(dm.anchors?.reduce((ss:number,a:any)=>ss+(a.reference_signals?.length||0),0)||0),0)||0}].map((s,i)=><div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4"><s.icon size={18} className={s.c}/><div className="text-xs text-gray-400 mt-2">{s.l}</div><div className={`text-xl font-bold ${s.c}`}>{s.v}</div></div>)}
        </div>
        {rd.problem_domains?.map((dm:ProblemDomain,di:number)=><div key={di} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">{dm.domain}</h3><span className="text-xs text-gray-400">{dm.anchors?.length||0} 个锚点</span></div>
          {dm.anchors?.map((a:QuestionAnchor)=><div key={a.id} className="px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50"><div className="flex items-start gap-3">
            <span className={`badge shrink-0 mt-0.5 ${a.competition_level==='blue_ocean'?'badge-blue':a.competition_level==='blank'?'badge-green':'badge-red'}`}>{a.competition_level==='blue_ocean'?'蓝海':a.competition_level==='blank'?'空白':'红海'}</span>
            <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-gray-900">{a.question}</p><div className="flex flex-wrap gap-1.5 mt-1.5"><span className="badge-gray">{DIM_CN[a.dimension] || a.dimension}·{DEPTH_CN[a.depth] || a.depth}</span>{a.reference_signals?.map((s,si)=><span key={si} className="badge-purple">{SIG_CN[s.type] || s.type}</span>)}</div></div>
          </div></div>)}
        </div>)}
        <div className="flex justify-between">
          <button onClick={() => { setResult(null); setKeywords([]); setInputVal(''); }} className="btn-base btn-ghost text-xs"><ArrowLeft size={13}/>重新蒸馏</button>
          <button onClick={onNext} className="btn-base btn-primary text-xs">进入选题确认 <ArrowRight size={13}/></button>
        </div>
      </>)}
    </div>
  );
}
