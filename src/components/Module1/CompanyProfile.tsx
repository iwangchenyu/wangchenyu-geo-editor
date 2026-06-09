import React, { useState, useEffect, useRef } from 'react';
import { Upload, Sparkles, ArrowRight, AlertTriangle, CheckCircle2, RotateCcw, Info, Pencil, X } from 'lucide-react';
import { useEnterprise } from '../../store/enterprise';
import { generateId, queryOne, execute, persistDatabase } from '../../db';
import { chatWithJSON, hasApiKey } from '../../services/ai';
import type { CompanyProfile as CP, ProfileData, DiagnosisReport, DimensionResult } from '../../types';

interface Props { onNext: () => void; }

const DIM_EDIT_FIELDS: Record<string, { key: string; label: string; hint: string; multiline?: boolean }[]> = {
  identity: [
    { key: 'company_name', label: '公司全称', hint: '正式注册全称，如"北京智明科技有限公司"' },
    { key: 'established', label: '成立时间', hint: '如"2018年3月"' },
    { key: 'location', label: '所在地', hint: '如"北京市海淀区中关村"' },
    { key: 'scale', label: '团队规模', hint: '如"50-200人"或"年营收3000万+"' },
  ],
  industry: [
    { key: 'industry', label: '所属行业', hint: '如"人工智能"、"企业服务"、"新能源"' },
    { key: 'sub_sector', label: '细分赛道', hint: '如"工业AI视觉检测"、"智能客服SaaS"' },
  ],
  business: [
    { key: 'core_business', label: '核心业务', hint: '一句话说清公司做什么，如"为制造业提供AI视觉质检解决方案"', multiline: true },
    { key: 'products_services', label: '产品/服务', hint: '每行一个，如：\nAI质检系统\n设备预测维护平台', multiline: true },
    { key: 'application_scenarios', label: '应用场景', hint: '每行一个典型场景，如：\n汽车零部件缺陷检测\n电子元件外观检查', multiline: true },
  ],
  customers: [
    { key: 'target_customers', label: '目标客户', hint: '每行一类客户。格式：客户类型 — 用户画像 — 痛点\n如：汽车主机厂 — 质检主管 — 人工漏检率高、效率低', multiline: true },
  ],
  differentiation: [
    { key: 'differentiators', label: '差异化优势', hint: '每行一个核心竞争力\n如：自研AI模型准确率达99.7%\n服务过30+行业头部客户', multiline: true },
  ],
  data: [
    { key: 'business_data_project_count', label: '项目数量', hint: '如"已落地50+个项目"' },
    { key: 'business_data_customer_count', label: '客户数量', hint: '如"服务200+家付费客户"' },
    { key: 'business_data_coverage', label: '覆盖范围', hint: '如"覆盖全国30+城市"、"出口至东南亚5国"' },
  ],
  credentials: [
    { key: 'certifications', label: '资质与认证', hint: '每行一个\n如：ISO9001质量管理体系认证\n国家高新技术企业', multiline: true },
  ],
};

