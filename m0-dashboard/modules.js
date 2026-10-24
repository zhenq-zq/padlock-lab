'use strict';
const moduleDefaults={primer:'ATCGATGGTTAGGGTATCT',guide:'GGUAGUCAGUUCCUAGGUGCAGU',linker_a:'TCCTC',linker_b:'GTCAGTACGT',linker_c:'TCTTT',zone_count:1,zone_linkers:''};
const experimentalMultiCas=new URLSearchParams(location.search).get('experimental')==='multicas';
const moduleStorageKey=experimentalMultiCas?'padlock-modules-v1':'padlock-modules-single-zone-v1';
let moduleRequest=0;
function readModules(){return Object.fromEntries(Object.keys(moduleDefaults).map(key=>[key,key==='zone_count'?Number($('module-'+key).value):(key==='guide'?$('module-'+key).value.replace(/\s+/g,'').toUpperCase().replaceAll('T','U'):$('module-'+key).value.replace(/\s+/g,'').toUpperCase())]));}
function moduleDraft(){try{localStorage.setItem(moduleStorageKey,JSON.stringify(readModules()));}catch{} }
function drawModuleMap(){
  const m=readModules();$('module-map').replaceChildren();
  for(const key of ['primer','guide','linker_a']) {
    const label=key==='linker_a'?'连接区':REGION_COLORS[key].label;
    const block=paintRegion(node('button',key==='linker_a'?`连接区 A/B/C · ${m.linker_a.length}/${m.linker_b.length}/${m.linker_c.length} nt`:`${label} · ${m[key].length} nt`),key);block.type='button';block.addEventListener('click',()=>openModuleEditor(key,$('module-context').value));$('module-map').append(block);
  }
  for(const key of ['primer','guide','linker_a','linker_b','linker_c']){
    const input=$('module-'+key);let badge=$('length-'+key);
    if(!badge){badge=node('small',undefined,'muted');badge.id='length-'+key;input.after(badge);}
    badge.textContent=`${m[key].length} nt${key==='guide'?` / zone · ${m.zone_count} zones · 完整 gRNA ${21+m.guide.length} nt（RNA导出）`:''}`;
  }
  let gapBadge=$('length-zone-gaps');if(!gapBadge){gapBadge=node('small',undefined,'muted');gapBadge.id='length-zone-gaps';$('module-zone_linkers').after(gapBadge);}
  gapBadge.textContent=m.zone_linkers?m.zone_linkers.split(',').map((g,i)=>`间隔 ${i+1} · ${g.length} nt`).join(' · '):'无重复区间隔';
  for(const key of Object.keys(moduleDefaults).filter(k=>REGION_COLORS[k]))$('module-'+key).style.borderLeft=`3px solid ${REGION_COLORS[key].color}`;
}
function clearModuleSuggestions(){
  moduleRequest++;$('module-pairing').hidden=true;$('module-suggestions').replaceChildren();$('module-status').textContent='重新生成候选后可查看模块建议。';
  for(const b of document.querySelectorAll('.recommend-module'))b.disabled=true;
  $('module-context').replaceChildren(new Option('请先生成候选',''));
}
function updateModuleContext(data){
  const m=data.modules,comp=seq=>[...seq.replaceAll('U','T')].map(b=>({A:'T',T:'A',G:'C',C:'G'})[b]).join('');
  $('module-pairing').hidden=false;$('module-pairing-content').replaceChildren();
  const primer=paintRegion(node('pre',`Primer  5′ ${m.settings.primer} 3′\nPadlock 3′ ${comp(m.settings.primer)} 5′`,'sequence'),'primer');
  const guide=paintRegion(node('pre',`Cas 编码 5′ ${m.settings.guide.replaceAll('U','T')} 3′\nRCA     3′ ${comp(m.settings.guide)} 5′`,'sequence'),'guide');
  const cr=node('p',undefined,'sequence');cr.append(document.createTextNode(`完整 gRNA · 5′ ${m.crrna.slice(0,-m.settings.guide.length)}`),paintRegion(node('span',m.settings.guide),'guide'),document.createTextNode(' 3′'));
  $('module-pairing-content').append(primer,guide,cr);

  $('module-context').replaceChildren();
  for(const c of visibleCandidates(data))$('module-context').append(new Option(`${c.id} · ${c.length5}/${c.length3} nt`,c.id));
  for(const b of document.querySelectorAll('.recommend-module'))b.disabled=!visibleCandidates(data).length;
  $('module-status').textContent=visibleCandidates(data).length?'可查看此探针的模块建议。':'请先生成候选。';
}
function fillModules(m){for(const key of Object.keys(moduleDefaults))$('module-'+key).value=key==='guide'?m[key].replaceAll('U','T'):m[key];drawModuleMap();moduleDraft();}
let initialModules={...moduleDefaults};
try{const saved=JSON.parse(localStorage.getItem(moduleStorageKey)||'null');if(saved)for(const key of Object.keys(moduleDefaults))if(typeof saved[key]===typeof moduleDefaults[key])initialModules[key]=saved[key];}catch{}
if(initialModules.linker_a==='CTC')initialModules.linker_a='TCCTC';
if(!experimentalMultiCas){initialModules.zone_count=1;initialModules.zone_linkers='';}
fillModules(initialModules);clearModuleSuggestions();
if(!experimentalMultiCas){
 for(const id of ['module-zone_count','module-zone_linkers','own-cas3-spacer','lin-preset']){
  $(id).style.display='none';
  document.querySelector(`label[for="${id}"]`)?.style.setProperty('display','none');
 }
 $('length-zone-gaps')?.style.setProperty('display','none');
}
for(const key of Object.keys(moduleDefaults))$('module-'+key).addEventListener('input',()=>{if(key==='guide')$('module-'+key).value=$('module-'+key).value.replace(/[uU]/g,'T');drawModuleMap();moduleDraft();});
$('restore-modules').addEventListener('click',()=>{fillModules(moduleDefaults);clearResults();$('module-status').textContent='已恢复原模块；请重新生成。';});
$('module-context').addEventListener('change',()=>{moduleRequest++;$('module-suggestions').replaceChildren();$('module-status').textContent='所用探针已更新。';});
for(const button of document.querySelectorAll('.recommend-module'))button.addEventListener('click',async()=>{
  if(!result)return;
  const c=visibleCandidates(result).find(c=>c.id===$('module-context').value);if(!c)return;
  const request=++moduleRequest,currentRevision=revision;
  $('module-suggestions').replaceChildren();$('module-status').textContent='正在比较结构…';
  try {
    const response=await fetch('/api/modules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({temperature_c:Number($('readout-temperature').value),monovalent_mm:Number($('readout-salt').value),kind:button.dataset.kind,arm5:c.arm5,arm3:c.arm3,modules:c.modules?.settings||readModules()})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'计算失败');
    if(request!==moduleRequest||revision!==currentRevision)return;
    $('module-status').textContent=`${c.id} · ${data.screened} 个方案 · ${data.model.temperature_C}°C · Na⁺+K⁺ ${data.model.monovalent_mM} mM · 无镁结构初筛`;
    const key={rca:'primer',cas:'guide',linker:'linker_b'}[data.kind];
    const reasons={
      rca:'保留现有引物的 3′ 端；按探针上引物位点较少被自身折叠占用的顺序排列。',
      cas:'沿用 Lba Cas12a 和现有 Cas12a 编码区的 5′ 端；按 RCA 产物上识别区较少被自身折叠占用的顺序排列。',
      linker:'保持连接区 B 的长度与碱基组成；优先照顾 primer、Cas 两处中自身折叠占用较多的一处。'
    };
    $('module-suggestions').append(node('p',reasons[data.kind],'module-reason'));
    $('module-suggestions').append(node('small',`依据：实验设置 ${data.model.temperature_C}°C、Na⁺+K⁺ ${data.model.monovalent_mM} mM；Mg²⁺/Tris 未建模。`,'muted'));
    data.candidates.forEach((row,i)=>{
      const card=node('div',undefined,'module-option');
      card.append(node('b',`${i+1} · ${row.is_current?'当前方案':'结构候选'}`),paintRegion(node('code',key==='guide'?row.settings[key].replaceAll('U','T'):row.settings[key]),key),node('small',`${row.settings[key].length} nt · ${row.is_current?'沿用当前序列':'可选序列'}`));
      const evidence=node('details',undefined,'module-evidence');
      evidence.append(node('summary','计算依据'),node('p',`位点自身配对：primer ${fixed(row.rca_paired*100)}% · Cas ${fixed(row.cas_paired*100)}%。按本次候选池排序，主指标相同时按两区平均值排序。`));
      card.append(evidence);
      const use=node('button',row.is_current?'当前':'应用','btn');use.type='button';use.disabled=row.is_current;
      use.addEventListener('click',()=>{fillModules(row.settings);clearResults();$('module-status').textContent='已应用；重新生成以更新整条探针。';});card.append(use);$('module-suggestions').append(card);
    });
  }catch(error){if(request===moduleRequest&&revision===currentRevision)$('module-status').textContent=error.message;}
});
$('module-export').addEventListener('click',()=>{
  if(!result?.modules)return;
  const chosen=visibleCandidates(result).find(c=>c.id===$('module-context').value);
  const m=chosen?.modules||result.modules;
  download('padlock-companion-oligos.fasta',`>RCA_primer DNA 5to3\n${m.settings.primer}\n>Lba_Cas12a_crRNA RNA 5to3 computed_not_validated\n${m.crrna}\n`,'text/plain');
});

$('module-zone_count').addEventListener('change',()=>{
  $('module-zone_linkers').value=['CCT','AAC','CCT','AAC'].slice(0,Number($('module-zone_count').value)-1).join(',');
  drawModuleMap();moduleDraft();clearResults();
});
$('lin-preset').addEventListener('click',()=>{
  fillModules({...readModules(),guide:'AUUAUAGUGAGUCGUAUAUU',zone_count:3,zone_linkers:'CCT,AAC'});
  clearResults();$('module-status').textContent='已应用 Lin 3×20 nt 编码区和 CCT/AAC 间隔；其余模块保留。';
});

// Explicit task preset restores original68primer/12guide; RNA remains authoritative internally.
function applyOwnCas3Spacer(){
 fillModules({...moduleDefaults,linker_a:'TCAGG',linker_b:'TTAAGAGAAA',linker_c:'ATAGA',zone_count:3,zone_linkers:'AAA,TTT'});
 clearResults();$('module-status').textContent='本体系 Cas12a3_Spacer-v1：68_RCA Primer / 12_gRNA 固定。固定序列折叠见三步对照。';
}
$('own-cas3-spacer').addEventListener('click',applyOwnCas3Spacer);
if(experimentalMultiCas&&new URLSearchParams(location.search).get('preset')==='cas12a3-spacer-v1')applyOwnCas3Spacer();
