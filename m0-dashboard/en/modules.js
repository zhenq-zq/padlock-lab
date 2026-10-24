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
    const label=key==='linker_a'?' Linker ':REGION_COLORS[key].label;
    const block=paintRegion(node('button',key==='linker_a'?` Linker  A/B/C · ${m.linker_a.length}/${m.linker_b.length}/${m.linker_c.length} nt`:`${label} · ${m[key].length} nt`),key);block.type='button';block.addEventListener('click',()=>openModuleEditor(key,$('module-context').value));$('module-map').append(block);
  }
  for(const key of ['primer','guide','linker_a','linker_b','linker_c']){
    const input=$('module-'+key);let badge=$('length-'+key);
    if(!badge){badge=node('small',undefined,'muted');badge.id='length-'+key;input.after(badge);}
    badge.textContent=`${m[key].length} nt${key==='guide'?` / zone · ${m.zone_count} zones ·  full  gRNA ${21+m.guide.length} nt（RNA Export ）`:''}`;
  }
  let gapBadge=$('length-zone-gaps');if(!gapBadge){gapBadge=node('small',undefined,'muted');gapBadge.id='length-zone-gaps';$('module-zone_linkers').after(gapBadge);}
  gapBadge.textContent=m.zone_linkers?m.zone_linkers.split(',').map((g,i)=>` gap  ${i+1} · ${g.length} nt`).join(' · '):' No inter-zone linker ';
  for(const key of Object.keys(moduleDefaults).filter(k=>REGION_COLORS[k]))$('module-'+key).style.borderLeft=`3px solid ${REGION_COLORS[key].color}`;
}
function clearModuleSuggestions(){
  moduleRequest++;$('module-pairing').hidden=true;$('module-suggestions').replaceChildren();$('module-status').textContent=' Generate designs before viewing module suggestions 。';
  for(const b of document.querySelectorAll('.recommend-module'))b.disabled=true;
  $('module-context').replaceChildren(new Option(' Generate a design first ',''));
}
function updateModuleContext(data){
  const m=data.modules,comp=seq=>[...seq.replaceAll('U','T')].map(b=>({A:'T',T:'A',G:'C',C:'G'})[b]).join('');
  $('module-pairing').hidden=false;$('module-pairing-content').replaceChildren();
  const primer=paintRegion(node('pre',`Primer  5′ ${m.settings.primer} 3′\nPadlock 3′ ${comp(m.settings.primer)} 5′`,'sequence'),'primer');
  const guide=paintRegion(node('pre',`Cas  Coding  5′ ${m.settings.guide.replaceAll('U','T')} 3′\nRCA     3′ ${comp(m.settings.guide)} 5′`,'sequence'),'guide');
  const cr=node('p',undefined,'sequence');cr.append(document.createTextNode(` full  gRNA · 5′ ${m.crrna.slice(0,-m.settings.guide.length)}`),paintRegion(node('span',m.settings.guide),'guide'),document.createTextNode(' 3′'));
  $('module-pairing-content').append(primer,guide,cr);

  $('module-context').replaceChildren();
  for(const c of visibleCandidates(data))$('module-context').append(new Option(`${c.id} · ${c.length5}/${c.length3} nt`,c.id));
  for(const b of document.querySelectorAll('.recommend-module'))b.disabled=!visibleCandidates(data).length;
  $('module-status').textContent=visibleCandidates(data).length?' Module suggestions are available for this design 。':' Generate a design first 。';
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
$('restore-modules').addEventListener('click',()=>{fillModules(moduleDefaults);clearResults();$('module-status').textContent=' Study modules restored ； regenerate 。';});
$('module-context').addEventListener('change',()=>{moduleRequest++;$('module-suggestions').replaceChildren();$('module-status').textContent=' Selected design updated 。';});
for(const button of document.querySelectorAll('.recommend-module'))button.addEventListener('click',async()=>{
  if(!result)return;
  const c=visibleCandidates(result).find(c=>c.id===$('module-context').value);if(!c)return;
  const request=++moduleRequest,currentRevision=revision;
  $('module-suggestions').replaceChildren();$('module-status').textContent=' Computing structures …';
  try {
    const response=await fetch('/api/modules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({temperature_c:Number($('readout-temperature').value),monovalent_mm:Number($('readout-salt').value),kind:button.dataset.kind,arm5:c.arm5,arm3:c.arm3,modules:c.modules?.settings||readModules()})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||' Computation failed ');
    if(request!==moduleRequest||revision!==currentRevision)return;
    $('module-status').textContent=`${c.id} · ${data.screened}  variants  · ${data.model.temperature_C}°C · Na⁺+K⁺ ${data.model.monovalent_mM} mM ·  Mg-free structural screen `;
    const key={rca:'primer',cas:'guide',linker:'linker_b'}[data.kind];
    const reasons={
      rca:' Preserves the current primer  3′  end ； Ranks by increased accessibility of the primer binding site 。',
      cas:' Retains  Lba Cas12a  and current  Cas12a  coding-region  5′  end ； by  RCA  ranks by increased accessibility of the RCA activator 。',
      linker:' Preserves linker  B  length and base composition ； prioritizes  primer、Cas  the less accessible of the two sites 。'
    };
    $('module-suggestions').append(node('p',reasons[data.kind],'module-reason'));
    $('module-suggestions').append(node('small',` Evidence ： Conditions  ${data.model.temperature_C}°C、Na⁺+K⁺ ${data.model.monovalent_mM} mM；Mg²⁺/Tris  not modeled 。`,'muted'));
    data.candidates.forEach((row,i)=>{
      const card=node('div',undefined,'module-option');
      card.append(node('b',`${i+1} · ${row.is_current?' Current design ':' Structural candidate '}`),paintRegion(node('code',key==='guide'?row.settings[key].replaceAll('U','T'):row.settings[key]),key),node('small',`${row.settings[key].length} nt · ${row.is_current?' retains current sequence ':' alternative sequence '}`));
      const evidence=node('details',undefined,'module-evidence');
      evidence.append(node('summary',' Screening details '),node('p',` Site paired fraction ：primer ${fixed(row.rca_paired*100)}% · Cas ${fixed(row.cas_paired*100)}%。 Ranking within this bounded pool ， ties use the mean across both sites 。`));
      card.append(evidence);
      const use=node('button',row.is_current?' Current ':' Apply ','btn');use.type='button';use.disabled=row.is_current;
      use.addEventListener('click',()=>{fillModules(row.settings);clearResults();$('module-status').textContent=' Applied ； regenerate to update the full probe 。';});card.append(use);$('module-suggestions').append(card);
    });
  }catch(error){if(request===moduleRequest&&revision===currentRevision)$('module-status').textContent=window.PadlockI18n.message(error.message);}
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
  clearResults();$('module-status').textContent=' Applied  Lin 3×20 nt  Coding region  and  CCT/AAC  gap ； other  Modules  retains 。';
});

// Explicit task preset restores original68primer/12guide; RNA remains authoritative internally.
function applyOwnCas3Spacer(){
 fillModules({...moduleDefaults,linker_a:'TCAGG',linker_b:'TTAAGAGAAA',linker_c:'ATAGA',zone_count:3,zone_linkers:'AAA,TTT'});
 clearResults();$('module-status').textContent=' Study system  Cas12a3_Spacer-v1：68_RCA Primer / 12_gRNA  fixed 。 fixed  sequence  folding  see  three-step  against  prioritize 。';
}
$('own-cas3-spacer').addEventListener('click',applyOwnCas3Spacer);
if(experimentalMultiCas&&new URLSearchParams(location.search).get('preset')==='cas12a3-spacer-v1')applyOwnCas3Spacer();
