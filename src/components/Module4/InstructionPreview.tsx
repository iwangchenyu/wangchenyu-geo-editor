import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, Layers, AlertTriangle, Pencil } from 'lucide-react';
import { useEnterprise } from '../../store/enterprise';
import { generateId, queryAll, execute, persistDatabase } from '../../db';
import { chatWithJSON, hasApiKey } from '../../services/ai';
import type { TopicCard, WritingInstruction, InstructionData } from '../../types';

interface Props { onNext: () => void; onBack: () => void; }

export default function InstructionPreview({ onNext, onBack }: Props) {
  const { currentEnterprise } = useEnterprise();
  const [cards, setCards] = useState<TopicCard[]>([]);
  const [instrs, setInstrs] = useState<WritingInstruction[]>([]);
  const [sel, setSel] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editI, setEditI] = useState<WritingInstruction|null>(null);
  const [editJ, setEditJ] = useState('');
  const didAuto = useRef(false);

  useEffect(() => {
    if (!currentEnterprise) return;
    const cs = queryAll<TopicCard>('SELECT * FROM topic_cards WHERE enterprise_id=? AND status IN (?,?)',[currentEnterprise.id,'confirmed','edited']);
    for (const c of cs) {
      if (typeof c.card_json === 'string') {
        try { c.card_json = JSON.parse(c.card_json); } catch {}
      }
    }
    setCards(cs);
    const is = queryAll<WritingInstruction>('SELECT * FROM writing_instructions WHERE enterprise_id=?',[currentEnterprise.id]);
    for (const i of is) {
      if (typeof i.instruction_json === 'string') {
        try { i.instruction_json = JSON.parse(i.instruction_json); } catch {}
      }
    }
    setInstrs(is);
  }, [currentEnterprise]);

  // Auto-assemble when entering with confirmed cards but no instructions
  useEffect(() => {
    if (didAuto.current || !cards.length || instrs.length > 0) return;
    if (!hasApiKey()) return;
    didAuto.current = true;
    assemble();
  }, [cards.length, instrs.length]);

  const assemble = async () => {
    if (!hasApiKey()) { setError('请先设置 API Key'); return; }
    if (!currentEnterprise) return;
    setLoading(true); setError('');
      // If reassembling, delete existing instructions first
      if (instrs.length > 0) {
        execute('DELETE FROM writing_instructions WHERE enterprise_id=?',[currentEnterprise.id]);
        await persistDatabase();
        setInstrs([]);
      }
    try {
      for (const c of cards) {
        if (instrs.find(i=>i.topic_card_id===c.id)) continue;
        const d = await chatWithJSON<InstructionData>([{role:'system',content:`你是AI写作指令工程师。根据选题卡生成三层写作指令，严格输出以下JSON结构：{"body_layer":{"paragraph_structure":["段落1","段落2"],"reference_signals":[{"type":"data_point|authority_citation|case_study|step_by_step|comparison|risk_warning","description":"信号描述"}],"creative_tone":"文风","word_count":2000,"content_form":"内容形态"},"title_layer":{"title_templates":["GEO优化标题模板，必须符合以下规则：1)模拟真实用户搜索意图(问句式/数字式/对比式/指南式) 2)包含长尾关键词和具体数字 3)避免教科书式标题如\"如何理解X：从基础到前沿\" 4)知乎用\"如何看待/为什么/有哪些\" 5)公众号/百度用\"是什么意思/怎么做/XX和YY区别/2026年XX指南\" 6)小红书用\"测评/攻略/避坑/亲测\" 7)AI搜索平台(豆包/元宝/千问/文心/DeepSeek)用\"XX是什么意思完整指南/XX和YY哪个好数据对比/XX怎么做从入门到精通\"，必须含具体问题关键词且能独立作为AI摘要"],"trigger_words":["触发词"],"click_triggers":["点击诱因"]},"platform_layer":{"platform":"平台名(知乎/公众号/小红书/官网/AI搜索平台)","format_requirements":"格式要求(AI搜索平台须使用Q&A结构)","word_count_range":[1500,3000],"special_rules":["特殊规则(AI搜索平台须确保每节可独立被AI引用)"]}}。平台：${c.card_json?.recommended_platforms?.[0]||'zhihu'}。选题卡：${JSON.stringify(c.card_json)}`},{role:'user',content:'组装三层写作指令。'}],{temperature:0.4});
        const id = generateId('wi');
        execute('INSERT INTO writing_instructions (id,enterprise_id,topic_card_id,instruction_json,status,created_at) VALUES (?,?,?,?,?,?)',[id,currentEnterprise.id,c.id,JSON.stringify(d),'confirmed',new Date().toISOString()]);
        await persistDatabase();
        setInstrs(p=>[...p,{id,enterprise_id:currentEnterprise.id,topic_card_id:c.id,instruction_json:d,status:'confirmed',created_at:new Date().toISOString()}]);
      }
    } catch(e:any) { setError(e.message); } finally { setLoading(false); }
  };

  const saveE = async () => { if(!editI)return; try{const val=JSON.parse(editJ);execute('UPDATE writing_instructions SET instruction_json=?,status=? WHERE id=?',[JSON.stringify(val),'edited',editI.id]);await persistDatabase();setInstrs(p=>p.map(i=>i.id===editI.id?{...i,instruction_json:val as InstructionData,status:"edited" as const}:i));setEditI(null);}catch{setError('JSON格式错误');}};
  const instr = instrs.find(i=>i.topic_card_id===sel);

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">4</span>
          <h2 className="text-base font-semibold text-gray-900">写作指令预览</h2>
          <span className="ml-auto text-xs text-gray-400">{instrs.length}/{cards.length} 已生成</span>
        </div>
        <p className="text-sm text-gray-400 mb-3">选题卡自动组装为三层指令结构。</p>
        <div className="flex gap-2"><button onClick={assemble} disabled={loading||!cards.length} className="btn-base btn-primary text-xs"><Sparkles size={13}/>{loading?'组装中...':instrs.length===cards.length&&cards.length>0?'重新生成指令':instrs.length>0?'继续组装':'开始组装指令（必须）'}</button><button onClick={onBack} className="btn-base btn-secondary text-xs"><ArrowLeft size={13}/>返回</button></div>
        {error&&<p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12}/>{error}</p>}
      </div>
      {cards.length===0 ? <div className="card p-6 text-center"><AlertTriangle size={24} className="text-amber-500 mx-auto mb-3" /><p className="text-sm text-gray-600 mb-1">没有已确认的选题卡</p><p className="text-xs text-gray-400 mb-4">请返回第三步，勾选要使用的选题卡</p><button onClick={onBack} className="btn-base btn-primary text-xs"><ArrowLeft size={13}/>返回第三步</button></div> : null}
      {cards.length>0&&<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-1.5"><p className="text-xs text-gray-400 mb-1 px-1">选择选题卡</p>
          {cards.map(c=>{const has=instrs.find(i=>i.topic_card_id===c.id);return <button key={c.id} onClick={()=>setSel(c.id)} className={`w-full text-left p-3 rounded-xl border transition-all ${sel===c.id?'border-indigo-300 bg-indigo-50/30':'border-gray-200 bg-white hover:border-gray-300'}`}><div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${has?'bg-emerald-400':'bg-gray-300'}`}/><span className="text-xs truncate">{(c.card_json?.question || "").slice(0,24) || '(空)'}...</span></div></button>;})}
        </div>
        <div className="lg:col-span-2">
          {instr&&!editI?<div className="card overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900">三层写作指令</h3><button onClick={()=>{setEditI(instr);setEditJ(JSON.stringify(instr.instruction_json,null,2));}} className="btn-base btn-ghost text-xs py-1"><Pencil size={11}/>微调</button></div>
            {[{label:'正文写作层',color:'text-indigo-600',bg:'bg-indigo-50',data:instr.instruction_json.body_layer},{label:'标题生成层',color:'text-amber-600',bg:'bg-amber-50',data:instr.instruction_json.title_layer},{label:'平台适配层',color:'text-emerald-600',bg:'bg-emerald-50',data:instr.instruction_json.platform_layer}].map(l=><div key={l.label} className="px-5 py-4 border-b border-gray-50 last:border-0"><div className={`inline-flex items-center gap-1.5 ${l.bg} rounded-full px-2.5 py-0.5 mb-2`}><Layers size={11} className={l.color}/><span className={`text-xs font-medium ${l.color}`}>{l.label}</span></div><pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">{JSON.stringify(l.data,null,2)}</pre></div>)}
          </div>:editI?<div className="card p-5"><textarea value={editJ} onChange={e=>setEditJ(e.target.value)} rows={18} className="input font-mono text-xs resize-none"/><div className="flex gap-2 mt-3"><button onClick={saveE} className="btn-base btn-primary text-xs">保存</button><button onClick={()=>setEditI(null)} className="btn-base btn-secondary text-xs">取消</button></div></div>:<div className="card flex items-center justify-center h-40 text-sm text-gray-400">{instrs.length===0?'请先点击上方「自动组装指令」生成写作指令':'选择左侧选题卡查看指令'}</div>}
        </div>
      </div>}
      <div className="flex justify-between"><button onClick={onBack} className="btn-base btn-ghost text-xs"><ArrowLeft size={13}/>返回</button><button onClick={onNext} disabled={!instrs.length} className="btn-base btn-primary text-xs">进入任务确认 <ArrowRight size={13}/></button></div>
    </div>
  );
}