export default function CompanyProfile({ onNext }: Props) {
  const { currentEnterprise } = useEnterprise();
  const [profile, setProfile] = useState<CP | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [polished, setPolished] = useState(false);
  const [polishedText, setPolishedText] = useState('');
  const [editDim, setEditDim] = useState<string | null>(null);
  const [dimForm, setDimForm] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentEnterprise) return;
    const ex = queryOne<CP>('SELECT * FROM company_profiles WHERE enterprise_id=? ORDER BY created_at DESC LIMIT 1', [currentEnterprise.id]);
    if (ex) {
      if (typeof ex.profile_json === 'string') {
        try { ex.profile_json = JSON.parse(ex.profile_json); } catch {}
      }
      setProfile(ex);
      setText(ex.raw_input);
    }
  }, [currentEnterprise]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 20*1024*1024) { setError('文件不能超过20MB'); return; }
    setError('');
    const ext = f.name.split('.').pop()?.toLowerCase();
    let extracted = '';
    try {
      if (ext === 'docx') {
        const { default: mammoth } = await import('mammoth');
        const buf = await f.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buf });
        extracted = result.value;
      } else if (ext === 'doc') {
        setError('.doc 格式暂不支持，请转换为 .docx 后上传');
        return;
      } else if (ext === 'pdf') {
        setError('PDF 格式暂不支持，请复制文本粘贴到输入框');
        return;
      } else {
        extracted = await f.text();
      }
      if (!extracted.trim()) { setError('未能从文件中提取到文字内容'); return; }
      setText(prev => prev ? `${prev}\n\n--- ${f.name} ---\n${extracted}` : extracted);
    } catch (err: any) {
      setError('文件解析失败: ' + (err.message || '未知错误'));
    }
  };

  const diagnose = async () => {
    if (!hasApiKey()) { setError('请先设置 API Key'); return; }
    if (!currentEnterprise || text.trim().length < 10) { setError('请输入至少10个字'); return; }
    setLoading(true); setError('');
    try {
      const r = await chatWithJSON<{profile:ProfileData;diagnosis:DiagnosisReport}>([
        { role:'system', content:'你是企业信息结构化专家。分析用户输入的公司信息，输出以下JSON结构：{"profile":{"company_name":"公司全称","established":"成立时间","location":"所在地","scale":"规模","industry":"所属行业","sub_sector":"细分赛道","core_business":"核心业务一句话","products_services":["产品/服务列表"],"application_scenarios":["应用场景"],"target_customers":[{"type":"客户类型","persona":"用户画像","pain_points":["痛点"]}],"differentiators":["差异化优势"],"business_data":{"project_count":"项目数","customer_count":"客户数","coverage":"覆盖范围"},"certifications":["资质认证"]},"diagnosis":{"passed":true,"dimensions":[{"dimension":"identity","label":"公司身份","required":true,"covered":true,"score":100,"feedback":"诊断评语"},{"dimension":"industry","label":"行业定位","required":true,"covered":true,"score":100,"feedback":"诊断评语"},{"dimension":"business","label":"核心业务","required":true,"covered":true,"score":100,"feedback":"诊断评语"},{"dimension":"customers","label":"目标客户","required":true,"covered":true,"score":100,"feedback":"诊断评语"},{"dimension":"differentiation","label":"差异化优势","required":true,"covered":true,"score":100,"feedback":"诊断评语"},{"dimension":"data","label":"业务数据","required":false,"covered":true,"score":100,"feedback":"诊断评语"},{"dimension":"credentials","label":"资质背书","required":false,"covered":true,"score":100,"feedback":"诊断评语"}],"total_coverage":7,"suggestions":["改进建议"]}}。covered为true表示该项信息充分，为false表示缺失。passed在全部required维度covered为true时为true。' },
        { role:'user', content:`分析：${text}` }
      ]);
      const id = generateId('cp'); const now = new Date().toISOString();
      const pd: ProfileData = { ...r.profile, diagnosis: r.diagnosis };
      execute('DELETE FROM company_profiles WHERE enterprise_id=?',[currentEnterprise.id]);
      execute('INSERT INTO company_profiles (id,enterprise_id,raw_input,profile_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',[id,currentEnterprise.id,text,JSON.stringify(pd),'diagnosed',now,now]);
      await persistDatabase();
      setProfile({id,enterprise_id:currentEnterprise.id,raw_input:text,profile_json:pd,status:'diagnosed',created_at:now,updated_at:now});
    } catch(e:any) { setError(e.message); } finally { setLoading(false); }
  };

  const polish = async () => {
    if (!hasApiKey()) { setError('请先设置 API Key'); return; }
    setLoading(true);
    try {
      const r = await chatWithJSON<{polished:string}>([{role:'system',content:'将原始公司信息改写为专业、结构化的企业介绍。不失实。返回{"polished":"..."}'},{role:'user',content:text}]);
      setPolishedText(r.polished); setPolished(true);
    } catch(e:any) { setError(e.message); } finally { setLoading(false); }
  };

  const startEditDim = (dimKey: string) => {
    if (!profile?.profile_json) return;
    const pd = profile.profile_json as ProfileData;
    const fields = DIM_EDIT_FIELDS[dimKey];
    if (!fields) return;
    const form: Record<string, string> = {};
    for (const f of fields) {
      if (f.key.startsWith('business_data_')) {
        const subKey = f.key.replace('business_data_', '');
        form[f.key] = (pd.business_data as any)?.[subKey] || '';
      } else if (['products_services', 'application_scenarios', 'differentiators', 'certifications'].includes(f.key)) {
        form[f.key] = (pd as any)[f.key]?.join('\n') || '';
      } else if (f.key === 'target_customers') {
        form[f.key] = pd.target_customers?.map(c => `${c.type} — ${c.persona} — ${c.pain_points.join('、')}`).join('\n') || '';
      } else {
        form[f.key] = (pd as any)[f.key] || '';
      }
    }
    setDimForm(form);
    setEditDim(dimKey);
  };

  const saveDimEdit = async () => {
    if (!editDim || !profile) return;
    const pd = { ...profile.profile_json } as any;
    for (const [key, val] of Object.entries(dimForm)) {
      if (key.startsWith('business_data_')) {
        const subKey = key.replace('business_data_', '');
        if (!pd.business_data) pd.business_data = {};
        pd.business_data[subKey] = val;
      } else if (['products_services', 'application_scenarios', 'differentiators', 'certifications'].includes(key)) {
        pd[key] = val.split('\n').map((s: string) => s.trim()).filter(Boolean);
      } else if (key === 'target_customers') {
        pd.target_customers = val.split('\n').filter((l: string) => l.trim()).map((line: string) => {
          const m = line.match(/^(.+?)\s*[—\-]\s*(.+?)\s*[—\-]\s*(.+)$/);
          if (m) return { type: m[1].trim(), persona: m[2].trim(), pain_points: [m[3].trim()] };
          return { type: line.trim(), persona: '', pain_points: [] };
        });
      } else {
        pd[key] = val;
      }
    }
    execute('UPDATE company_profiles SET profile_json=?, updated_at=? WHERE id=?', [JSON.stringify(pd), new Date().toISOString(), profile.id]);
    await persistDatabase();
    setProfile({ ...profile, profile_json: pd as ProfileData, updated_at: new Date().toISOString() });
    // 根据编辑后的数据重新评估诊断报告
    const dimChecks: Array<{dimension: string; label: string; required: boolean; covered: boolean}> = [
      { dimension: 'identity', label: '公司身份', required: true, covered: !!(pd.company_name && (pd.established || pd.location || pd.scale)) },
      { dimension: 'industry', label: '行业定位', required: true, covered: !!pd.industry },
      { dimension: 'business', label: '核心业务', required: true, covered: !!(pd.core_business && ((pd.products_services?.length > 0) || (pd.application_scenarios?.length > 0))) },
      { dimension: 'customers', label: '目标客户', required: true, covered: !!(pd.target_customers?.length > 0 && pd.target_customers.some((c: any) => c.type || c.persona)) },
      { dimension: 'differentiation', label: '差异化优势', required: true, covered: !!(pd.differentiators?.length > 0) },
      { dimension: 'data', label: '业务数据', required: false, covered: !!(pd.business_data && (pd.business_data.project_count || pd.business_data.customer_count || pd.business_data.coverage)) },
      { dimension: 'credentials', label: '资质背书', required: false, covered: !!(pd.certifications?.length > 0) },
    ];
    const oldDiag = pd.diagnosis;
    const oldMap: Record<string, any> = {};
    oldDiag?.dimensions?.forEach((d: any) => { oldMap[d.dimension] = d; });
    const newDims = dimChecks.map(d => {
      const old = oldMap[d.dimension];
      const nowCovered = d.covered, wasCovered = old?.covered;
      return {
        dimension: d.dimension, label: d.label, required: d.required, covered: nowCovered,
        score: (nowCovered && !wasCovered) ? 100 : (!nowCovered && wasCovered) ? 0 : (old?.score ?? (nowCovered ? 100 : 0)),
        feedback: (nowCovered && !wasCovered) ? '已补充完整 \u2713' : (!nowCovered && wasCovered) ? '信息缺失，请重新补充' : (old?.feedback || (nowCovered ? '信息充分' : '待补充')),
      } as DimensionResult;
    });
    const requiredPassed = newDims.filter(d => d.required).every(d => d.covered);
    pd.diagnosis = {
      passed: requiredPassed,
      dimensions: newDims,
      total_coverage: newDims.filter(d => d.covered).length,
      suggestions: oldDiag?.suggestions || [],
    };
    execute('UPDATE company_profiles SET profile_json=? WHERE id=?', [JSON.stringify(pd), profile.id]);
    execute('DELETE FROM distillation_results WHERE enterprise_id=?', [profile.enterprise_id]);
    execute('DELETE FROM topic_cards WHERE enterprise_id=?', [profile.enterprise_id]);
    execute('DELETE FROM writing_instructions WHERE enterprise_id=?', [profile.enterprise_id]);
    execute('DELETE FROM creation_tasks WHERE enterprise_id=?', [profile.enterprise_id]);
    execute('DELETE FROM articles WHERE enterprise_id=?', [profile.enterprise_id]);
    await persistDatabase();
    setEditDim(null);
  };

  const lock = async () => {
    if (!profile) return;
    execute('UPDATE company_profiles SET status=?,updated_at=? WHERE id=?',['locked',new Date().toISOString(),profile.id]);
    await persistDatabase(); setProfile({...profile,status:'locked'}); onNext();
  };

  const d = profile?.profile_json?.diagnosis;
  const locked = profile?.status==='locked';

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">1</span>
          <h2 className="text-base font-semibold text-gray-900">公司信息录入</h2>
        </div>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="描述你的公司：做什么的、面向谁、有什么优势..." rows={5} disabled={locked}
          className="input resize-none text-sm disabled:bg-gray-50 disabled:text-gray-400" />
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md" onChange={handleFile} className="hidden" />
          <button onClick={()=>fileRef.current?.click()} className="btn-base btn-ghost text-xs" disabled={locked}><Upload size={13}/>上传文档</button>
          <div className="w-px h-4 bg-gray-200 hidden sm:block"/>
          <button onClick={diagnose} disabled={loading||locked} className="btn-base btn-primary text-xs"><Sparkles size={13}/>{loading?'诊断中...':'AI 诊断'}</button>
          <button onClick={polish} disabled={loading||locked} className="btn-base btn-secondary text-xs"><RotateCcw size={13}/>改写优化</button>
          {!locked && d?.passed && <button onClick={lock} className="btn-base btn-success text-xs ml-auto"><CheckCircle2 size={13}/>锁定并进入 <ArrowRight size={13}/></button>}
          {locked && <span className="ml-auto flex items-center gap-1.5 text-sm text-emerald-600 font-medium"><CheckCircle2 size={14}/>已锁定</span>}
        </div>
        {error&&<p className="flex items-center gap-1.5 mt-3 text-xs text-red-500"><AlertTriangle size={12}/>{error}</p>}
      </div>

      {polished && (
        <div className="card p-4 sm:p-6">
          <h3 className="text-sm font-semibold mb-3 text-gray-900">AI 改写优化预览</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><div className="text-xs text-gray-400 mb-2">原文</div><div className="text-sm text-gray-500 whitespace-pre-wrap bg-gray-50 rounded-xl p-3">{text}</div></div>
            <div><div className="text-xs text-indigo-500 mb-2">优化版</div><div className="text-sm whitespace-pre-wrap bg-indigo-50 rounded-xl p-3">{polishedText}</div></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={()=>{setText(polishedText);setPolished(false);}} className="btn-base btn-primary text-xs">接受改写</button>
            <button onClick={()=>setPolished(false)} className="btn-base btn-secondary text-xs">保留原文</button>
          </div>
        </div>
      )}

      {d && (
        <div className="card p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${d.passed?'bg-emerald-100 text-emerald-600':'bg-amber-100 text-amber-600'}`}>
                {d.passed?<CheckCircle2 size={15}/>:<AlertTriangle size={15}/>}
              </span>
              <h2 className="text-base font-semibold text-gray-900">七维度诊断报告</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${d.passed?'badge-green':'badge-amber'}`}>{d.passed?'已达标':'待补充'}</span>
              <span className="text-xs text-gray-400">{d.total_coverage}/7 覆盖</span>
            </div>
          </div>
          <div className="space-y-2">
            {d.dimensions.map((dim:DimensionResult) => {
              const isEditing = editDim === dim.dimension;
              const hasFields = DIM_EDIT_FIELDS[dim.dimension]?.length > 0;
              return (
                <div key={dim.dimension} className={"rounded-xl border transition-all " +  (isEditing ? "border-indigo-300 bg-white shadow-sm" : dim.covered ? "border-emerald-200 bg-emerald-50/30" : dim.required ? "border-red-200 bg-red-50/30" : "border-gray-200 bg-gray-50")}>
                  <div className="flex items-start gap-3 p-3">
                    {dim.covered?<CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5"/>:<AlertTriangle size={16} className={dim.required?'text-red-400 shrink-0 mt-0.5':'text-amber-400 shrink-0 mt-0.5'}/>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => isEditing ? setEditDim(null) : startEditDim(dim.dimension)}
                          disabled={locked || !hasFields}
                          className="text-[13px] font-medium text-gray-900 hover:text-indigo-600 transition-colors text-left disabled:cursor-default disabled:hover:text-gray-900"
                        >
                          {dim.label}
                        </button>
                        {dim.required && <span className="badge-red">必需</span>}
                        <span className="text-xs text-gray-400">{dim.score}分</span>
                        {!locked && hasFields && (
                          <button
                            onClick={() => isEditing ? setEditDim(null) : startEditDim(dim.dimension)}
                            className={"ml-auto p-1 rounded-md transition-colors " +  (isEditing ? "bg-indigo-100 text-indigo-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100")}
                          >
                            {isEditing ? <X size={13} /> : <Pencil size={13} />}
                          </button>
                        )}
                      </div>
                      {!isEditing ? (
                        <>
                          <p className="text-xs text-gray-500 mt-0.5">{dim.feedback}</p>
                          {dim.guiding_questions?.map((q,i)=><div key={i} className="flex items-start gap-1 mt-1.5 text-xs text-indigo-600"><Info size={11} className="shrink-0 mt-0.5"/>{q}</div>)}
                        </>
                      ) : (
                        <div className="mt-3 space-y-2.5 border-t border-gray-100 pt-3">
                          <p className="text-[11px] text-indigo-500 font-medium flex items-center gap-1"><Info size={11} />填写下方信息后保存，系统将更新公司画像</p>
                          {DIM_EDIT_FIELDS[dim.dimension].map(f => (
                            <div key={f.key}>
                              <label className="text-[11px] font-medium text-gray-500 mb-1 block">{f.label}</label>
                              {f.multiline ? (
                                <textarea
                                  value={dimForm[f.key] || ''}
                                  onChange={e => setDimForm(prev => ({...prev, [f.key]: e.target.value}))}
                                  placeholder={f.hint}
                                  rows={3}
                                  className="input text-xs resize-none font-sans"
                                />
                              ) : (
                                <input
                                  value={dimForm[f.key] || ''}
                                  onChange={e => setDimForm(prev => ({...prev, [f.key]: e.target.value}))}
                                  placeholder={f.hint}
                                  className="input text-xs"
                                />
                              )}
                            </div>
                          ))}
                          <div className="flex gap-2 pt-1">
                            <button onClick={saveDimEdit} className="btn-base btn-primary text-xs py-1.5">保存修改</button>
                            <button onClick={() => setEditDim(null)} className="btn-base btn-ghost text-xs py-1.5">取消</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {locked && profile && (
        <div className="card p-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">当前画像：<strong className="text-gray-700">{profile.profile_json?.company_name || '未命名企业'}</strong> · {profile.profile_json?.industry || '未知行业'}</span>
          <button onClick={onNext} className="btn-base btn-primary text-xs">进入 AI 蒸馏 <ArrowRight size={13}/></button>
        </div>
      )}
    </div>
  );
}
