'use strict';
function parseSequence(text) {
  const lines=text.trim().split(/\r?\n/);
  const headers=lines.filter(line=>line.trim().startsWith('>'));
  if(headers.length>1) throw new Error(' Import exactly one  FASTA  sequence ， do not merge records 。');
  let name='';
  if(headers.length) {
    if(!lines[0].startsWith('>')) throw new Error('FASTA  The header must be on the first line 。');
    name=lines.shift().slice(1).trim();
  }
  const sequence=lines.join('').replace(/\s+/g,'').toUpperCase();
  if(!sequence) throw new Error(' No sequence found 。');
  return {name,sequence};
}
if(typeof module!=='undefined'&&module.exports) module.exports={parseSequence};
