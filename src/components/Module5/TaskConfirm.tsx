import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Zap, Target, Gauge, AlertTriangle, Check, Info } from 'lucide-react';
import { useEnterprise } from '../../store/enterprise';
import { generateId, queryAll, execute, persistDatabase } from '../../db';
import { chatWithJSON, hasApiKey } from '../../services/ai';
import { platformLabel, contentFormLabel } from '../../utils/labels';
import type { WritingInstruction, CreationTask, TaskData, TaskArticle, TopicCard } from '../../types';

interface Props { onNext: () => void; onBack: () => void; }

const STRAT: Record<string,string> = {single_deep:'单题深挖',cluster:'集群覆盖',hot_chase:'热点追击',matrix:'矩阵铺设'};

export default function TaskConfirm({ onNext, onBack }: Props) {
  const { currentEnterprise } = useEnterprise();
  const [instrs, setInstrs] = useState<WritingInstruction[]>([]);
  const [task, setTask] = useState<CreationTask|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cards, setCards] = useState<TopicCard[]>([]);

  useEffect(() => {
    if (!currentEnterprise) return;
    const is = queryAll<WritingInstruction>('SELECT * FROM writing_instructions WHERE enterprise_id=?',[currentEnterprise.id]);
    for (const i of is) {
      if (typeof i.instruction_json === 'string') {
        try { i.instruction_json = JSON.parse(i.instruction_json); } catch {}
      }
    }
    setInstrs(is);
    const cs = queryAll<TopicCard>('SELECT * FROM topic_cards WHERE enterprise_id=?',[currentEnterprise.id]);
    for (const c of cs) {
      if (typeof c.card_json === 'string') {
        try { c.card_json = JSON.parse(c.card_json); } catch {}
      }
    }
    setCards(cs);
    const ts = queryAll<CreationTask>('SELECT * FROM creation_tasks WHERE enterprise_id=? ORDER BY created_at DESC LIMIT 1',[currentEnterprise.id]);
    if (ts.length) {
      const t = ts[0];
      if (typeof t.task_json === 'string') {
        try { t.task_json = JSON.parse(t.task_json); } catch {}
      }
      // Clean up broken tasks from previous failed generations
      if (!t.task_json?.articles?.length) {
        execute('DELETE FROM creation_tasks WHERE id=?',[t.id]);
        persistDatabase();
      } else {
        setTask(t);
      }
    }
  }, [currentEnterprise]);

  const gen = async () => {
    if (!hasApiKey()) { setError('请先设置 API Key'); return; }
    if (!currentEnterprise) return;
    setLoading(true); setError('');
    try {
      const topicQ = Object.fromEntries(cards.map(c=>[c.id,c.card_json?.question||'']));
      const ctx = instrs.map(i=>({topic:topicQ[i.topic_card_id]||'',platform:i.instruction_json?.platform_layer?.platform||'zhihu',word_count:i.instruction_json?.body_layer?.word_count||2000,content_form:i.instruction_json?.body_layer?.content_form||'knowledge_science',titles:i.instruction_json?.title_layer?.title_templates||[],tone:i.instruction_json?.body_layer?.creative_tone||''}));
      const systemPrompt = `你是AI内容创作任务规划师。你是GEO（生成式引擎优化）专家。根据platform字段，为每个平台的title_direction采用对应规则：
  - 知乎: "如何看待XX？""为什么XX？""有哪些XX方法？"，深度分析型，2500-5000字，含数据和引用
  - 公众号: "2026年XX指南：N个关键点""XX避坑：N件事你必须知道"，品牌转化型，1500-3000字
  - 小红书: "XX测评，亲测有效""XX攻略，新手必看"，场景代入型，800-1500字，emoji点缀
  - 官网: "XX解决方案""XX产品技术白皮书"，权威背书型，2000-4000字
  - 豆包(字节): Q&A结构+移动端适配，标题精准匹配搜索query，2000-4000字，每节独立可引用
  - 元宝(腾讯): 指南/攻略型+微信公众号风格，实用导向，1500-3500字，嵌入微信生态术语
  - 千问(阿里): 技术深度+数据密集型，行业报告风格，2500-5000字，每数据标注来源+时间
  - DeepSeek: 逻辑分析+原创观点型，深度长文，3000-6000字，强调逻辑自洽和独立判断
  - 文心(百度): 百度SEO+GEO双优化，结构化数据标记，2000-5000字，FAQ schema友好
  共同GEO规则：(1)标题模拟真实搜索意图非教科书标题 (2)含具体数字如5个方法3大误区 (3)禁止泛化标题如"如何理解X：从基础到前沿" (4)每个title_direction必须含长尾关键词 (5)必须考虑AI搜索引擎的收录和引用需求 (6)平台为AI搜索平台时优先使用Q&A结构和确定性表述 严格输出JSON：{"strategy":"single_deep|cluster|hot_chase|matrix","articles":[{"id":"a1","title_direction":"2026年XX指南：5个关键选择标准","platform":"平台","content_form":"内容形态","word_count":2000,"status":"pending"}]}。每个指令至少生成1篇文章。指令：${JSON.stringify(ctx)}`;
      const d = await chatWithJSON<TaskData>([{role:'system',content:systemPrompt},{role:'user',content:'生成任务清单。'}],{temperature:0.3});
      if (!d?.articles?.length) {
        throw new Error('AI未返回有效的文章列表，请重试');
      }
      execute('DELETE FROM creation_tasks WHERE enterprise_id=?',[currentEnterprise.id]);
      const id = generateId('ct');
      execute('INSERT INTO creation_tasks (id,enterprise_id,instruction_id,task_json,status,created_at) VALUES (?,?,?,?,?,?)',[id,currentEnterprise.id,instrs[0]?.id||'',JSON.stringify(d),'pending',new Date().toISOString()]);
      await persistDatabase();
      setTask({id,enterprise_id:currentEnterprise.id,instruction_id:instrs[0]?.id||'',task_json:d,status:'pending',created_at:new Date().toISOString()});
    } catch(e:any) { setError(e.message); } finally { setLoading(false); }
  };

  const confirm = async () => { if(!task)return; execute('UPDATE creation_tasks SET status=? WHERE id=?',['in_progress',task.id]); await persistDatabase(); onNext(); };

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3"><span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">5</span><h2 className="text-base font-semibold text-gray-900">创作任务确认</h2>{task&&<span className="ml-auto text-xs text-gray-400">{task.task_json?.articles?.length || 0} 篇待生成</span>}</div>
        <p className="text-sm text-gray-400 mb-3">按覆盖策略生成任务清单。确认后不可回退。</p>
        <div className="flex gap-2"><button onClick={gen} disabled={loading||!instrs.length} className="btn-base btn-primary text-xs"><Target size={13}/>{loading?'生成中...':task?'重新生成':'生成任务清单'}</button><button onClick={onBack} className="btn-base btn-secondary text-xs"><ArrowLeft size={13}/>返回</button></div>
        {error&&<p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12}/>{error}</p>}
      </div>
      {task&&(<>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[{icon:Target,c:'text-indigo-600',l:'覆盖策略',v:STRAT[task.task_json?.strategy || 'single_deep']||task.task_json?.strategy || 'single_deep'},{icon:Gauge,c:'text-amber-600',l:'文章数量',v:`${task.task_json?.articles?.length || 0} 篇`},{icon:Zap,c:'text-emerald-600',l:'预计字数',v:`${(task.task_json?.articles||[]).reduce((s,a)=>s+a.word_count,0).toLocaleString()} 字`}].map((s,i)=><div key={i} className="card p-4"><s.icon size={18} className={s.c}/><div className="text-xs text-gray-400 mt-2">{s.l}</div><div className="text-base font-semibold mt-0.5 text-gray-900">{s.v}</div></div>)}
        </div>
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900">任务清单</h3><span className="text-xs text-gray-400 flex items-center gap-1"><Info size={11}/>确认后开始批量创作</span></div>
          {(task.task_json?.articles||[]).map((a:TaskArticle,i:number)=><div key={a.id} className="px-5 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50"><span className="text-xs text-gray-400 w-5">{i+1}</span><div className="flex-1 min-w-0"><p className="text-[13px] truncate text-gray-900">{a.title_direction}</p><div className="flex gap-2 mt-0.5"><span className="text-[11px] text-gray-400">{platformLabel(a.platform)}</span><span className="text-[11px] text-gray-400">{contentFormLabel(a.content_form)}</span><span className="text-[11px] text-gray-400">{a.word_count}字</span></div></div><span className={`badge ${a.status==='done'?'badge-green':a.status==='generating'?'badge-amber':'badge-gray'}`}>{a.status==='done'?'已完成':a.status==='generating'?'生成中':'待生成'}</span></div>)}
        </div>
        <div className="flex justify-between"><button onClick={onBack} className="btn-base btn-ghost text-xs"><ArrowLeft size={13}/>返回</button><button onClick={confirm} className="btn-base btn-success text-xs"><Check size={13}/>确认任务，开始创作 <ArrowRight size={13}/></button></div>
      </>)}
    </div>
  );
}
