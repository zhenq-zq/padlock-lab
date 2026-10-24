'use strict';
// Shared by every sequence and schematic; indices are zero-based, half-open.
// User-selected original reference HEX values; no derived functional colors.
const REGION_COLORS={
  arm5:{label:'5′ 臂',color:'#9A4240',diagramColor:'#C87D7A',background:'#FFFFFF'},
  linker_a:{label:'连接区 A',color:'#6D727A',diagramColor:'#9CA1A9',background:'#EFF0F2'},
  primer:{label:'Primer 位点',color:'#24628F',diagramColor:'#3578A9',background:'#FFFFFF'},
  linker_b:{label:'连接区 B',color:'#6D727A',diagramColor:'#9CA1A9',background:'#EFF0F2'},
  guide:{label:'Cas12a 编码区',color:'#9B4663',diagramColor:'#E7B9C8',background:'#FFFFFF'},
  linker_c:{label:'连接区 C',color:'#6D727A',diagramColor:'#9CA1A9',background:'#EFF0F2'},
  arm3:{label:'3′ 臂',color:'#4F7626',diagramColor:'#BBD49A',background:'#FFFFFF'}
};
function probeRegions(c,data){
  const m=(c.modules||data.modules).settings;
  let start=0;const regions=[];
  function add(key,length,label){const end=start+length;regions.push({key,...REGION_COLORS[key],label:label||REGION_COLORS[key].label,start,end,sequence:c.sequence.slice(start,end)});start=end;}
  add('arm5',c.arm5.length);add('linker_a',m.linker_a.length);add('primer',m.primer.length);add('linker_b',m.linker_b.length);
  const gaps=m.zone_linkers?m.zone_linkers.split(','):[];
  for(let i=0;i<(m.zone_count||1);i++){if(i)add('linker_b',gaps[i-1].length,'重复区间隔');add('guide',m.guide.length,`Cas12a 区 ${i+1}`);}
  add('linker_c',m.linker_c.length);add('arm3',c.arm3.length);
  if(start!==c.sequence.length)throw new Error('模块长度与探针不一致，请重新生成。');
  return regions;
}
function paintRegion(element,key){const r=REGION_COLORS[key];element.style.color=r.color;element.style.backgroundColor=r.background;element.style.setProperty('--region-swatch',r.diagramColor);element.dataset.region=key;return element;}
function regionLegend(regions,candidateId){
  const legend=node('div',undefined,'region-legend');
  for(const r of regions.filter(r=>r.end>r.start)){
    const editable=!r.key.startsWith('arm'),el=paintRegion(node(editable?'button':'span',`${r.label} · ${r.end-r.start} nt`),r.key);
    if(editable){el.type='button';el.title=`编辑${r.label}`;el.addEventListener('click',()=>openModuleEditor(r.key,candidateId));}
    legend.append(el);
  }
  return legend;
}
if(typeof module!=='undefined')module.exports={REGION_COLORS,probeRegions};
