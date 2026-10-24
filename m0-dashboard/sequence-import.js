'use strict';
function parseSequence(text) {
  const lines=text.trim().split(/\r?\n/);
  const headers=lines.filter(line=>line.trim().startsWith('>'));
  if(headers.length>1) throw new Error('请一次导入一条 FASTA 序列，不要合并多个记录。');
  let name='';
  if(headers.length) {
    if(!lines[0].startsWith('>')) throw new Error('FASTA 标题必须位于第一行。');
    name=lines.shift().slice(1).trim();
  }
  const sequence=lines.join('').replace(/\s+/g,'').toUpperCase();
  if(!sequence) throw new Error('没有找到序列。');
  return {name,sequence};
}
if(typeof module!=='undefined'&&module.exports) module.exports={parseSequence};
