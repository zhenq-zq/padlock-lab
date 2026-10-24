const {test}=require('node:test');
const assert=require('node:assert/strict');
const {bindingRows}=require('../m0-dashboard/binding-view.js');
const rows=require('../m0-dashboard/variant-catalog.js');
const comp=s=>[...s].map(b=>({A:'T',T:'A',G:'C',C:'G'})[b]).join('');
test('full catalog targets retained; arms antiparallel; WT mismatch stays at absolute nick',()=>{
 for(const row of rows){
  const k=row.position-1,start=k-17,end=k+10;
  const mut=row.wt.slice(0,k)+row.alt+row.wt.slice(k+1);
  const c={arm5:[...comp(mut.slice(start,k))].reverse().join(''),arm3:[...comp(mut.slice(k,end))].reverse().join(''),target5:[start+1,k],target3:[k+1,end],length5:17};
  const data={input:{wt:row.wt,mut},variant:{position:row.position}};
  const match=bindingRows(c,data),mismatch=bindingRows(c,data,'wt');
  assert.equal(match.target,mut);assert.equal(match.start,1);
  assert.equal(match.probe.slice(start,end),comp(mut.slice(start,end)));
  assert.equal(match.mutationIndex,k);assert.equal(match.split,k);
  assert.deepEqual([...mismatch.target].flatMap((b,i)=>mismatch.probe[i]!==' '&&comp(b)!==mismatch.probe[i]?[i]:[]),[k]);
 }
});
test('original18nt arm keeps Spacer1TC extension separate on full50nt target',()=>{
 const target='TTCATGAAACAAATGAATGATGCACGTCATGGTGGCTGGACAACAAAAAT';
 const c={arm5:'GTGCATCATTCATTTGTT',arm3:'GCCACCATGAC',length5:18,target5:[8,25],target3:[26,36],modules:{settings:{linker_a:'TCCTC',linker_c:'TCTTT',linker_b:'GTCAGTACGT',zone_linkers:''}}};
 const r=bindingRows(c,{input:{mut:target},variant:{position:26}});
 assert.equal(r.target.length,50);assert.equal(r.extraLeft,2);assert.equal(r.extraRight,0);
 assert.equal(r.roles[5],'spacer5');assert.equal(r.roles[6],'spacer5');assert.equal(r.roles[7],'arm5');
 assert.equal(r.probe.slice(5,7),'CT');assert.equal(r.probe.slice(7,25),comp(target.slice(7,25)));
 const changed={...c,modules:{settings:{...c.modules.settings,linker_a:'AACTC'}}};
 assert.equal(bindingRows(changed,{input:{mut:target},variant:{position:26}}).extraLeft,0);
});
