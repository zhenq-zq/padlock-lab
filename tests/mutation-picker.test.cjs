const {test} = require('node:test');
const assert = require('node:assert/strict');
const {MutationInput} = require('../m0-dashboard/mutation-input.js');
const WT='CTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACGATACA';
test('clicked 1-based position produces exactly one G to A at KRAS 31',()=>{
  const m=new MutationInput(); m.setWT(WT); m.select(31); m.replace('A');
  assert.equal(m.mut,'CTGAATATAAACTTGTGGTAGTTGGAGCTGATGGCGTAGGCAAGAGTGCCTTGACGATACA');
  assert.equal(m.ready,true);
  assert.deepEqual([...WT].flatMap((b,i)=>b===m.mut[i]?[]:[i+1]),[31]);
});
test('changing WT or selected position clears previous mutation',()=>{
  const m=new MutationInput(); m.setWT(WT); m.select(31); m.replace('A');
  m.select(30); assert.equal(m.mut,''); assert.equal(m.ready,false);
  m.replace('T'); m.setWT('A'+WT.slice(1));
  assert.equal(m.position,null); assert.equal(m.mut,'');
});
test('case/whitespace normalization preserves the same valid selection',()=>{
  const m=new MutationInput(); m.setWT(WT); m.select(31); m.replace('A');
  m.setWT(' '+WT.toLowerCase()+'\n'); assert.equal(m.ready,true); assert.equal(m.position,31);
});
test('same base, ambiguity, missing selection and off-sequence positions are rejected',()=>{
  const m=new MutationInput(); m.setWT(WT);
  assert.throws(()=>m.replace('A'));
  for(const p of [0,62,1.5]) assert.throws(()=>m.select(p));
  m.select(31); assert.throws(()=>m.replace('G')); assert.throws(()=>m.replace('N'));
  m.setWT('N'+WT.slice(1)); assert.equal(m.validWT,false); assert.equal(m.ready,false);
});
test('end positions can be inspected but not submitted without enough flanks',()=>{
  const m=new MutationInput(); m.setWT(WT); m.select(1); m.replace('A');
  assert.equal(m.mut[0],'A'); assert.equal(m.ready,false); assert.match(m.problem,/上游/);
  m.select(61); m.replace('G'); assert.equal(m.ready,false); assert.match(m.problem,/下游/);
  m.select(17); m.replace(WT[16]==='A'?'C':'A'); assert.equal(m.ready,true);
});
