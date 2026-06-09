import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Sparkles, Check, AlertTriangle, FileText, Copy, Shield } from 'lucide-react';
import { useEnterprise } from '../../store/enterprise';
import { generateId, queryAll, queryOne, execute, persistDatabase } from '../../db';
import { chat, hasApiKey } from '../../services/ai';
import { platformLabel } from '../../utils/labels';
import type { CreationTask, Article, WritingInstruction, CompanyProfile, ComplianceResult, CitationSignalStat } from '../../types';

interface Props { onBack: () => void; }

export default function BatchCreate({ onBack }: Props) {
  const { currentEnterprise } = useEnterprise();
  const [task, setTask] = useState<CreationTask|null>(null);
  const [instrs, setInstrs] = useState<WritingInstruction[]>([]);
  const [profile, setProfile] = useState<CompanyProfile|null>(null);
  const [gen, setGen] = useState(false);
  const [idx, setIdx] = useState(-1);
  const [error, setError] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [sel, setSel] = useState<Article|null>(null);

  useEffect(() => {
    if (!currentEnterprise) return;
    const ts = queryAll<CreationTask>('SELECT * FROM creation_tasks WHERE enterprise_id=? ORDER BY created_at DESC LIMIT 1',[currentEnterprise.id]);
    if (ts.length) {
      const t = ts[0];
      if (typeof t.task_json === 'string') {
        try { t.task_json = JSON.parse(t.task_json); } catch {}
      }
      setTask(t);
    }
    const is = queryAll<WritingInstruction>('SELECT * FROM writing_instructions WHERE enterprise_id=?',[currentEnterprise.id]);
    for (const i of is) {
      if (typeof i.instruction_json === 'string') {
        try { i.instruction_json = JSON.parse(i.instruction_json); } catch {}
      }
    }
    setInstrs(is);
    const cp = queryOne<CompanyProfile>('SELECT * FROM company_profiles WHERE enterprise_id=? AND status=?',[currentEnterprise.id,'locked']);
    if (cp && typeof cp.profile_json === 'string') {
      try { cp.profile_json = JSON.parse(cp.profile_json); } catch {}
    }
    setProfile(cp);
    const as = queryAll<Article>('SELECT * FROM articles WHERE enterprise_id=? ORDER BY generated_at DESC',[currentEnterprise.id]);
    for (const a of as) {
      if (typeof a.citation_signals === 'string') {
        try { a.citation_signals = JSON.parse(a.citation_signals); } catch {}
      }
      if (typeof a.compliance === 'string') {
        try { a.compliance = JSON.parse(a.compliance); } catch {}
      }
    }
    setArticles(as);
  }, [currentEnterprise]);

  const compliance = useCallback((text:string):ComplianceResult=>{
    const rules=[{p:/(绝对|一定|肯定|100%)/g,r:'据现有数据',s:'auto_replace' as const},{p:/(最好|最强|第一|唯一|顶级|领先|独家)/g,r:'',s:'warn' as const}];
    const issues=rules.flatMap(r=>{const m=text.match(r.p);return m?[{severity:r.s,pattern:r.p.source,found:m.join(', '),replacement:r.r||undefined,resolved:r.s==='auto_replace'}]:[];});
    return {passed:!issues.filter(i=>!i.resolved).length,issues};
  },[]);

  const signals=(text:string):CitationSignalStat=>({data_point:(text.match(/数据|统计|据|%|\d+%/g)||[]).length,authority_citation:(text.match(/据.*研究|据.*报告|.*认证|.*专利/g)||[]).length,case_study:(text.match(/案例|项目|实例|客户/g)||[]).length,step_by_step:(text.match(/步骤|第一步|第二步|首先.*然后/g)||[]).length,comparison:(text.match(/对比|相比|vs|VS|优于/g)||[]).length,risk_warning:(text.match(/风险|注意|避免|防止|隐患/g)||[]).length});

  const run = async () => {
    if (!hasApiKey()) { setError('请先设置 API Key'); return; }
    if (!task||!currentEnterprise) return;
    setGen(true); setError('');
    const pd = (profile?.profile_json as Record<string,any>) || {};
    const na:Article[]=[];
    for (let i=0;i<(task?.task_json?.articles||[]).length;i++) {
      const ta=task.task_json?.articles?.[i]; setIdx(i);
      try {
        const body = await chat([{role:'system',content:`你是GEO优化内容创作专家，专精于中国主流AI搜索引擎（豆包/元宝/千问/文心/DeepSeek）的内容收录优化。为「${pd.company_name||''}」创作关于「${ta.title_direction}」的GEO优化文章。
平台${ta.platform}，内容形态${ta.content_form}，目标${ta.word_count}字，行业${pd.industry||''}。
输出完整Markdown，严格遵循以下规则：

【标题GEO规则】
${ta.platform==='zhihu'?'以"如何看待""为什么""有哪些"开头的深度问题式标题，含具体数据和对比角度':
ta.platform==='wechat'?'带数字的指南式标题如"2026年XX指南：5个关键选择"，突出实用价值':
ta.platform==='xiaohongshu'?'场景测评式标题如"XX测评：亲测3个月的真实体验""XX攻略，新手必看"，口语化+emoji':
ta.platform==='website'?'权威白皮书式标题如"XX技术白皮书""XX解决方案全景图"，突出专业性和行业地位':
'遵循以下AI搜索平台标题规则：1)标题含具体问题关键词，能被独立作为AI摘要 2)覆盖长尾搜索意图 3)格式参考"XX是什么意思？完整指南""XX和YY哪个好？数据对比""XX怎么做？从入门到精通"'}
所有平台通用GEO规则：模拟用户真实搜索意图、含长尾关键词和具体数字、禁止教科书式标题

【正文GEO结构】
1. 开头100字：直接给出核心答案/结论（适配AI搜索的Featured Snippet抓取），如"据XX数据显示...""XX的核心在于..."
2. 正文使用H2/H3分层，每个H2标题是用户可能搜索的具体问题（Q&A结构），便于AI按段落独立提取信息
3. 每段首句为核心信息点，确保AI直接引用，每个H2段落信息完整不依赖上下文
4. 含至少3种引用信号：1个权威数据+来源、1个行业案例、1个对比分析
5. 结尾附总结和行动建议

【五大AI搜索引擎抓取与引用机制】
豆包（字节跳动）：偏好结构化Q&A内容，优先抓取H2标题作为独立答案；移动端阅读体验权重高；对微信公众号生态内容有额外加权；标题中精准匹配搜索query的引用率显著提升
元宝（腾讯）：微信搜一搜+公众号内容权重最高；偏好"指南""攻略""避坑"类实用型内容；社交传播数据（阅读/点赞）影响推荐排序；内容中嵌入微信生态内常见术语可提升收录概率
千问（阿里）：技术深度型内容优先；数据密集型文章引用率最高；行业报告、白皮书类内容有专门抓取通道；偏好完整解决方案而非碎片化信息
DeepSeek：逻辑严密的分析推理型内容优先；偏好原创观点和独立判断；对数学/代码/技术细节有高权重；文章内部逻辑自洽性直接影响引用可信度；长文深度分析引用率高于短文
文心（百度）：百度搜索索引直接关联，百度SEO规则叠加AI引用逻辑；权威域名和外部链接影响抓取频次；结构化数据标记（如FAQ schema）显著提升引用率；中文语境理解最强，口语化/修辞型内容也可准确提取

【AI搜索GEO实战规则】
1. 「首段即答案」：开头100字必须是可直接作为AI摘要的完整结论，格式为「主体+核心观点+关键数据」。如"据中国信通院2025年报告，XX行业市场规模达XXX亿元，年复合增长率XX%，核心驱动力在于..."
2. 「H2即问题」：每个H2标题必须是用户可能向AI搜索提出的完整问题，如"XX行业2026年市场规模有多大？""XX技术相比YY有什么优势？""XX方案的落地成本是多少？"
3. 「段落自包含」：每个H2下的内容自成体系（背景-分析-数据-结论），AI只抓取某一节时信息不丢失不扭曲
4. 「数据三要素」：每个关键数据必须同时包含（具体数值+权威来源+时间节点），如"据IDC2025年Q3报告，中国AI市场规模达XXX亿元"
5. 「术语自带解释」：专业术语首次出现时用括号给出通俗解释，AI引用时会自动附带定义，如"NLP（自然语言处理，即让计算机理解人类语言的技术）"
6. 「确定性优先」：避免"可能、大概、或许、一般来说"，改用"数据显示、报告指出、案例表明、实测结果"
7. 「列表与对比」：用编号列表或对比表格呈现多维度信息，AI引擎对结构化数据的引用率比纯叙述文本高2-3倍
8. 「时效性信号」：明确标注时间节点（"截至2026年6月""2025全年数据显示"），AI优先引用有时效标记的内容

【时效性专项规则——AI搜索引擎最核心的排序因子】
豆包和文心对内容时效性权重极高，过期内容引用率断崖式下降。生成文章时必须满足：
1. 标题含年份：标题必须包含"2026年"或"2025-2026"，如"2026年XX行业全景分析""2025-2026年XX技术演进趋势"
2. 数据更新到最近：所有引用的数据优先使用2025-2026年最新报告，不得使用2023年以前的数据（除非是历史对比基准）
3. 趋势描述精确到季度：不写"近年来、最近"，写"2025年Q4以来""2026年上半年"
4. 政策法规同步：涉及政策内容必须与最新法规保持一致（2026年现行有效版本）
5. 技术版本号：涉及技术产品时标注版本号和发布时间，如"GPT-4o（2024年5月发布）""DeepSeek-V3（2025年12月发布）"
6. 新闻事件引用：引用近6个月内的事件，超过1年的需标注"回顾"且不作为核心论据
7. 每年数据对比：关键指标给出至少2年对比（如"2024年→2025年→2026年预测"），体现趋势而非单点

【引用信号嵌入策略】
- 权威来源：政府部门数据（国家统计局、工信部）、行业协会报告、上市公司财报、知名咨询机构（IDC/Gartner/艾瑞）
- 案例引用：具名企业+具体场景+可量化成果+时间，如"三一重工2025年在长沙工厂部署AI质检后，次品率从3.2%降至0.5%"
- 对比分析：横向对比至少2个方案/产品/数据，用"相比XX...YY的优势在于..."句式
- 信号句式：据XX报告显示、XX企业实际数据显示、对比XX与YY、以XX为例

【合规红线——极限词不删，但必须用合规替代表述】
以下极限词不能直接使用，但表达相同意思有合规写法。写作时自动替换：
最好 → 更优、值得推荐、表现出色 | 最强 → 性能突出、表现卓越、领先水平
第一 → 位居前列、领先梯队、头部阵营 | 唯一 → 为数不多、独家（需有资质证明）
100% → 绝大多数、接近全覆盖、近乎全部 | 顶级 → 行业标杆、一线水准、高标准
绝对 → 数据表明、实测显示、业界公认 | 最全 → 覆盖XX个场景、涵盖主流方案
全网 → 在XX平台、在主流渠道 | 领先 → 具备优势、处于前列、表现突出
国家级 → 省部级重点（无国家级资质时用） | 独家 → 自有技术/自研（需有事实支撑）

违禁词替换（承诺性/诱导性用语）：
包过、必过 → 通过率高、成功率可观 | 稳赚、零风险 → 风险可控、回报稳定
保证、绝对有效 → 实测有效、数据支持 | 治愈 → 改善、缓解、有效辅助

数字表述规范：
百分比写"约XX%""超过XX%"而非精确到小数点，排名写"位居前列"而非"第一"

敏感领域主题禁止：医疗功效断言、金融收益承诺、政治敏感话题

【去AI味——让文章读起来像资深编辑写的，不是AI生成的】
1. 禁用AI标志性开头：不得用"在当今...时代背景下""随着...的发展""众所周知""近年来"开篇。直接切入：一个具体场景、一个反常识数据、一个真实问题
2. 禁用AI过渡句式：不得用"首先...其次...再次...最后""综上所述""总而言之""值得注意的是""不可否认"等机械连接词。段落间用内容自然衔接，如"但真正的问题在于...""这背后还有一个被忽略的细节..."
3. 句子要有呼吸感：长短句交替，最长的句子不超过40字。每200字至少一次短句（5字以内）打破节奏
4. 加入编辑口吻：适当使用"你可能会问""说实话""一个扎心的事实""这里有个坑""别急，往下看"等对话式表达
5. 观点要有锋芒：不要"一方面...另一方面"的骑墙表述。给出明确判断，如"我的结论是...""这条路径行不通，原因有三"
6. 去模板化：每篇文章的结构不能雷同。如果上一篇是"现象→原因→方案"，这一篇就换成"故事→数据→反思→行动"
7. 适当不完美：允许口语化表达、真实感叹（"这个数据确实让人意外"）、甚至可控的争议性观点。完美无瑕=AI写的
绝对化用语（最/第一/100%/唯一/绝对）、空洞套话（赋能/抓手/闭环/底层逻辑/降本增效）、无来源的断言、抄袭式洗稿、没有具体数据的泛泛而谈`},{role:'user',content:`生成标题为《${ta.title_direction}》的文章`}]);
        const title=(body.match(/^#\s+(.+)/m)||[ta.title_direction])[1];
        const comp=compliance(body); const sig=signals(body);
        const id=generateId('art');const now=new Date().toISOString();
        const art:Article={id,enterprise_id:currentEnterprise.id,task_id:task.id,title,body_markdown:body,word_count:body.length,platform:ta.platform,content_form:ta.content_form,question_anchor:ta.title_direction,tags:[],version:1,status:'draft',citations_embedded:[],citation_signals:sig,compliance:comp,generated_at:now,modified_at:now,language:'zh-CN'};
        execute('INSERT INTO articles (id,enterprise_id,task_id,title,body_markdown,word_count,platform,content_form,question_anchor,tags,version,status,citations_embedded,citation_signals,compliance,generated_at,modified_at,language) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[art.id,art.enterprise_id,art.task_id,art.title,art.body_markdown,art.word_count,art.platform,art.content_form,art.question_anchor,'[]',art.version,art.status,'[]',JSON.stringify(sig),JSON.stringify(comp),art.generated_at,art.modified_at,art.language]);
        await persistDatabase(); na.push(art);
      } catch(e:any) { setError(`第${i+1}篇: ${e.message}`); }
    }
    setArticles(p=>[...na,...p]); setGen(false); setIdx(-1);
    if(task) { execute('UPDATE creation_tasks SET status=? WHERE id=?',['completed',task.id]); await persistDatabase(); }
  };

  const allDone = (task?.task_json?.articles||[]).every((a:any)=>a.status==='done');

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3"><span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">6</span><h2 className="text-base font-semibold text-gray-900">AI 批量创作</h2>{task&&<span className="ml-auto text-xs text-gray-400">{(task.task_json?.articles||[]).filter(a=>a.status==='done').length}/{(task.task_json?.articles||[]).length} 完成</span>}</div>
        <p className="text-sm text-gray-400 mb-3">无状态调用：每篇独立生成，自动嵌入引用信号、合规审查。</p>
        <div className="flex gap-2"><button onClick={run} disabled={gen||!task||allDone} className="btn-base btn-primary text-xs"><Sparkles size={13}/>{gen?`生成中 (${idx+1}/${(task?.task_json?.articles||[]).length})...`:allDone?'全部已完成':'一键批量生成'}</button><button onClick={onBack} className="btn-base btn-secondary text-xs"><ArrowLeft size={13}/>返回</button></div>
        {gen&&<div className="mt-3 w-full bg-gray-100 rounded-full h-1.5"><div className="bg-indigo-600 h-full rounded-full transition-all" style={{width:`${((idx+1)/((task?.task_json?.articles||[]).length||1))*100}%`}}/></div>}
        {error&&<p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12}/>{error}</p>}
      </div>
      {articles.length>0&&<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-1.5 max-h-[70vh] overflow-y-auto"><p className="text-xs text-gray-400 mb-1 px-1">已生成 ({articles.length})</p>
          {articles.map(a=><button key={a.id} onClick={()=>setSel(a)} className={`w-full text-left p-3 rounded-xl border transition-all ${sel?.id===a.id?'border-indigo-300 bg-indigo-50/30':'border-gray-200 bg-white hover:border-gray-300'}`}><div className="flex items-center gap-2"><FileText size={13} className="text-gray-400"/><span className="text-xs truncate">{a.title}</span></div><div className="flex items-center gap-1.5 mt-1.5"><span className="text-[10px] text-gray-400">{platformLabel(a.platform)}</span><span className="text-[10px] text-gray-400">{a.word_count}字</span>{a.compliance.passed?<span className="badge-green">合规</span>:<span className="badge-red">待审查</span>}</div></button>)}
        </div>
        <div className="lg:col-span-2">
          {sel?<div className="card overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900 truncate max-w-[300px]">{sel.title}</h3><button onClick={()=>navigator.clipboard.writeText(sel.body_markdown)} className="btn-base btn-ghost text-xs py-1"><Copy size={11}/>复制</button></div>
            <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center"><Shield size={13} className="text-indigo-500"/><span className="text-xs font-medium text-gray-500">引用信号：</span>{Object.entries(sel.citation_signals).map(([k,v])=><span key={k} className="badge-purple">{k}:{v as number}</span>)}</div>
            {sel.compliance.issues.length>0&&<div className="px-5 py-3 border-b border-gray-100"><span className="text-xs font-medium text-gray-500">合规审查：</span>{sel.compliance.issues.map((iss,i)=><div key={i} className={`flex items-center gap-1.5 text-xs mt-1 ${iss.resolved?'text-emerald-600':'text-amber-600'}`}>{iss.resolved?<Check size={11}/>:<AlertTriangle size={11}/>}{iss.found}{iss.replacement?` → ${iss.replacement}`:''}</div>)}</div>}
            <div className="p-5 max-h-[50vh] overflow-y-auto"><div className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{sel.body_markdown}</div></div>
          </div>:<div className="card flex items-center justify-center h-40 text-sm text-gray-400">选择左侧文章查看预览</div>}
        </div>
      </div>}
    </div>
  );
}
