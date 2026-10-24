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
  $('generate').textContent = ' Generate candidate designs  ↗';
  $('status').className = 'status';
  $('status').textContent = ' Inputs changed ， regenerate 。';
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
    button.setAttribute('aria-label',` position  ${index+1}  position ，${base}`);
    button.append(node('span',base),node('small',String(index+1)));
    button.addEventListener('click',()=>{
      mutation.select(index+1); clearResults(); refreshMutation();
    });
    grid.append(button);
  });
}
function refreshMutation() {
  const pos=mutation.position, ref=pos===null?null:mutation.wt[pos-1];
  $('mutation-help').textContent=mutation.problem || ' One SNV selected ， Ready to generate designs 。';
  $('mutation-summary').textContent=pos===null ? '②  Click a base to select a position ' : mutation.alt ? ` position  ${pos}  position ：${ref} → ${mutation.alt}` : ` Selected position  ${pos}  position ：${ref}， choose the alternate base ？`;
  $('mutation-summary').classList.toggle('chosen',Boolean(mutation.alt));
  for(const b of $('mutation-grid').children) {
    const selected=Number(b.dataset.position)===pos;
    b.disabled=document.querySelector('input[name="source-mode"]:checked').value==='library';
    b.classList.toggle('selected',selected); b.setAttribute('aria-pressed',String(selected));
  }
  for(const b of $('base-options').children) {
    b.disabled=pos===null || b.dataset.base===ref || document.querySelector('input[name="source-mode"]:checked').value==='library';
    b.setAttribute('aria-pressed',String(b.dataset.base===mutation.alt));
    b.title=b.dataset.base===ref?' This is  WT  the WT base ， choose another base ':'';
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
  button.setAttribute('aria-label',` Substitute with  ${base}`);
  button.addEventListener('click',()=>{mutation.replace(base);clearResults();refreshMutation();});
  $('base-options').append(button);
}
mutation.setWT($('wt').value);drawBases();refreshMutation();
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = window.PadlockI18n.message(text);
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
  $('result-title').textContent = `${data.context?.name || ' Custom target '}`;
  $('result-description').textContent = ` Arm combinations enumerated  ${data.counts.arms_enumerated}，Tm condition passed  ${data.counts.thermal_pass}， zero-extension passed  ${data.counts.boundary_pass}， selected  ${data.counts.selected}； reference  ${input.tm5_goal} / ${input.tm3_goal}°C， Probe  ${input.probe_nm} nM； total  Mg ${input.mg_mm} mM，K ${input.k_mm} mM， Ligation temperature  ${input.temperature_c}°C。`;
  if(data.joint_design) $('result-description').textContent+=`  Joint combinations evaluated  ${data.joint_design.evaluated}  sets ， outputs  ${data.candidates.length}  matched sets selected ； readout temperature  ${data.joint_design.readout_temperature_C}°C。`;
  const map = $('variant-map'); map.replaceChildren();
  map.append(node('b', ` Target position  ${v.position}  position ：${v.wt} → ${v.mut} ·  Discriminating base at probe  3′  terminus `), node('br'));
  const start = Math.max(0,v.position-31), end = Math.min(input.mut.length,v.position+30);
  const code = node('code');
  code.append(document.createTextNode(`5′ ${start ? '…' : ''}${input.mut.slice(start,v.position-1)}`),node('mark',v.mut),document.createTextNode(`${input.mut.slice(v.position,end)}${end<input.mut.length?'…':''} 3′`));
  map.append(code);
  const close = data.candidates.filter(c => c.within_5c).length;
  $('result-warning').textContent = !data.candidates.length ? ' No automatic candidates with both Spacer having zero boundary extension were found ； Use joint design to adjust Spacer boundary 。 The original experimental reference remains available 。' : (data.joint_design?`${data.candidates.length} joint computational recommendations  ·  New modules require matched oligos and experimental validation `:' Computational recommendation  ·  not experimentally validated ');
  $('comparison').replaceChildren();
  [...data.candidates.filter(c=>c!==data.reference),data.reference].forEach(c => {
    const tr = node('tr',undefined,c===data.reference?'reference':'');
    [c===data.reference?' original  91 nt  Probe ':c.id,`${c.length5} / ${c.length3}`,`${fixed(c.tm5)} / ${fixed(c.tm3)}`,fixed(c.tm_deviation),`${fixed(c.fold.mean_unpaired5*100)} / ${fixed(c.fold.mean_unpaired3*100)}`].forEach(text => tr.append(node('td',text)));
    $('comparison').append(tr);
  });
  $('reference-note').textContent = data.reference.matches_input ? ' The experimental reference matches this Mut site. Its metrics use the current concentration for comparison. ' : ' The original probe is a historical reference ， it does not match this target ； The table compares only its intrinsic arm  Tm  and self-folding 。';
  $('candidate-cards').replaceChildren();
  visibleCandidates(data).forEach(c => {
    const card = node('article',undefined,'candidate'), top = node('div',undefined,'cardtop');
    card.dataset.candidate=c.id;
    const heading = node('h3',`${data.context?.name || ' Custom target '} · ${c.id} · ${c.sequence.length} nt`);
    heading.append(node('span',c.is_reference_sequence?' Same as original probe ':c.within_5c?' Both arms near reference ':'Tm  far from reference ','tag'));
    const copy = node('button',' Copy full sequence ','btn'); copy.type='button';
    copy.addEventListener('click',async () => {
      try { await navigator.clipboard.writeText(c.sequence); copy.textContent=' Copied '; }
      catch { copy.textContent=' Select and copy the sequence below '; }
    });
    top.append(heading,copy);
    const sequence = node('div',undefined,'sequence');
    for(const r of probeRegions(c,data)){const span=paintRegion(node('span',r.sequence),r.key);span.title=r.label;sequence.append(span);}
    const info = node('p',` Recognition arms  ${c.length5} / ${c.length3} nt ·  Target positions  ${c.target5.join('–')} / ${c.target3.join('–')}`);
    const reason = node('p','5′  phosphorylation  ·  Copied sequence excludes modification codes ');
    const sequenceDetails=node('details',undefined,'sequence-details');sequenceDetails.append(node('summary',' Full sequence and modifications '),sequence,info,reason);
    if(c.structural_screen)card.append(node('p',`${c.recommendation_label||' Structural candidate '} · B: ${c.modules.settings.linker_b} · primer ${fixed(c.structural_screen.rca_paired*100)}% / gRNA ${fixed(c.structural_screen.cas_paired*100)}%  paired fraction （${c.structural_screen.temperature_C}°C）`));
    if(c.interactions){const review=c.interactions.checks.filter(v=>v.review);card.append(node('p',review.length?` Complementarity review flags ：${review.map(v=>v.id+' '+v.max_complement_nt+' nt').join('；')}。 Short complementarity is not proven interference 。`:' Complete-oligo exact-complement check passes the 8nt screen ； not evidence of absence of experimental interference 。','interaction-summary'));}
    const rationale=node('p',`${c.recommendation_label||" Design rationale "}： left anchoring 、 right-side ligation-junction discrimination ； arms  Tm ${fixed(c.tm5)} / ${fixed(c.tm3)}°C， reference  ${input.tm5_goal} / ${input.tm3_goal}°C。`,'candidate-rationale');
    const m=c.modules||data.modules;
    const paired=node('details',undefined,'sequence-details');paired.append(node('summary',' Matched  primer /  full  crRNA'));
    paired.append(node('pre',`RCA primer · DNA · 5′ → 3′\n${m.settings.primer}\n\nLbaCas12a crRNA · RNA · 5′ → 3′\n${m.crrna}`,'sequence'));
    const copyPair=node('button',' Copy matched oligos ','btn');copyPair.type='button';copyPair.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(`>RCA_primer\n${m.settings.primer}\n>LbaCas12a_crRNA\n${m.crrna}\n`);copyPair.textContent=' Copied ';}catch{copyPair.textContent=' Select and copy the sequence ';}});paired.append(copyPair);
    if(c.joint_metrics){const q=c.joint_metrics;paired.append(node('p',`primer Tm ${fixed(q.primer_Tm_C)}°C（500nM， monovalent salt ， without Mg ）； full crRNA spacer unpaired  ${fixed(100*q.crrna_spacer_open)}%（${q.crrna_model}， not modeled: RNP）。`));}
    card.append(top,rationale,candidateExplanation(c,data),sequenceDetails,paired); $('candidate-cards').append(card);
  });
  if(typeof setupCandidateWorkspace==='function') setupCandidateWorkspace(data);
  $('fasta-export').disabled = !data.candidates.length;
  $('versions').textContent = ` This calculation ：${data.models.tm}；${data.models.fold}。 time  ${new Date(data.created_utc).toLocaleString()}。`;
}
$('design-form').addEventListener('submit',async event => {
  event.preventDefault(); clearResults();
  if(!workflowSupported() || !mutation.ready) { $('status').textContent=workflowSupported()?mutation.problem:' This mode is a workflow preview ， computation is not supported 。'; return; }
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
  $('generate').disabled = true; $('generate').textContent = ' Computing …';
  $('status').textContent = input.joint_design?' Joint screening of recognition arms 、 new  primer  and full  crRNA…':' Screening recognition arms and calculating  Tm、 Self-folding …';
  try {
    const response=await fetch('/api/design',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal});
    if (!(response.headers.get('content-type')||'').includes('application/json')) throw new Error(' This is a static preview ， Start the local API and open  design.html（ see  README）。');
    const data=await response.json();
    if (!response.ok) throw new Error(data.error||' Calculation request failed 。');
    if (current!==revision) return;
    data.context=context; render(data); $('status').textContent = ' Calculation complete 。';
    if(!document.body.classList.contains('studio')) $('results').scrollIntoView({behavior:'smooth',block:'start'});
  } catch(error) {
    if (error.name==='AbortError' || current!==revision) return;
    $('status').className='status error';
    $('status').textContent=error instanceof TypeError ? ' Cannot connect to the computation service 。 Follow  README  start the service ， and open this page from its local URL 。' : window.PadlockI18n.message(error.message);
  } finally {
    if (current===revision) { $('generate').disabled=!mutation.ready || !workflowSupported(); $('generate').textContent=' Generate candidate designs  ↗'; }
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
  $('service').textContent='●  Local API connected ';
}).catch(()=>{$('service').textContent=' API not connected  ·  Follow  README  start the API ';});

for(const id of ['design-mode','readout-temperature','readout-salt'])$(id).addEventListener('input',()=>{clearResults();if(typeof saveDraft==='function')saveDraft();});
