'use strict';
let editorOrigin=null;
function updateSettingsSummary(){
  const inputs=[...document.querySelectorAll('#experiment-conditions input')];
  const changed=inputs.some(el=>Number(el.value)!==Number(el.defaultValue));
  $('condition-summary').textContent=`${changed?' Custom conditions ':' Study defaults '} · ${$('temperature_c').value}°C · Mg²⁺ ${$('mg_mm').value} mM`;
  const m=readModules(),custom=Object.keys(moduleDefaults).some(k=>m[k]!==moduleDefaults[k]);
  $('module-summary').textContent=custom?' Modified input modules ':' Original study modules  ·  available as reference ';
}
function chooseCandidate(id){
  if(!visibleCandidates(result).some(c=>c.id===id))return;
  const chosen=visibleCandidates(result).find(c=>c.id===id);
  result.selection={candidate_id:chosen.id,role:chosen.is_experimental_reference?'experimental_reference':'computed'};
  for(const card of [...$('candidate-cards').children,...($('candidate-details')?.children||[])])card.hidden=card.dataset.candidate!==id;
  for(const button of $('candidate-picker').children)button.setAttribute('aria-pressed',String(button.dataset.candidate===id));
  moduleRequest++;$('module-suggestions').replaceChildren();
  updateModuleContext({...result,modules:chosen.modules||result.modules});$('module-context').value=id;
  updateSettingsSummary();
}
function setupCandidateWorkspace(data){
  closeModuleEditor(false);$('candidate-picker').replaceChildren();
  if($('candidate-details')){
    $('candidate-details').replaceChildren();
    for(const card of $('candidate-cards').children){
      const panel=node('section',undefined,'candidate-data');panel.dataset.candidate=card.dataset.candidate;
      for(const details of card.querySelectorAll('.explanation>details,.sequence-details'))panel.append(details);
      $('candidate-details').append(panel);
    }
  }
  for(const c of visibleCandidates(data)){
    const button=node('button',undefined,'btn');button.type='button';button.dataset.candidate=c.id;button.setAttribute('aria-label',`${c.id} · ${c.length5}/${c.length3} nt`);
    const thumb=foldDrawingSingle(c,data).querySelector('svg');
    thumb.setAttribute('aria-hidden','true');thumb.classList.add('candidate-thumb');
    thumb.querySelectorAll('text,title').forEach(e=>e.remove());
    button.append(thumb,node('span',c.recommendation_label||c.id),node('small',`${c.length5} / ${c.length3} nt · ΔG ${c.fold.mfe.toFixed(2)}`));
    button.addEventListener('click',()=>chooseCandidate(c.id));$('candidate-picker').append(button);
  }
  if(visibleCandidates(data).length)chooseCandidate((data.joint_design&&data.candidates.length?data.candidates[0]:(data.reference.matches_input?data.reference:data.candidates[0])).id);
  updateSettingsSummary();
}
function selectLinker(key){
  for(const part of ['linker_a','linker_b','linker_c']){
    $('module-'+part).hidden=part!==key;
    document.querySelector(`label[for="module-${part}"]`).hidden=part!==key;
  }
  for(const b of $('linker-tabs').children)b.setAttribute('aria-pressed',String(b.dataset.key===key));
  document.querySelector('.recommend-module[data-kind="linker"]').hidden=key!=='linker_b';
}
for(const key of ['linker_a','linker_b','linker_c']){
  const button=node('button',key.slice(-1).toUpperCase(),'btn');button.type='button';button.dataset.key=key;
  button.addEventListener('click',()=>{selectLinker(key);$('module-'+key).focus({preventScroll:true});});$('linker-tabs').append(button);
}
function openModuleEditor(key,candidateId){
  if(!REGION_COLORS[key]||key.startsWith('arm'))return;
  if(result){chooseCandidate(candidateId);const candidate=visibleCandidates(result).find(c=>c.id===candidateId);if(candidate)fillModules((candidate.modules||result.modules).settings);}
  editorOrigin=document.activeElement;
  const panel=$('module-panel');panel.open=true;panel.classList.add('editing');
  panel.dataset.editGroup=key.startsWith('linker')?'linker':key;
  panel.setAttribute('role','dialog');panel.setAttribute('aria-label',' Edit functional modules ');
  $('editor-title').textContent=`${key.startsWith('linker')?' Linker ':REGION_COLORS[key].label}${candidateId?' · '+candidateId:''}`;
  if(key.startsWith('linker'))selectLinker(key);
  document.body.classList.add('module-editing');
  $('module-'+key).focus({preventScroll:true});
}
function closeModuleEditor(restoreFocus=true){
  const panel=$('module-panel');if(!panel.classList.contains('editing'))return;
  panel.classList.remove('editing');panel.removeAttribute('role');panel.removeAttribute('aria-label');delete panel.dataset.editGroup;panel.open=false;
  document.body.classList.remove('module-editing');
  if(restoreFocus&&editorOrigin?.isConnected)editorOrigin.focus({preventScroll:true});
}
$('close-editor').addEventListener('click',()=>closeModuleEditor());
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeModuleEditor();});
$('module-context').addEventListener('change',()=>chooseCandidate($('module-context').value));
$('design-form').addEventListener('input',updateSettingsSummary);
$('design-form').addEventListener('invalid',event=>{
  for(let el=event.target.parentElement;el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;
},true);
for(const id of ['restore-conditions','restore-modules'])$(id).addEventListener('click',updateSettingsSummary);
// Keep the secondary submit in sync with the existing calculation state.
new MutationObserver(()=>{$('editor-generate').disabled=$('generate').disabled;}).observe($('generate'),{attributes:true,attributeFilter:['disabled']});
updateSettingsSummary();

$('apply-selected').addEventListener('click',()=>{const c=visibleCandidates().find(c=>c.id===result?.selection?.candidate_id);if(!c)return;fillModules((c.modules||result.modules).settings);clearResults();saveDraft();$('status').textContent=' Selected modules applied to inputs ； regenerate 。';});
