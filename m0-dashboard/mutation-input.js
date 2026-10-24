'use strict';
// One source of truth: a normalized WT and one 1-based substitution.
class MutationInput {
  constructor() { this.wt=''; this.position=null; this.alt=null; }
  setWT(text) {
    const next=text.replace(/\s+/g,'').toUpperCase();
    if(next!==this.wt) { this.position=null; this.alt=null; }
    this.wt=next;
  }
  get validWT() { return this.wt.length>=25 && this.wt.length<=1000 && /^[ACGT]+$/.test(this.wt); }
  select(position) {
    if(!this.validWT || !Number.isInteger(position) || position<1 || position>this.wt.length) throw new Error('请选择序列内的碱基。');
    if(position!==this.position) this.alt=null;
    this.position=position;
  }
  replace(base) {
    if(this.position===null || !/^[ACGT]$/.test(base) || base===this.wt[this.position-1]) throw new Error('请选择与原碱基不同的 A、C、G 或 T。');
    this.alt=base;
  }
  get mut() { return this.position!==null && this.alt ? this.wt.slice(0,this.position-1)+this.alt+this.wt.slice(this.position) : ''; }
  get problem() {
    if(!this.wt) return '先输入 WT，或选择一个示例。';
    if(!this.validWT) return 'WT 需为 25–1000 nt，仅含 A/C/G/T；可粘贴带空格或换行的序列。';
    if(this.position===null) return '点击一个碱基格，选择突变位置。';
    if(this.position<17) return '此位点上游不足 16 nt，请补充上游序列。';
    if(this.wt.length-this.position<8) return '此位点下游不足 8 nt，请补充下游序列。';
    if(!this.alt) return '选好位置了，再选择要变成的碱基。';
    return '';
  }
  get ready() { return !this.problem; }
}
if(typeof module!=='undefined' && module.exports) module.exports={MutationInput};
