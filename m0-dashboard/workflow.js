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
  $('input-heading').textContent=manual?'自定义靶标':'选择突变';
  $('target-name').readOnly=!manual; $('organism').readOnly=!manual;
  $('customize-variant').hidden=manual || !currentVariant();
  $('source-description').textContent=manual?'DNA / 单条 FASTA · 不限物种':'人类热点 · GRCh38';
  const selected=manual?null:currentVariant();
  verifiedSource=selected?`${selected.hgvs} · ${selected.genomic}`:'';
  $('source-record').hidden=!selected;
  $('source-record').replaceChildren();
  if(selected) {
    $('target-name').value=selected.name;$('organism').value='Homo sapiens（人）';
    $('source-record').append(node('b',`已选：${selected.name} · ${selected.ref} → ${selected.alt}`),node('p',`${selected.hgvs} · ${selected.assembly} · ${selected.genomic}`),node('p',`参考片段 ${selected.wt.length} nt · 第 ${selected.position} 位自动定位 · 按编码方向显示（基因组${selected.strand===2?'负':'正'}链） · 核验 ${selected.verified}`));
    if(selected.experiment_reference) $('source-record').append(node('p','WT78 / Mut79；可比较原91nt padlock、68 RCA primer 与12 gRNA，以及新计算方案。'));
    for(const [label,url] of [['ClinVar 变异记录',selected.clinvar],[selected.experiment_reference?'本研究参考序列':'NCBI 参考序列',selected.sequenceSource]]) {
      const link=node('a',label);link.href=url;link.target='_blank';link.rel='noreferrer';$('source-record').append(link,document.createTextNode('　'));
    }
    if(selected.id==='PIK3CA-H1047R') $('source-record').append(node('p','此处使用标准 61 nt 参考片段；历史实验订单的 50 nt 靶标保留在原记录中。'));
  }
  renderLibrary();
  $('wt-label').textContent=presence?'目标序列（5′ → 3′）':'WT · 野生型序列（5′ → 3′）';
  $('mutation-picker').hidden=presence || rna;
  $('design-parameters').hidden=presence || rna;
  $('experiment-conditions').hidden=presence || rna;
  $('module-panel').hidden=presence || rna;
  $('snv-recipe').hidden=presence || rna;
  $('snv-methods').hidden=presence || rna;
  $('presence-guide').hidden=!presence;
  $('mode-notice').hidden=!presence&&!rna;
  $('mode-notice').textContent=rna?'RNA 入口用于记录需求；当前计算仅支持 DNA，不能将 U 替换成 T 当作已经支持 RNA。':presence?'目标存在检测 · 流程预览：无需选突变。可填写并保存靶标；候选搜索与背景特异性检查尚未实现。':'';
  $('empty').querySelector('h2').textContent=presence||rna?'当前模式仅供预览':'候选将在这里出现';
  $('empty').querySelector('p').textContent=presence||rna?'可以填写并保存靶标信息；此模式不生成探针。':manual?'输入 WT → 点击碱基格 → 选择新碱基 → 生成候选。':'选择一个突变 → 自动填好序列和位点 → 生成候选。';
  if(!workflowSupported()) $('status').textContent='草稿可保存；此模式尚未接入候选计算。';
  refreshMutation();
  $('generate').textContent=workflowSupported()?'生成候选探针 ↗':'此模式暂未开放计算';
}
function saveDraft() {
  const draft={source:modeValue('source-mode'),purpose:modeValue('purpose'),wt:$('wt').value,position:mutation.position,alt:mutation.alt,verifiedSource};
  for(const id of ['design-mode','readout-temperature','readout-salt','target-name','organism','molecule','tm5_goal','tm3_goal','probe_nm','mg_mm','temperature_c','k_mm','tris_mm','na_mm','dntp_mm']) draft[id]=$(id).value;
  try { localStorage.setItem(draftKey,JSON.stringify(draft)); $('draft-status').textContent='草稿已保存'; }
  catch { $('draft-status').textContent='浏览器不允许保存草稿；关闭前请保留序列。'; }
}
for(const radio of document.querySelectorAll('input[name="source-mode"],input[name="purpose"]')) radio.addEventListener('change',()=>{
  if(radio.name==='source-mode' && radio.value==='manual' && currentVariant()) $('target-name').value=currentVariant().name+' · 自定义';
  if(radio.name==='source-mode' && radio.value==='library' && !currentVariant()) {
    $('wt').value='';mutation.setWT('');$('target-name').value='';$('organism').value='';drawBases();
  }
  clearResults();updateWorkflow();saveDraft();
});
$('molecule').addEventListener('change',()=>{clearResults();updateWorkflow();saveDraft();});
function renderLibrary() {
  const selected=modeValue('source-mode')==='library'?currentVariant():null;
  const rows=filterVariants(VARIANT_CATALOG,$('variant-search').value,activeGene);
  $('library-count').textContent=rows.length?`显示 ${rows.length} / ${VARIANT_CATALOG.length} 个`:'没有匹配条目。可换一个关键词，或使用手动入口。';
  $('variant-list').replaceChildren();
  for(const row of rows) {
    const button=node('button',undefined,'variant-choice');button.type='button';
    button.setAttribute('aria-pressed',String(selected?.id===row.id));
    button.append(node('b',row.name),node('small',`${row.hgvs.split(':')[1]} · ${row.ref} → ${row.alt}`));
    button.addEventListener('click',()=>{
      selectMode('source-mode','library');selectMode('purpose','snv');
      $('target-name').value=row.name;$('organism').value='Homo sapiens（人）';$('molecule').value='dsDNA';
      fillExample(row.wt,row.position,row.alt);updateWorkflow();saveDraft();
    });
    $('variant-list').append(button);
  }
}
for(const gene of ['all',...new Set(VARIANT_CATALOG.map(row=>row.gene))]) {
  const button=node('button',gene==='all'?`全部 ${VARIANT_CATALOG.length}`:gene);button.type='button';button.dataset.gene=gene;
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
  if(currentVariant()) $('target-name').value=currentVariant().name+' · 自定义';
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
  $('import-status').textContent=`已读取 ${parsed.sequence.length} nt${parsed.name?' · '+parsed.name:''}；请检查核酸类型并选择位点。`;
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
    if(file.size>100000) throw new Error('文件超过 100 KB，请只保留一条目标序列。');
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
      if(selected) { $('target-name').value=selected.name;$('organism').value='Homo sapiens（人）'; }
      else if(mutation.wt) { selectMode('source-mode','manual');$('target-name').value=($('target-name').value || '旧草稿')+' · 自定义'; }
    }
    drawBases();$('draft-status').textContent='已恢复草稿';
  }
} catch { $('draft-status').textContent='上次草稿无法读取，请重新输入。'; }
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
 $('condition-status').textContent=changed?'自定义条件':'实验默认值';
}
$('restore-conditions').addEventListener('click',()=>{for(const [id,value] of Object.entries(experimentDefaults))$(id).value=value;clearResults();updateWorkflow();saveDraft();conditionStatus();});
$('design-form').addEventListener('input',conditionStatus);conditionStatus();
