const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseSequence}=require('../m0-dashboard/sequence-import.js');
test('single FASTA header and wrapped sequence normalize without losing a base',()=>{
 assert.deepEqual(parseSequence('>virus_sample\nacgt ac\nTG\n'),{name:'virus_sample',sequence:'ACGTACTG'});
});
test('plain sequence normalizes whitespace',()=>assert.equal(parseSequence('acg t\nAC').sequence,'ACGTAC'));
test('multiple records and empty FASTA never silently merge',()=>{
 assert.throws(()=>parseSequence('>one\nACGT\n>two\nTGCA'),/一条/);
 assert.throws(()=>parseSequence('>empty\n'),/序列/);
});
