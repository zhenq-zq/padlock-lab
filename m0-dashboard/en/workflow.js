'use strict';
const draftKey='padlock-design-draft-v2';
let verifiedSource='';
let activeGene='all';
let hasSavedDraft=false;
function currentVariant() { return matchVariant(VARIANT_CATALOG,mutation.wt,mutation.position,mutation.alt); }
const modeValue=name=>document.querySelector(`input[name="${name}"]:checked`).value;
function selectMode(name,value) {
  const input=document.querySelector(`input[name="${name}"][value="${value}"]`);
  if(input) input.checked=true;
}
function updateWorkflow() {
  const manual=modeValue('source-mode')==='manual',presence=modeValue('purpose')==='presence',rna=$('molecule').value==='RNA';
  $('manual-import').hidden=!manual;
  $('sequence-details').open=manual;
  document.querySelector('.source-details').hidden=manual;
  $('library-options').hidden=manual;
  $('library-badge').hidden=manual;
  $('wt').readOnly=!manual;
  $('input-heading').textContent=manual?' Custom target ':' Choose variant ';
  $('target-name').readOnly=!manual; $('organism').readOnly=!manual;
  $('customize-variant').hidden=manual || !currentVariant();
  $('source-description').textContent=manual?'DNA /  one  FASTA ·  any organism ':' Human reference variants  · GRCh38';
  const selected=manual?null:currentVariant();
  verifiedSource=selected?`${selected.hgvs} · ${selected.genomic}`:'';
  $('source-record').hidden=!selected;
  $('source-record').replaceChildren();
  if(selected) {
    $('target-name').value=selected.name;$('organism').value='Homo sapiens（ human ）';
    $('source-record').append(node('b',` Selected ：${selected.name} · ${selected.ref} → ${selected.alt}`),node('p',`${selected.hgvs} · ${selected.assembly} · ${selected.genomic}`),node('p',` reference fragment  ${selected.wt.length} nt ·  position  ${selected.position}  variant position automatically located  ·  displayed in coding orientation （ genomic ${selected.strand===2?' reverse ':' forward '} strand ） ·  checked  ${selected.verified}`));
    if(selected.experiment_reference) $('source-record').append(node('p','WT78 / Mut79； Compare the original 91nt padlock、68 RCA primer  and 12 gRNA， and newly computed designs 。'));
    for(const [label,url] of [['ClinVar  variant record ',selected.clinvar],[selected.experiment_reference?' Study reference sequence ':'NCBI  reference sequence ',selected.sequenceSource]]) {
      const link=node('a',label);link.href=url;link.target='_blank';link.rel='noreferrer';$('source-record').append(link,document.createTextNode('　'));
    }
    if(selected.id==='PIK3CA-H1047R') $('source-record').append(node('p',' This entry uses the reference  61 nt  reference fragment ； The historical experimental  50 nt  target remains in the study record 。'));
  }
  renderLibrary();
  $('wt-label').textContent=presence?' Target sequence （5′ → 3′）':'WT ·  WT sequence （5′ → 3′）';
  $('mutation-picker').hidden=presence || rna;
  $('design-parameters').hidden=presence || rna;
  $('experiment-conditions').hidden=presence || rna;
  $('module-panel').hidden=presence || rna;
  $('snv-recipe').hidden=presence || rna;
  $('snv-methods').hidden=presence || rna;
  $('presence-guide').hidden=!presence;
  $('mode-notice').hidden=!presence&&!rna;
  $('mode-notice').textContent=rna?'RNA  input records requirements only ； Computation currently supports  DNA， do not replace  U  replace with  T  and treat it as supported  RNA。':presence?' Target presence detection  ·  Workflow preview ： no variant selection 。 target drafts can be saved ； Candidate search and background specificity checks are not implemented 。':'';
  $('empty').querySelector('h2').textContent=presence||rna?' Preview-only mode ':' Designs will appear here ';
  $('empty').querySelector('p').textContent=presence||rna?' You can save target information ； This mode does not generate designs 。':manual?' Inputs  WT →  click a base  →  choose the alternate base  →  generate candidates 。':' Choose a variant  →  sequence and position are filled automatically  →  generate candidates 。';
  if(!workflowSupported()) $('status').textContent=' Drafts can be saved ； This mode does not support candidate computation 。';
  refreshMutation();
  $('generate').textContent=workflowSupported()?' Generate candidate designs  ↗':' Computation is not available in this mode ';
}
function saveDraft() {
  const draft={source:modeValue('source-mode'),purpose:modeValue('purpose'),wt:$('wt').value,position:mutation.position,alt:mutation.alt,verifiedSource};
  for(const id of ['design-mode','readout-temperature','readout-salt','target-name','organism','molecule','tm5_goal','tm3_goal','probe_nm','mg_mm','temperature_c','k_mm','tris_mm','na_mm','dntp_mm']) draft[id]=$(id).value;
  try { localStorage.setItem(draftKey,JSON.stringify(draft)); $('draft-status').textContent=' Draft saved '; }
  catch { $('draft-status').textContent=' Browser storage is unavailable ； save your sequence before closing 。'; }
}
for(const radio of document.querySelectorAll('input[name="source-mode"],input[name="purpose"]')) radio.addEventListener('change',()=>{
  if(radio.name==='source-mode' && radio.value==='manual' && currentVariant()) $('target-name').value=currentVariant().name+' ·  custom ';
  if(radio.name==='source-mode' && radio.value==='library' && !currentVariant()) {
    $('wt').value='';mutation.setWT('');$('target-name').value='';$('organism').value='';drawBases();
  }
  clearResults();updateWorkflow();saveDraft();
});
$('molecule').addEventListener('change',()=>{clearResults();updateWorkflow();saveDraft();});
function renderLibrary() {
  const selected=modeValue('source-mode')==='library'?currentVariant():null;
  const rows=filterVariants(VARIANT_CATALOG,$('variant-search').value,activeGene);
  $('library-count').textContent=rows.length?` Showing  ${rows.length} / ${VARIANT_CATALOG.length}  entries `:' No matching entries 。 try a different search ， or use a custom sequence 。';
  $('variant-list').replaceChildren();
  for(const row of rows) {
    const button=node('button',undefined,'variant-choice');button.type='button';
    button.setAttribute('aria-pressed',String(selected?.id===row.id));
    button.append(node('b',row.name),node('small',`${row.hgvs.split(':')[1]} · ${row.ref} → ${row.alt}`));
    button.addEventListener('click',()=>{
      selectMode('source-mode','library');selectMode('purpose','snv');
      $('target-name').value=row.name;$('organism').value='Homo sapiens（ human ）';$('molecule').value='dsDNA';
      fillExample(row.wt,row.position,row.alt);updateWorkflow();saveDraft();
    });
    $('variant-list').append(button);
  }
}
for(const gene of ['all',...new Set(VARIANT_CATALOG.map(row=>row.gene))]) {
  const button=node('button',gene==='all'?` All  ${VARIANT_CATALOG.length}`:gene);button.type='button';button.dataset.gene=gene;
  button.setAttribute('aria-pressed',String(gene===activeGene));
  button.addEventListener('click',()=>{
    activeGene=gene;
    for(const item of $('gene-filters').children)item.setAttribute('aria-pressed',String(item.dataset.gene===gene));
    renderLibrary();
  });
  $('gene-filters').append(button);
}
$('variant-search').addEventListener('input',renderLibrary);
function useManual() {
  selectMode('source-mode','manual');
  if(currentVariant()) $('target-name').value=currentVariant().name+' ·  custom ';
  verifiedSource='';clearResults();updateWorkflow();saveDraft();$('wt').focus();
}
$('manual-shortcut').addEventListener('click',useManual);
$('customize-variant').addEventListener('click',useManual);
function acceptSequence(text) {
  const parsed=parseSequence(text);
  if(currentVariant() || verifiedSource) { $('target-name').value='';$('organism').value=''; }
  $('wt').value=parsed.sequence;
  if(parsed.name && !$('target-name').value.trim()) $('target-name').value=parsed.name.slice(0,100);
  verifiedSource='';mutation.setWT(parsed.sequence);clearResults();drawBases();updateWorkflow();saveDraft();
  $('import-status').textContent=` Read  ${parsed.sequence.length} nt${parsed.name?' · '+parsed.name:''}； check molecule type and select the variant 。`;
}
$('wt').addEventListener('input',()=>{
  if(currentVariant() || verifiedSource) { $('target-name').value='';$('organism').value=''; }
  verifiedSource='';
  if($('wt').value.trim().startsWith('>')) {
    try { acceptSequence($('wt').value); }
    catch(error) { $('import-status').textContent=error.message; }
  }
  updateWorkflow();saveDraft();
});
$('fasta-file').addEventListener('change',async()=>{
  const file=$('fasta-file').files[0];if(!file)return;
  // Clear previous candidates before reading, including failed imports.
  $('wt').value='';mutation.setWT('');clearResults();drawBases();updateWorkflow();saveDraft();
  const importRevision=revision;
  try {
    if(file.size>100000) throw new Error(' File exceeds  100 KB， include only one target sequence 。');
    const text=await file.text();
    if(revision!==importRevision) return;
    acceptSequence(text);
  } catch(error) { $('import-status').textContent=error.message; }
  finally { $('fasta-file').value=''; }
});
$('design-form').addEventListener('input',saveDraft);
$('mutation-grid').addEventListener('click',saveDraft);
$('base-options').addEventListener('click',saveDraft);
try {
  const draft=JSON.parse(localStorage.getItem(draftKey)||'null');
  if(draft) {
    hasSavedDraft=true;
    selectMode('source-mode',draft.source);selectMode('purpose',draft.purpose);
    for(const id of ['design-mode','readout-temperature','readout-salt','target-name','organism','molecule','tm5_goal','tm3_goal','probe_nm','mg_mm','temperature_c','k_mm','tris_mm','na_mm','dntp_mm']) if(typeof draft[id]==='string') $(id).value=draft[id];
    $('wt').value=typeof draft.wt==='string'?draft.wt:'';mutation.setWT($('wt').value);
    if(mutation.validWT && Number.isInteger(draft.position) && draft.position>=1 && draft.position<=mutation.wt.length) {
      mutation.select(draft.position);
      if(/^[ACGT]$/.test(draft.alt||'') && draft.alt!==mutation.wt[draft.position-1]) mutation.replace(draft.alt);
    }
    verifiedSource='';
    if(modeValue('source-mode')==='library') {
      const selected=currentVariant();
      if(selected) { $('target-name').value=selected.name;$('organism').value='Homo sapiens（ human ）'; }
      else if(mutation.wt) { selectMode('source-mode','manual');$('target-name').value=($('target-name').value || ' previous draft ')+' ·  custom '; }
    }
    drawBases();$('draft-status').textContent=' Draft restored ';
  }
} catch { $('draft-status').textContent=' Previous draft could not be read ， please enter it again 。'; }
if(new URLSearchParams(location.search).get('target')==='lab' || !hasSavedDraft){
 const lab=VARIANT_CATALOG.find(r=>r.experiment_reference);
 selectMode('source-mode','library');selectMode('purpose','snv');$('molecule').value='dsDNA';
 fillExample(lab.wt,lab.position,lab.alt);
}
if(new URLSearchParams(location.search).get('mode')==='joint') $('design-mode').value='joint';
updateWorkflow();

const experimentDefaults={mg_mm:10,temperature_c:45,k_mm:151,tris_mm:20.1,na_mm:0,dntp_mm:0,probe_nm:100,tm5_goal:55,tm3_goal:45};
function conditionStatus(){
 const changed=Object.entries(experimentDefaults).some(([id,value])=>Number($(id).value)!==value);
 $('condition-status').textContent=changed?' Custom conditions ':' Study defaults ';
}
$('restore-conditions').addEventListener('click',()=>{for(const [id,value] of Object.entries(experimentDefaults))$(id).value=value;clearResults();updateWorkflow();saveDraft();conditionStatus();});
$('design-form').addEventListener('input',conditionStatus);conditionStatus();
