'use strict';
(()=>{
// Small English workflow additions; preserve the original studio canvas and palette.
const study=VARIANT_CATALOG.find(row=>row.experiment_reference);
const showStudyReference=data=>Boolean(data?.reference.matches_input&&data.input.wt===study.wt&&data.variant.position===study.position&&data.variant.mut===study.alt);
visibleCandidates=function(data=result){return !data?[]:showStudyReference(data)?[...data.candidates,data.reference]:data.candidates;};
const orderingDNA=sequence=>'/5Phos/'+sequence;
const addButton=(id,label,cls='quiet-button')=>{const b=node('button',label,cls);b.id=id;b.type='button';return b;};
const tools=document.querySelector('.studio-tools');
const custom=addButton('reader-use-target','Use my target');
tools.prepend(custom);
const readoutControls=document.querySelector('.joint-options');
$('conditions-dialog').querySelector('.dialog-heading').after(readoutControls);
const panel=node('section',undefined,'matched-oligos');panel.id='reader-matched';panel.hidden=true;
const top=node('div',undefined,'matched-heading'),label=node('div');label.append(node('h3','Matched oligos'));const note=node('p',undefined,'muted');note.id='reader-set-note';label.append(note);top.append(label);
const exports=node('div',undefined,'actions');exports.append(addButton('reader-copy','Copy all three','btn'),addButton('reader-download','Download selected set','btn'));top.append(exports);panel.append(top);
for(const [key,title,note] of [['padlock','Padlock','DNA · 5′ → 3′ · free 3′-OH'],['primer','RCA primer','DNA · 5′ → 3′'],['crrna','Complete crRNA','RNA · 5′ → 3′ · includes handle']]){const row=node('div',undefined,'matched-row');const h=node('div');h.append(node('b',title),node('small',note));const code=node('code');code.id='reader-'+key;row.append(h,code);panel.append(row);}
$('candidate-picker').after(panel);
const start=addButton('reader-target-start','Generate designs','btn primary');$('target-dialog').append(start);
function matchedSet(){if(!result)return null;const c=visibleCandidates().find(c=>c.id===result.selection.candidate_id);if(!c)return null;const m=c.modules||result.modules;return {c,padlock:c.sequence,primer:m.settings.primer,crrna:m.crrna};}

// The publication reader always generates a matched set, including restored legacy drafts.
function jointOnly(){
 const mode=$('design-mode');
 for(const option of [...mode.options])if(option.value!=='joint')option.remove();
 mode.value='joint';mode.parentElement.hidden=true;
 $('fixed-arms').checked=false;$('fixed-arms').closest('label').hidden=true;
}
jointOnly();
$('design-form').addEventListener('submit',jointOnly,true);
// Keep experimental inputs and visual identifiers; put explanatory prose in details.
function tidyReader(){
 jointOnly();
 document.querySelector('label[for="readout-temperature"]').textContent='RCA / Cas12a (°C)';
 document.querySelector('label[for="readout-salt"]').textContent='Na⁺ + K⁺ (mM)';
 for(const c of visibleCandidates()){
  const card=[...$('candidate-cards').children].find(el=>el.dataset.candidate===c.id);
  const data=[...$('candidate-details').children].find(el=>el.dataset.candidate===c.id);
  const details=data?.querySelector('[data-reader-tech]')||data?.querySelector('details');if(!card||!details)continue;
  const notes=card.querySelectorAll(':scope >p,.candidate-rationale,.binding-caption,.figure-caption,.figure-hint,.candidate-metrics,.interaction-summary');
  notes.forEach(el=>details.append(el));
  groupLinkers(card);
  const copy=card.querySelector('.cardtop .btn');if(copy&&!copy.dataset.ordering){const button=addButton('', 'Copy padlock','btn');button.dataset.ordering='true';button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(orderingDNA(c.sequence));button.textContent='Copied';}catch{button.textContent='Copy the sequence below';}});copy.replaceWith(button);}
  const svg=card.querySelector('.binding-picture svg');if(svg&&!svg.dataset.readerTrimmed){
   svg.dataset.readerTrimmed='true';
   for(const text of svg.querySelectorAll('text')){
    const y=text.getAttribute('y');const original=text.textContent;
    if(y==='34'){text.textContent='';continue;}
    if(y==='278')text.textContent=original.startsWith('5')?`5′ arm · ${c.length5} nt`:`3′ arm · ${c.length3} nt`;
    if(y==='316'){
     const m=original.match(/(?:extension|延伸)\s*(\d+)\s*\/\s*(\d+)/i);
     text.textContent=m&&(Number(m[1])||Number(m[2]))?`Boundary extension: ${m[1]} / ${m[2]} nt`:'';
    }
   }
  }
 }
 for(const button of $('candidate-picker').children){const small=button.querySelector('small');if(small&&small.textContent.includes('ΔG')){small.title=small.textContent;small.textContent=small.textContent.split('·')[0].trim();}}
}

