const {test}=require('node:test');
const assert=require('node:assert/strict');
const {filterVariants,matchVariant}=require('../m0-dashboard/variant-library.js');
const rows=[{id:'KRAS-G12D',name:'KRAS G12D',gene:'KRAS',hgvs:'NM_004985.5:c.35G>A',wt:'ACG',position:2,alt:'T'},{id:'EGFR-L858R',name:'EGFR L858R',gene:'EGFR',hgvs:'NM_005228.5:c.2573T>G'}];
test('search accepts case, HGVS and multiple terms; gene filter combines with query',()=>{
  assert.equal(filterVariants(rows,'kras g12','all').length,1);
  assert.equal(filterVariants(rows,'c.35G>A','KRAS').length,1);
  assert.equal(filterVariants(rows,'G12D','EGFR').length,0);
  assert.equal(filterVariants(rows,'missing','all').length,0);
});
test('provenance requires exact WT, selected position and alternate allele',()=>{
  assert.equal(matchVariant(rows,'ACG',2,'T')?.id,'KRAS-G12D');
  assert.equal(matchVariant(rows,'ACG',2,'A'),null);
  assert.equal(matchVariant(rows,'ATG',2,'T'),null);
});
