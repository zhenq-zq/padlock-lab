const {test}=require('node:test');
const assert=require('node:assert/strict');
const {REGION_COLORS,probeRegions}=require('../m0-dashboard/region-colors.js');
test('region coverage follows edited lengths, including empty linkers',()=>{
  for(const lengths of [[3,19,10,23,5],[0,16,4,20,0]]){
    const keys=['linker_a','primer','linker_b','guide','linker_c'];
    const settings=Object.fromEntries(keys.map((k,i)=>[k,'A'.repeat(lengths[i])]));
    const c={arm5:'GGGG',arm3:'TT',sequence:'GGGG'+'A'.repeat(lengths.reduce((a,b)=>a+b,0))+'TT'};
    const r=probeRegions(c,{modules:{settings}});
    assert.equal(r.map(x=>x.sequence).join(''),c.sequence);
    for(let i=0;i<c.sequence.length;i++)assert.equal(r.filter(x=>x.start<=i&&i<x.end).length,1);
    assert.equal(r.find(x=>x.key==='primer').start,4+lengths[0]);
    assert.equal(r.find(x=>x.key==='guide').start,4+lengths[0]+lengths[1]+lengths[2]);
  }
});
test('functional regions differ, linkers share gray, and stale lengths are rejected',()=>{
  assert.equal(new Set(['arm5','primer','guide','arm3'].map(k=>REGION_COLORS[k].diagramColor)).size,4);
  assert.equal(new Set(['linker_a','linker_b','linker_c'].map(k=>REGION_COLORS[k].diagramColor)).size,1);
  assert.throws(()=>probeRegions({arm5:'A',arm3:'T',sequence:'AT'},{modules:{settings:{linker_a:'A',primer:'A',linker_b:'',guide:'A',linker_c:''}}}),/不一致/);
});