function refreshMatched(){
 start.disabled=$('generate').disabled;tidyReader();const set=matchedSet();panel.hidden=!set;if(!set)return;
 for(const key of ['padlock','primer','crrna'])$('reader-'+key).textContent=key==='padlock'?orderingDNA(set[key]):set[key];
 const flags=set.c.interactions?.checks.filter(v=>v.review).length||0;
 $('reader-set-note').textContent=set.c.is_experimental_reference?'Original study design':`New design · validate before use${flags?' · '+flags+' checks to review':''}`;
}
const originalChoose=chooseCandidate;chooseCandidate=function(id){originalChoose(id);refreshMatched();};
const originalRender=render;render=function(data){originalRender(data);simplifyDetails();if(!showStudyReference(data))$('comparison').querySelectorAll('tr.reference').forEach(row=>row.remove());$('reference-note').hidden=!showStudyReference(data);const first=data.candidates[0];if(first)chooseCandidate(first.id);refreshMatched();formatReaderDetails(data);};
const originalClear=clearResults;clearResults=function(){originalClear();panel.hidden=true;};
custom.addEventListener('click',()=>{selectMode('source-mode','manual');selectMode('purpose','snv');$('molecule').value='dsDNA';$('target-name').value='Custom target';$('organism').value='';clearResults();$('wt').value='';mutation.setWT('');drawBases();refreshMutation();updateWorkflow();showStudioDialog('target-dialog');$('wt').focus();});
start.addEventListener('click',()=>{saveDraft();$('design-form').requestSubmit();});
new MutationObserver(refreshMatched).observe($('generate'),{attributes:true,attributeFilter:['disabled']});
function selectedFasta(){const s=matchedSet();if(!s)return '';const id=s.c.id;return `>${id}_padlock ${s.c.is_experimental_reference?'experimental_reference':'computed_unvalidated'} DNA_5to3 5prime_phosphate_required free_3prime_OH\n${orderingDNA(s.padlock)}\n>${id}_RCA_primer DNA_5to3\n${s.primer}\n>${id}_LbaCas12a_crRNA RNA_5to3\n${s.crrna}\n`;}
$('reader-copy').addEventListener('click',async()=>{if(!matchedSet())return;try{await navigator.clipboard.writeText(selectedFasta());$('reader-copy').textContent='Copied';setTimeout(()=>$('reader-copy').textContent='Copy all three',1800);}catch{$('reader-copy').textContent='Select and copy below';}});
$('reader-download').addEventListener('click',()=>{if(matchedSet())download('padlock-selected-set.fasta',selectedFasta(),'text/plain');});

// One bottom disclosure, retaining IDs used by the existing rendering functions.
const more=node('details',undefined,'reader-more');more.id='reader-details';more.append(node('summary','Details'));panel.after(more);
function flatDetails(element){
 if(element.tagName!=='DETAILS')return element;
 const group=node('section',undefined,'reader-detail-section');if(element.id)group.id=element.id;
 group.className+=' '+element.className;
 const heading=element.querySelector(':scope >summary');if(heading){group.append(node('h4',heading.textContent.trim()));heading.remove();}
 while(element.firstChild)group.append(element.firstChild);element.replaceWith(group);return group;
}
more.append($('candidate-details'));
for(const element of [document.querySelector('.target-reference'),document.querySelector('.technical-comparison'),$('snv-methods')])more.append(flatDetails(element));
$('apply-selected').hidden=true;
function simplifyDetails(){
 for(const data of $('candidate-details').children){
  for(const element of [...data.children]){
   if(element.matches('.sequence-details'))element.remove();
   else if(element.tagName==='DETAILS'){const group=flatDetails(element);group.dataset.readerTech='true';}
  }
 }
}
function groupLinkers(card){
 for(const legend of card.querySelectorAll('.region-legend')){
  const links=[...legend.children].filter(e=>e.dataset.region?.startsWith('linker_'));if(!links.length||links[0].dataset.grouped)continue;
  const c=visibleCandidates().find(c=>c.id===card.dataset.candidate),m=(c.modules||result.modules).settings;
  links[0].textContent='Linkers';links[0].title=`A / B / C: ${m.linker_a.length} / ${m.linker_b.length} / ${m.linker_c.length} nt`;links[0].dataset.grouped='true';links.slice(1).forEach(e=>e.remove());
 }
}
// Lengths describe this program's search or the study starting design, not a universal optimum.
const lengthGuide=node('section',undefined,'reader-length-guide');lengthGuide.id='reader-length-guide';
lengthGuide.append(node('h4','Length guide'));
const table=node('table');
for(const [part,length] of [['5′ / 3′ recognition arms','16–26 / 9–17 nt (search ranges)'],['New RCA primer','19–24 nt'],['Cas12a site / crRNA spacer','20–24 nt; fixed handle adds 21 nt'],['Linkers A / B / C','5 / 10 / 5 nt (study starting lengths)']]){const row=node('tr');row.append(node('th',part),node('td',length));table.append(row);}
lengthGuide.append(table);$('module-map').after(lengthGuide);
const linkerHint=node('p','A: 5 nt · B: 10 nt · C: 5 nt starting lengths','muted');linkerHint.id='reader-linker-starts';$('linker-tabs').after(linkerHint);
const baseSelectLinker=selectLinker;selectLinker=function(key){baseSelectLinker(key);for(const part of ['linker_a','linker_b','linker_c']){const badge=$('length-'+part);if(badge)badge.hidden=part!==key;}};
const baseOpenEditor=openModuleEditor;openModuleEditor=function(key,id){baseOpenEditor(key,id);if(key.startsWith('linker'))$('editor-title').textContent='Linkers';};
const baseModuleMap=drawModuleMap;drawModuleMap=function(){baseModuleMap();const link=$('module-map').querySelector('[data-region="linker_a"]');if(link)link.textContent='Linkers';};drawModuleMap();
// Keep the actual values editable, while identifying them as study/model inputs.
$('readout-salt').title='151 mM is the study monovalent-ion reference, not a universal reaction recipe.';
const modelNote=node('p','Readout: 37°C in this study. Na⁺ + K⁺: 151 mM is a model reference; use your readout buffer value.','muted');$('conditions-dialog').append(modelNote);
// All human-facing padlock sequence exports include the supplier modification token.
$('fasta-export').addEventListener('click',event=>{event.stopImmediatePropagation();if(!result)return;download('padlock-candidates.fasta',visibleCandidates().map(c=>{const m=c.modules||result.modules;return `>${c.id}_padlock DNA_5to3 free_3prime_OH\n${orderingDNA(c.sequence)}\n>${c.id}_RCA_primer DNA_5to3\n${m.settings.primer}\n>${c.id}_LbaCas12a_crRNA RNA_5to3\n${m.crrna}\n`;}).join(''),'text/plain');},true);

