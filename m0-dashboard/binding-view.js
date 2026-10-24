'use strict';
function bindingRows(candidate,data,kind='mut') {
  const target=data.input[kind],start5=candidate.target5[0]-1,end5=candidate.target5[1],start3=candidate.target3[0]-1,end3=candidate.target3[1];
  const probe=Array(target.length).fill(' '),roles=Array(target.length).fill('flank'),comp={A:'T',T:'A',G:'C',C:'G'};
  [...candidate.arm5].reverse().forEach((b,j)=>{probe[start5+j]=b;roles[start5+j]='arm5';});
  [...candidate.arm3].reverse().forEach((b,j)=>{probe[start3+j]=b;roles[start3+j]='arm3';});
  const m=(candidate.modules||data.modules)?.settings||{};let extraLeft=0,extraRight=0;
  for(const b of m.linker_a||'') {const i=start5-1-extraLeft;if(i<0||comp[b]!==target[i])break;probe[i]=b;roles[i]='spacer5';extraLeft++;}
  for(const b of [...(m.linker_c||'')].reverse()) {const i=end3+extraRight;if(i>=target.length||comp[b]!==target[i])break;probe[i]=b;roles[i]='spacer3';extraRight++;}
  return {target,probe:probe.join(''),roles,split:start3,start:1,mutationIndex:data.variant.position-1,start5,end5,start3,end3,extraLeft,extraRight};
}
function spacerTargetHits(candidate,data,kind='mut',minLength=6) {
  const m=(candidate.modules||data.modules)?.settings||{},target=data.input[kind],rc=s=>[...s].reverse().map(b=>({A:'T',T:'A',G:'C',C:'G'})[b]).join('');
  const parts=[['Spacer1',m.linker_a||''],['Spacer2',m.linker_b||''],['Spacer3',m.linker_c||''],...(m.zone_linkers?m.zone_linkers.split(',').map((s,i)=>[`Cas间隔${i+1}`,s]):[])],hits=[];
  for(const [name,seq] of parts){const comp=rc(seq);for(let offset=-(comp.length-1);offset<target.length;offset++){let run=0;for(let j=0;j<=comp.length;j++){const i=offset+j;if(j<comp.length&&i>=0&&i<target.length&&comp[j]===target[i])run++;else{if(run>=minLength)hits.push({name,length:run,targetStart:offset+j-run+1,targetEnd:offset+j});run=0;}}}}
  return hits.sort((a,b)=>b.length-a.length);
}
function bindingView(candidate,data) {
  const box=node('div',undefined,'binding-view'),controls=node('div',undefined,'actions'),picture=node('div',undefined,'binding-picture'),caption=node('p',undefined,'binding-caption'),screen=node('p',undefined,'figure-caption');
  const buttons=[];
  function show(kind) {
    for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.kind===kind));
    const row=bindingRows(candidate,data,kind),step=19,left=60,gap=18,width=left*2+row.target.length*step+gap;
    const x=i=>left+i*step+(i>=row.split?gap:0),mid=(x(row.split-1)+x(row.split))/2;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} 340`);svg.setAttribute('role','group');svg.setAttribute('aria-label',`全长${row.target.length}nt ${kind==='mut'?'Mut':'WT'}靶标、识别臂及Spacer潜在延伸配对`);
    function add(tag,attrs,text){const e=document.createElementNS(svg.namespaceURI,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;svg.append(e);return e;}
    const all=probeRegions(candidate,data).slice(1,-1),arcRegions=all.map(r=>({...r,start:r.key==='linker_a'?r.start+row.extraLeft:r.start,end:r.key==='linker_c'?r.end-row.extraRight:r.end})).filter(r=>r.end>r.start);
    const arcLength=arcRegions.reduce((n,r)=>n+r.end-r.start,0),arcStart=candidate.length5+row.extraLeft;
    for(const r of arcRegions){
      const path=add('path',{d:`M ${x(row.start5-row.extraLeft)} 162 C ${x(row.start5-row.extraLeft)} 12, ${x(row.end3-1+row.extraRight)} 12, ${x(row.end3-1+row.extraRight)} 162`,pathLength:arcLength,fill:'none',stroke:r.diagramColor,'stroke-width':r.key.startsWith('linker_')?1.5:4,'stroke-dasharray':`${r.end-r.start} ${arcLength}`,'stroke-dashoffset':-(r.start-arcStart),'data-region':r.key});
      const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=`${r.label} · ${r.end-r.start}nt未画入延伸配对`;path.append(title);
      path.setAttribute('role','button');path.setAttribute('tabindex','0');path.setAttribute('aria-label',`编辑${r.label}`);path.classList.add('editable-region');path.addEventListener('click',()=>openModuleEditor(r.key,candidate.id));path.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();openModuleEditor(r.key,candidate.id);}});
    }
    add('text',{x:width/2,y:34,'text-anchor':'middle',fill:'#737780','font-size':14},`全长靶标 ${row.target.length} nt · 骨架 ${(candidate.modules||data.modules).backbone.length} nt`);
    add('text',{x:mid,y:104,'text-anchor':'middle',fill:'#737780','font-size':13},'连接位点');add('line',{x1:mid,y1:111,x2:mid,y2:143,stroke:'#737780'});
    add('text',{x:x(row.split-1),y:145,'text-anchor':'middle',fill:REGION_COLORS.arm5.color,'font-size':12},'5′-P');add('text',{x:x(row.split),y:145,'text-anchor':'middle',fill:REGION_COLORS.arm3.color,'font-size':12},'3′');
    for(let i=0;i<row.target.length;i++){
      const variant=i===row.mutationIndex,paired=row.roles[i]!=='flank',spacer=row.roles[i].startsWith('spacer'),match=paired&&({A:'T',T:'A',G:'C',C:'G'})[row.probe[i]]===row.target[i];
      if(variant||spacer)add('rect',{x:x(i)-9,y:152,width:18,height:89,rx:4,fill:spacer?'#FFF0CC':match?'#F2E3E6':'#F8E8E7'});
      if(paired){const color=spacer?'#947228':row.roles[i]==='arm5'?REGION_COLORS.arm5.color:REGION_COLORS.arm3.color;add('text',{x:x(i),y:177,'text-anchor':'middle',fill:color,'font-family':'monospace','font-size':17},row.probe[i]);if(spacer)add('line',{x1:x(i),y1:187,x2:x(i),y2:211,stroke:'#B98D32','stroke-width':1.3,'stroke-dasharray':'2 2'});else add('text',{x:x(i),y:202,'text-anchor':'middle',fill:match?'#C3C7CE':'#B64F52','font-size':15},match?'│':'×');}
      add('text',{x:x(i),y:224,'text-anchor':'middle',fill:paired?'#424852':'#9A9FA6','font-family':'monospace','font-size':17,'data-target-position':i+1},row.target[i]);
      if(i===0||i===row.target.length-1||(i+1)%5===0)add('text',{x:x(i),y:247,'text-anchor':'middle',fill:'#737780','font-size':10},String(i+1));
    }
    add('text',{x:5,y:177,fill:'#737780','font-size':12},'探针');add('text',{x:5,y:224,fill:'#737780','font-size':12},'靶标5′');add('text',{x:x(row.target.length-1)+20,y:224,fill:'#737780','font-size':12},'3′');
    add('text',{x:(x(row.start5)+x(row.end5-1))/2,y:278,'text-anchor':'middle',fill:REGION_COLORS.arm5.color,'font-size':13},`5′识别臂 ${candidate.length5} nt · 靶标${row.start5+1}–${row.end5}`);
    add('text',{x:(x(row.start3)+x(row.end3-1))/2,y:278,'text-anchor':'middle',fill:REGION_COLORS.arm3.color,'font-size':13},`3′识别臂 ${candidate.arm3.length} nt · 靶标${row.start3+1}–${row.end3}`);
    add('text',{x:width/2,y:316,'text-anchor':'middle',fill:row.extraLeft||row.extraRight?'#947228':'#737780','font-size':12},row.extraLeft||row.extraRight?`黄色虚线：Spacer1/3潜在延伸 ${row.extraLeft}/${row.extraRight} nt；灰色靶标：未由识别臂覆盖`:'Spacer1/3：紧邻识别臂的连续延伸配对 0 / 0 nt；灰色靶标：未由识别臂覆盖');
    picture.replaceChildren(svg);
    caption.textContent=(kind==='mut'?`Mut · ${row.probe[row.mutationIndex]}–${data.variant.mut} 匹配`:`WT · ${row.probe[row.mutationIndex]}–${data.variant.wt} 错配`)+` · 已显示全长${row.target.length} nt`;
    const hits=spacerTargetHits(candidate,data,kind);screen.textContent=hits.length?`Spacer连续互补初筛：${hits.slice(0,5).map(h=>`${h.name}↔靶标${h.targetStart}–${h.targetEnd}（${h.length}nt）`).join('；')}。仅序列互补，不是已发生结合。`:'Spacer连续互补初筛：未发现≥6 nt连续互补；短片段配对仍可能发生。';
  }
  for(const [kind,label] of [['mut','看 Mut：匹配'],['wt','看 WT：错配']]){const b=node('button',label,'btn');b.type='button';b.dataset.kind=kind;b.addEventListener('click',()=>show(kind));buttons.push(b);controls.append(b);}
  box.append(controls,picture,caption,screen);show('mut');return box;
}
function candidateExplanation(c,data) {
  const details=node('div',undefined,'explanation');
  details.append(regionLegend(probeRegions(c,data),c.id));
  details.append(node('p','点击彩色模块，编辑对应序列。','figure-hint'));
  const panels=node('div',undefined,'structure-panels');
  const binding=node('section',undefined,'structure-panel');binding.append(node('h4','a  ·  靶标配对'),bindingView(c,data));
  const folding=node('section',undefined,'structure-panel');folding.append(node('h4','b  ·  自身折叠'),foldDrawing(c,data));
  const paired=s=>[...s].filter(b=>b==='('||b===')').length;
  folding.append(node('p',`识别臂自身配对：5′ ${paired(c.fold.structure.slice(0,c.length5))}/${c.length5} nt · 3′ ${paired(c.fold.structure.slice(-c.length3))}/${c.length3} nt`,'figure-caption'),node('p',`${data.models.fold_temperature_C}°C · Na⁺+K⁺ ${data.models.fold_monovalent_mM} mM · 允许 GU 配对 · Mg²⁺/Tris 未建模`,'figure-caption'));
  folding.hidden=true;
  const views=node('div',undefined,'view-switch');
  for(const [label,panel] of [['靶标配对',binding],['自身折叠',folding]]){
    const button=node('button',label,'btn');button.type='button';button.setAttribute('aria-pressed',String(panel===binding));
    button.addEventListener('click',()=>{binding.hidden=panel!==binding;folding.hidden=panel!==folding;for(const b of views.children)b.setAttribute('aria-pressed',String(b===button));});views.append(button);
  }
  panels.append(binding,folding);details.append(views,panels);
  const count=data.candidates.filter(other=>other.arm3===c.arm3).length;
  details.append(node('p',`臂 Tm：${fixed(c.tm5)} / ${fixed(c.tm3)}°C · 连接温度：${data.input.temperature_c}°C${count>1?` · ${count} 条候选共用此 3′ 臂`:''}`,'candidate-metrics'));
  if(c.recommendation_note)details.append(node('p',c.recommendation_note,'figure-hint'));
  const tech=node('details');tech.append(node('summary','序列与计算详情'),node('p',`5′ 臂：${c.arm5}`,'sequence'),node('p',`3′ 臂：${c.arm3}`,'sequence'),node('p',`MFE ${c.fold.mfe.toFixed(2)} kcal/mol；平均未配对 ${fixed(c.fold.mean_unpaired5*100)}% / ${fixed(c.fold.mean_unpaired3*100)}%。不是整臂开放概率。`));
  details.append(tech);return details;
}
function foldDrawing(c,data){
  const wrapper=node('div',undefined,'fold-comparison'),layout=node('div',undefined,'fold-layout'),drawing=node('div',undefined,'fold-main'),rail=node('div',undefined,'fold-rail');
  rail.setAttribute('aria-label','预测构象列表');
  const structures=[c.fold,...(c.fold.alternatives||[])].slice(0,3),buttons=[];
  function update(i){
    drawing.replaceChildren(foldDrawingSingle({...c,fold:{...c.fold,...structures[i]}},data));
    buttons.forEach((button,j)=>button.setAttribute('aria-pressed',String(i===j)));
  }
  structures.forEach((f,i)=>{
    const button=node('button',undefined,'fold-thumb');button.type='button';
    button.setAttribute('aria-label',`构象 ${i+1}${i===0?' · 最低自由能':''} · ΔG ${f.mfe.toFixed(2)} kcal/mol · ${f.pairs.length} 对配对`);
    button.append(node('span',String(i+1),'fold-thumb-number'));
    const preview=foldDrawingSingle({...c,fold:{...c.fold,...f}},data).querySelector('svg');
    if(preview){preview.removeAttribute('role');preview.setAttribute('aria-hidden','true');preview.querySelectorAll('text,title').forEach(el=>el.remove());button.append(preview);}
    button.append(node('small',`${f.mfe.toFixed(2)} kcal/mol`));
    button.addEventListener('click',()=>update(i));buttons.push(button);rail.append(button);
  });
  layout.append(drawing,rail);wrapper.append(layout,node('p','其他构象由 Zuker 配对约束法生成，按能量排列；并非完整构象集合，也不代表出现概率。二维坐标只表达配对拓扑。','fold-legend'));
  update(0);return wrapper;
}
function foldDrawingSingle(c,data) {
  const regions=probeRegions(c,data);
  const box=node('div',undefined,'fold-drawing');
  box.append(node('p',`所选构象 ΔG = ${c.fold.mfe.toFixed(2)} kcal/mol · ${c.fold.pairs.length} 对配对 · ViennaRNA · DNA Mathews2004 · 线性 ssDNA`,'fold-legend'));
  if(!c.fold.pairs.length)box.append(node('p','所选构象无配对。下图仅为序列排布，不代表真实构象或已环化；其他构象仍可能发生配对。','fold-legend'));
  const points=c.fold.coordinates;
  if(!points?.length) {box.append(node('p','请重新生成候选以加载折叠图。'));return box;}
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs)-32,minY=Math.min(...ys)-32,w=Math.max(...xs)-minX+32,h=Math.max(...ys)-minY+32;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`${minX} ${minY} ${w} ${h}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`${c.id} · ${c.fold.pairs.length?'所选预测配对结构':'无配对序列排布'}；颜色与模块图例一致`);
  function add(tag,attrs,text){const el=document.createElementNS(svg.namespaceURI,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);if(text!==undefined)el.textContent=text;svg.append(el);return el;}
  add('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#CDD0D6','stroke-width':1.4});
  for(const [i,j] of c.fold.pairs)add('line',{x1:points[i][0],y1:points[i][1],x2:points[j][0],y2:points[j][1],stroke:'#8C929C','stroke-width':1.4,'stroke-dasharray':'2 2'});
  points.forEach(([x,y],i)=>{
    const region=regions.find(r=>i>=r.start&&i<r.end),color=region.color;
    const circle=add('circle',{cx:x,cy:y,r:5.7,fill:region.diagramColor,'data-region':region.key});
    const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=`第${i+1}位 ${c.sequence[i]} · ${region.label}`;circle.append(title);
    add('text',{x,y:y+2.4,'text-anchor':'middle',fill:'#252A30','font-family':'monospace','font-size':7},c.sequence[i]);
    if(i===0||i===points.length-1)add('text',{x:x+(i===0?-12:12),y:y-9,'text-anchor':i===0?'end':'start',fill:color,'font-size':12,'font-weight':700},i===0?'5′':'3′');
  });
  box.append(svg);return box;
}
if(typeof module!=='undefined') module.exports={bindingRows,spacerTargetHits};
