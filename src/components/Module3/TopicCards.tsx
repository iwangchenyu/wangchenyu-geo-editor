import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, Check, Edit3, SkipForward, AlertTriangle, X } from 'lucide-react';
import { useEnterprise } from '../../store/enterprise';
import { generateId, queryAll, queryOne, execute, persistDatabase } from '../../db';
import { chatWithJSON, hasApiKey } from '../../services/ai';
import type { DistillationResult, TopicCard, TopicCardData } from '../../types';

interface Props { onNext: () => void; onBack: () => void; }

export default function TopicCards({ onNext, onBack }: Props) {
  const { currentEnterprise } = useEnterprise();
  const [dist, setDist] = useState<DistillationResult | null>(null);
  const [cards, setCards] = useState<TopicCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string|null>(null);
  const [editT, setEditT] = useState('');

  useEffect(() => {
    if (!currentEnterprise) return;
    const d = queryOne<DistillationResult>('SELECT * FROM distillation_results WHERE enterprise_id=? ORDER BY created_at DESC LIMIT 1',[currentEnterprise.id]);
    if (d && typeof d.result_json === 'string') {
      try { d.result_json = JSON.parse(d.result_json); } catch {}
    }
    setDist(d);
    const cs = queryAll<TopicCard>('SELECT * FROM topic_cards WHERE enterprise_id=?',[currentEnterprise.id]);
    for (const c of cs) {
      if (typeof c.card_json === 'string') {
        try { c.card_json = JSON.parse(c.card_json); } catch {}
      }
    }
    setCards(cs);
  }, [currentEnterprise]);

  const gen = async () => {
    if (!hasApiKey()) { setError('请先设置 API Key'); return; }
    if (!dist||!currentEnterprise) return;
    setLoading(true); setError('');
    try {
      const anchors = dist.result_json.problem_domains.flatMap((d:any)=>d.anchors);
      const data = await chatWithJSON<TopicCardData[]>([{role:'system',content:`将问题锚点转为选题卡。Which→comparison_review,Risk→risk_experience,What/How→knowledge_science,HowMuch→cost_breakdown,Why→product_tech。锚点：${JSON.stringify(anchors.map((a:any)=>({id:a.id,question:a.question,dimension:a.dimension,competition_level:a.competition_level})))}`},{role:'user',content:'生成选题卡。'}],{temperature:0.5});
      execute('DELETE FROM topic_cards WHERE enterprise_id=?',[currentEnterprise.id]);
      const nc: TopicCard[] = [];
      for (const cd of data) {
        const id = generateId('tc');
        execute('INSERT INTO topic_cards (id,enterprise_id,distillation_id,card_json,status,created_at) VALUES (?,?,?,?,?,?)',[id,currentEnterprise.id,dist.id,JSON.stringify(cd),'pending',new Date().toISOString()]);
        nc.push({id,enterprise_id:currentEnterprise.id,distillation_id:dist.id,card_json:cd,status:'pending',created_at:new Date().toISOString()});
      }
      await persistDatabase(); setCards(nc);
    } catch(e:any) { setError(e.message); } finally { setLoading(false); }
  };

  const tog = async(c:TopicCard)=>{const ns=c.status==='confirmed'?'pending':'confirmed';execute('UPDATE topic_cards SET status=? WHERE id=?',[ns,c.id]);await persistDatabase();setCards(prev=>prev.map(x=>x.id===c.id?{...x,status:ns}:x));};
  const skip = async(c:TopicCard)=>{execute('UPDATE topic_cards SET status=? WHERE id=?',['skipped',c.id]);await persistDatabase();setCards(prev=>prev.map(x=>x.id===c.id?{...x,status:'skipped'}:x));};
  const saveE = async(c:TopicCard)=>{const u={...c.card_json,question:editT,edited_question:editT};execute('UPDATE topic_cards SET card_json=?,status=? WHERE id=?',[JSON.stringify(u),'edited',c.id]);await persistDatabase();setCards(prev=>prev.map(x=>x.id===c.id?{...x,card_json:u,status:'edited'}:x));setEditId(null);};
  const confirmed = cards.filter(c=>c.status==='confirmed'||c.status==='edited');
  const active = cards.filter(c=>c.status!=='skipped');

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">3</span><h2 className="text-base font-semibold text-gray-900">选题卡确认</h2></div>
          {cards.length>0&&<span className="text-xs text-gray-400">{confirmed.length}/{active.length} 已确认</span>}
        </div>
        <p className="text-sm text-gray-400 mb-3">蒸馏结果自动转化为选题卡。</p>
        <div className="flex gap-2"><button onClick={gen} disabled={loading||!dist} className="btn-base btn-primary text-xs"><Sparkles size={13}/>{loading?'生成中...':cards.length?'重新生成':'生成选题卡'}</button><button onClick={onBack} className="btn-base btn-secondary text-xs"><ArrowLeft size={13}/>返回</button></div>
        {error&&<p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12}/>{error}</p>}
      </div>
      {cards.length>0&&(<>
        <div className="space-y-2">
          {cards.filter(c=>c.status!=='skipped').map(c=><div key={c.id} className={`card p-4 transition-all ${c.status==='confirmed'||c.status==='edited'?'border-indigo-300 bg-indigo-50/30':''}`}>
            <div className="flex items-start gap-3">
              <button onClick={()=>tog(c)} className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${c.status==='confirmed'||c.status==='edited'?'bg-indigo-600 border-indigo-600':'border-gray-300 hover:border-gray-400'}`}>{(c.status==='confirmed'||c.status==='edited')&&<Check size={11} className="text-white"/>}</button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5"><span className={`badge ${(c.card_json?.competition_level || "blue_ocean")==='blue_ocean'?'badge-blue':(c.card_json?.competition_level || "blue_ocean")==='blank'?'badge-green':'badge-red'}`}>{(c.card_json?.competition_level || "blue_ocean")==='blue_ocean'?'蓝海':(c.card_json?.competition_level || "blue_ocean")==='blank'?'空白':'红海'}</span><span className="badge-gray">高优先</span></div>
                {editId===c.id?<div className="flex gap-2"><input value={editT} onChange={e=>setEditT(e.target.value)} className="input text-sm" autoFocus onKeyDown={e=>{if(e.key==='Enter')saveE(c);if(e.key==='Escape')setEditId(null);}}/><button onClick={()=>saveE(c)} className="btn-base btn-primary text-xs py-1.5">保存</button><button onClick={()=>setEditId(null)} className="btn-base btn-ghost text-xs py-1.5"><X size={13}/></button></div>:<><p className="text-[13px] font-medium text-gray-900">{c.card_json?.question || "(空)"}</p><p className="text-xs text-gray-400 mt-0.5">{c.card_json?.creative_tone || ""}</p><p className="text-xs text-indigo-600 mt-1">{c.card_json?.title_direction || ""}</p></>}
              </div>
              <div className="flex gap-0.5 shrink-0"><button onClick={()=>{setEditId(c.id);setEditT(c.card_json?.question || "");}} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Edit3 size={13}/></button><button onClick={()=>skip(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><SkipForward size={13}/></button></div>
            </div>
          </div>)}
        </div>
        <div className="flex justify-between"><button onClick={onBack} className="btn-base btn-ghost text-xs"><ArrowLeft size={13}/>返回</button><button onClick={onNext} disabled={!confirmed.length} className="btn-base btn-primary text-xs">已选 {confirmed.length} 张，进入指令预览 <ArrowRight size={13}/></button></div>
      </>)}
    </div>
  );
}
