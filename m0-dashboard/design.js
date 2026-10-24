'use strict';
const $ = id => document.getElementById(id);
const mutation = new MutationInput();
function workflowSupported() {
  return document.querySelector('input[name="purpose"]:checked').value==='snv' && $('molecule').value!=='RNA';
}
let result = null, revision = 0, controller = null;
$('backbone').textContent = window.PROBE.sequence.slice(18, 80);
const fixed = n => n.toFixed(1);
function clearResults() {
  revision++;
  if(typeof clearModuleSuggestions==='function') clearModuleSuggestions();
  if (controller) controller.abort();
  result = null;
  $('results').hidden = true;
  $('empty').hidden = false;
  if(typeof updateSettingsSummary==='function') updateSettingsSummary();
  $('generate').disabled = !mutation.ready || !workflowSupported();
  $('generate').textContent = '生成候选探针 ↗';
  $('status').className = 'status';
  $('status').textContent = '输入已修改，请重新生成。';
  $('versions').textContent = '';
}
$('design-form').addEventListener('input',event => {
  if(['module-context','variant-search'].includes(event.target.id)) return;
  clearResults();
  if(event.target.id==='wt') { mutation.setWT($('wt').value); drawBases(); }
  refreshMutation();
});
function fillExample(wt,position,alt) {
  clearResults(); $('wt').value=wt; mutation.setWT(wt);
  mutation.select(position); mutation.replace(alt); drawBases(); refreshMutation();
}
function drawBases() {
  const grid=$('mutation-grid'); grid.replaceChildren();
  $('sequence-count').textContent=mutation.validWT ? `${mutation.wt.length} nt · 5′ → 3′` : '';
  if(!mutation.validWT) return;
  [...mutation.wt].forEach((base,index)=>{
    const button=node('button',undefined,'mutation-base'); button.type='button';
    button.dataset.position=index+1;
    button.setAttribute('aria-label',`第 ${index+1} 位，${base}`);
    button.append(node('span',base),node('small',String(index+1)));
    button.addEventListener('click',()=>{
      mutation.select(index+1); clearResults(); refreshMutation();
    });
    grid.append(button);
  });
}
function refreshMutation() {
  const pos=mutation.position, ref=pos===null?null:mutation.wt[pos-1];
  $('mutation-help').textContent=mutation.problem || '已选定一个单碱基突变，可以生成候选探针。';
  $('mutation-summary').textContent=pos===null ? '② 点击一个碱基选择位置' : mutation.alt ? `第 ${pos} 位：${ref} → ${mutation.alt}` : `已选第 ${pos} 位：${ref}，要变成什么？`;
  $('mutation-summary').classList.toggle('chosen',Boolean(mutation.alt));
  for(const b of $('mutation-grid').children) {
    const selected=Number(b.dataset.position)===pos;
    b.disabled=document.querySelector('input[name="source-mode"]:checked').value==='library';
    b.classList.toggle('selected',selected); b.setAttribute('aria-pressed',String(selected));
  }
  for(const b of $('base-options').children) {
    b.disabled=pos===null || b.dataset.base===ref || document.querySelector('input[name="source-mode"]:checked').value==='library';
    b.setAttribute('aria-pressed',String(b.dataset.base===mutation.alt));
    b.title=b.dataset.base===ref?'这是 WT 原碱基，请选择其他碱基':'';
  }
  $('mut').value=mutation.mut;
  $('mutation-preview').replaceChildren();
  if(mutation.alt) {
    $('mutation-preview').append(document.createTextNode('Mut 5′ '+mutation.wt.slice(0,pos-1)),node('mark',mutation.alt),document.createTextNode(mutation.wt.slice(pos)+' 3′'));
  }
  $('mut-details').hidden=!mutation.mut;
  $('generate').disabled=!mutation.ready || !workflowSupported();
}
for(const base of 'ACGT') {
  const button=node('button',base,'base-option');button.type='button';button.dataset.base=base;
  button.setAttribute('aria-label',`替换为 ${base}`);
  button.addEventListener('click',()=>{mutation.replace(base);clearResults();refreshMutation();});
  $('base-options').append(button);
}
mutation.setWT($('wt').value);drawBases();refreshMutation();
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function visibleCandidates(data=result){return !data?[]:data.reference.matches_input?[...data.candidates,data.reference]:data.candidates;}
function render(data) {
  result = data;
  if(typeof updateModuleContext==='function') updateModuleContext(data);
  $('empty').hidden = true;
  $('results').hidden = false;
  const v = data.variant, input = data.input;
  $('result-title').textContent = `${data.context?.name || '自定义靶标'}`;
  $('result-description').textContent = `识别臂枚举 ${data.counts.arms_enumerated}，Tm条件通过 ${data.counts.thermal_pass}，零边界延伸通过 ${data.counts.boundary_pass}，最终推荐 ${data.counts.selected}；参考 ${input.tm5_goal} / ${input.tm3_goal}°C，探针 ${input.probe_nm} nM；总 Mg ${input.mg_mm} mM，K ${input.k_mm} mM，连接温度 ${input.temperature_c}°C。`;
  if(data.joint_design) $('result-description').textContent+=` 联合评估 ${data.joint_design.evaluated} 套，输出 ${data.candidates.length} 套配套计算推荐；读出温度 ${data.joint_design.readout_temperature_C}°C。`;
  const map = $('variant-map'); map.replaceChildren();
  map.append(node('b', `靶标第 ${v.position} 位：${v.wt} → ${v.mut} · 识别碱基位于探针 3′ 最末端`), node('br'));
  const start = Math.max(0,v.position-31), end = Math.min(input.mut.length,v.position+30);
  const code = node('code');
  code.append(document.createTextNode(`5′ ${start ? '…' : ''}${input.mut.slice(start,v.position-1)}`),node('mark',v.mut),document.createTextNode(`${input.mut.slice(v.position,end)}${end<input.mut.length?'…':''} 3′`));
  map.append(code);
  const close = data.candidates.filter(c => c.within_5c).length;
  $('result-warning').textContent = !data.candidates.length ? '未找到两侧Spacer均无延伸配对的自动候选；可改用联合设计调整Spacer边界。原实验方案仍保留作参考。' : (data.joint_design?`${data.candidates.length}套联合计算推荐 · 新模块需配套使用并验证`:'计算推荐 · 尚未实验验证');
  $('comparison').replaceChildren();
  [...data.candidates.filter(c=>c!==data.reference),data.reference].forEach(c => {
    const tr = node('tr',undefined,c===data.reference?'reference':'');
    [c===data.reference?'原 91 nt 探针':c.id,`${c.length5} / ${c.length3}`,`${fixed(c.tm5)} / ${fixed(c.tm3)}`,fixed(c.tm_deviation),`${fixed(c.fold.mean_unpaired5*100)} / ${fixed(c.fold.mean_unpaired3*100)}`].forEach(text => tr.append(node('td',text)));
    $('comparison').append(tr);
  });
  $('reference-note').textContent = data.reference.matches_input ? '原探针可匹配本次 Mut 位点；以上原探针数值也按本次浓度重新计算，可直接比较。' : '原探针属于历史参考，不能按本次位点的匹配探针使用；表中仅比较其固有臂 Tm 与自折叠。';
  $('candidate-cards').replaceChildren();
  visibleCandidates(data).forEach(c => {
    const card = node('article',undefined,'candidate'), top = node('div',undefined,'cardtop');
    card.dataset.candidate=c.id;
    const heading = node('h3',`${data.context?.name || '自定义靶标'} · ${c.id} · ${c.sequence.length} nt`);
    heading.append(node('span',c.is_reference_sequence?'与原探针序列相同':c.within_5c?'两臂均接近目标':'Tm 距目标较远','tag'));
    const copy = node('button','复制完整序列','btn'); copy.type='button';
    copy.addEventListener('click',async () => {
      try { await navigator.clipboard.writeText(c.sequence); copy.textContent='已复制'; }
      catch { copy.textContent='请选中下方序列复制'; }
    });
    top.append(heading,copy);
    const sequence = node('div',undefined,'sequence');
    for(const r of probeRegions(c,data)){const span=paintRegion(node('span',r.sequence),r.key);span.title=r.label;sequence.append(span);}
    const info = node('p',`识别臂 ${c.length5} / ${c.length3} nt · 靶标位置 ${c.target5.join('–')} / ${c.target3.join('–')}`);
    const reason = node('p','5′ 磷酸化 · 复制序列不含修饰代码');
    const sequenceDetails=node('details',undefined,'sequence-details');sequenceDetails.append(node('summary','完整序列与修饰'),sequence,info,reason);
    if(c.structural_screen)card.append(node('p',`${c.recommendation_label||'结构候选'} · B: ${c.modules.settings.linker_b} · primer ${fixed(c.structural_screen.rca_paired*100)}% / gRNA ${fixed(c.structural_screen.cas_paired*100)}% 自身配对（${c.structural_screen.temperature_C}°C）`));
    if(c.interactions){const review=c.interactions.checks.filter(v=>v.review);card.append(node('p',review.length?`交叉互补复核提示：${review.map(v=>v.id+' '+v.max_complement_nt+' nt').join('；')}。短互补不是已证实干扰。`:'完整寡核苷酸精确互补检查通过8nt筛选；不代表实验无干扰。','interaction-summary'));}
    const rationale=node('p',`${c.recommendation_label||"设计依据"}：左侧抓取、右侧连接端判别；两臂 Tm ${fixed(c.tm5)} / ${fixed(c.tm3)}°C，参考 ${input.tm5_goal} / ${input.tm3_goal}°C。`,'candidate-rationale');
    const m=c.modules||data.modules;
    const paired=node('details',undefined,'sequence-details');paired.append(node('summary','配套 primer / 完整 crRNA'));
    paired.append(node('pre',`RCA primer · DNA · 5′ → 3′\n${m.settings.primer}\n\nLbaCas12a crRNA · RNA · 5′ → 3′\n${m.crrna}`,'sequence'));
    const copyPair=node('button','复制配套序列','btn');copyPair.type='button';copyPair.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(`>RCA_primer\n${m.settings.primer}\n>LbaCas12a_crRNA\n${m.crrna}\n`);copyPair.textContent='已复制';}catch{copyPair.textContent='请选中序列复制';}});paired.append(copyPair);
    if(c.joint_metrics){const q=c.joint_metrics;paired.append(node('p',`primer Tm ${fixed(q.primer_Tm_C)}°C（500nM，单价盐，无镁）；完整crRNA spacer开放 ${fixed(100*q.crrna_spacer_open)}%（${q.crrna_model}，未模拟RNP）。`));}
    card.append(top,rationale,candidateExplanation(c,data),sequenceDetails,paired); $('candidate-cards').append(card);
  });
  if(typeof setupCandidateWorkspace==='function') setupCandidateWorkspace(data);
  $('fasta-export').disabled = !data.candidates.length;
  $('versions').textContent = `本次计算：${data.models.tm}；${data.models.fold}。时间 ${new Date(data.created_utc).toLocaleString()}。`;
}
$('design-form').addEventListener('submit',async event => {
  event.preventDefault(); clearResults();
  if(!workflowSupported() || !mutation.ready) { $('status').textContent=workflowSupported()?mutation.problem:'当前模式仅供流程预览，尚不支持计算。'; return; }
  const current = revision;
  controller = new AbortController();
  const input = Object.fromEntries(new FormData(event.target));
  input.wt=mutation.wt; input.mut=mutation.mut;
  input.modules=readModules();
  input.fixed_arms=$('fixed-arms').checked;
  input.joint_design=$('design-mode').value==='joint';
  input.readout_temperature_c=Number($('readout-temperature').value);
  input.readout_monovalent_mm=Number($('readout-salt').value);
  const context={name:$('target-name').value.trim(),organism:$('organism').value.trim(),molecule:$('molecule').value,purpose:document.querySelector('input[name="purpose"]:checked').value,source:document.querySelector('input[name="source-mode"]:checked').value};
  if(context.source==='library') context.catalog=currentVariant();
  $('generate').disabled = true; $('generate').textContent = '正在计算…';
  $('status').textContent = input.joint_design?'正在联合筛选识别臂、新 primer 和完整 crRNA…':'正在枚举识别臂并计算 Tm、自折叠…';
  try {
    const response=await fetch('/api/design',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal});
    if (!(response.headers.get('content-type')||'').includes('application/json')) throw new Error('当前是静态预览，请启动本地计算服务后打开 design.html（见 README）。');
    const data=await response.json();
    if (!response.ok) throw new Error(data.error||'计算请求失败。');
    if (current!==revision) return;
    data.context=context; render(data); $('status').textContent = '计算完成。';
    if(!document.body.classList.contains('studio')) $('results').scrollIntoView({behavior:'smooth',block:'start'});
  } catch(error) {
    if (error.name==='AbortError' || current!==revision) return;
    $('status').className='status error';
    $('status').textContent=error instanceof TypeError ? '无法连接计算服务。请按 README 启动服务，并从本机网址打开本页。' : error.message;
  } finally {
    if (current===revision) { $('generate').disabled=!mutation.ready || !workflowSupported(); $('generate').textContent='生成候选探针 ↗'; }
  }
});
function download(filename, contents, mime) {
  const url=URL.createObjectURL(new Blob([contents],{type:mime}));
  const a=node('a'); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('json-export').addEventListener('click',()=> { if(result) download('padlock-candidates.json',JSON.stringify(result,null,2),'application/json'); });
$('fasta-export').addEventListener('click',()=> { if(result) download('padlock-candidates.fasta',visibleCandidates(result).map(c=>{const m=c.modules||result.modules;return `>${c.id}_padlock ${c.is_experimental_reference?'experimental_reference':'computed_unvalidated'} DNA_5to3 5prime_phosphate_required\n${c.sequence}\n>${c.id}_RCA_primer DNA_5to3\n${m.settings.primer}\n>${c.id}_LbaCas12a_crRNA RNA_5to3\n${m.crrna}\n`;}).join(''),'text/plain'); });
fetch('/api/health').then(async response=> {
  if(!response.ok) throw new Error();
  const data=await response.json(); if(data.service!=='padlock-m1') throw new Error();
  $('service').textContent='● 本地计算服务已连接';
}).catch(()=>{$('service').textContent='服务未连接 · 请按 README 启动计算服务';});

for(const id of ['design-mode','readout-temperature','readout-salt'])$(id).addEventListener('input',()=>{clearResults();if(typeof saveDraft==='function')saveDraft();});
