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
    if(!this.validWT || !Number.isInteger(position) || position<1 || position>this.wt.length) throw new Error(' Select a base within the sequence 。');
    if(position!==this.position) this.alt=null;
    this.position=position;
  }
  replace(base) {
    if(this.position===null || !/^[ACGT]$/.test(base) || base===this.wt[this.position-1]) throw new Error(' Choose an alternate different from the WT  A、C、G  or  T。');
    this.alt=base;
  }
  get mut() { return this.position!==null && this.alt ? this.wt.slice(0,this.position-1)+this.alt+this.wt.slice(this.position) : ''; }
  get problem() {
    if(!this.wt) return ' Enter  WT， or choose an example 。';
    if(!this.validWT) return 'WT  must contain  25–1000 nt， containing only  A/C/G/T； Whitespace and line breaks are accepted 。';
    if(this.position===null) return ' Click a  entries  base grid ， Choose variant position 。';
    if(this.position<17) return ' Insufficient upstream sequence  16 nt， add upstream sequence 。';
    if(this.wt.length-this.position<8) return ' Insufficient downstream sequence  8 nt， add downstream sequence 。';
    if(!this.alt) return ' Position selected ， then choose the alternate base 。';
    return '';
  }
  get ready() { return !this.problem; }
}
if(typeof module!=='undefined' && module.exports) module.exports={MutationInput};
