'use strict';
function filterVariants(rows,query='',gene='all') {
  const terms=query.trim().toUpperCase().split(/\s+/).filter(Boolean);
  return rows.filter(row=>(gene==='all'||row.gene===gene) && terms.every(term=>`${row.name} ${row.hgvs}`.toUpperCase().includes(term)));
}
function matchVariant(rows,wt,position,alt) {
  return rows.find(row=>row.wt===wt && row.position===position && row.alt===alt)||null;
}
if(typeof module!=='undefined') module.exports={filterVariants,matchVariant};