refreshMatched();

$('candidate-cards').addEventListener('click',()=>queueMicrotask(tidyReader));
tidyReader();


// Scoped presentation of existing calculation data; model values remain unchanged.
function formatReaderDetails(data){
 const walker=document.createTreeWalker($('reader-details'),NodeFilter.SHOW_TEXT);let text;
 while(text=walker.nextNode())text.textContent=text.textContent.replace(/[，、]/g,', ').replace(/。/g,'. ').replace(/；/g,'; ').replace(/\s+([,;:.])/g,'$1');
 for(const c of visibleCandidates(data)){
  const section=[...$('candidate-details').children].find(el=>el.dataset.candidate===c.id)?.querySelector('[data-reader-tech]');
  if(!section||section.dataset.formatted)continue;
  section.dataset.formatted='true';
  const notes=[...section.querySelectorAll('p')].filter(p=>!p.classList.contains('sequence')&&!p.textContent.startsWith('MFE ')&&!p.textContent.startsWith('Click a colored module'));
  section.replaceChildren(node('h4','Recognition arms & calculation'));
  const arms=node('div',undefined,'detail-arms');
  for(const [label,seq] of [["5′ recognition arm",c.arm5],["3′ recognition arm",c.arm3]]){const row=node('div',undefined,'detail-arm');row.append(node('span',label),node('code',seq),node('small',seq.length+' nt'));arms.append(row);}
  section.append(arms);
  const metrics=node('dl',undefined,'detail-metrics');
  for(const [label,value,hint] of [
   ['Arm Tm',`${fixed(c.tm5)} / ${fixed(c.tm3)} °C`,'5′ / 3′ · Mg-corrected'],
   ['Mean unpaired',`${fixed(c.fold.mean_unpaired5*100)} / ${fixed(c.fold.mean_unpaired3*100)} %`,'5′ / 3′ · not whole-arm opening probability'],
   ['Minimum free energy',`${c.fold.mfe.toFixed(2)} kcal/mol`,'Predicted DNA self-folding']
  ]){const cell=node('div');cell.append(node('dt',label),node('dd',value),node('small',hint));metrics.append(cell);}
  section.append(metrics);
  if(notes.length){const list=node('ul',undefined,'detail-notes');for(const p of notes){const li=node('li');if(p.classList.contains('interaction-summary'))li.classList.add('detail-review');li.textContent=p.textContent;list.append(li);}section.append(list);}
 }
}
(()=>{
 const labels=['Design scope','Melting temperature','DNA folding','Joint sequence search','Experimental validation','Sources','Software & run'];
 const methods=$('snv-methods');
 const body=node('div',undefined,'detail-method-grid');
 [...methods.querySelectorAll(':scope >p')].forEach((p,i)=>{const row=node('section',undefined,'detail-method-row');row.append(node('h5',labels[i]||'Notes'),p);body.append(row);});methods.append(body);
 document.querySelector('.technical-comparison >h4').textContent='Candidate comparison';
})();

})();
