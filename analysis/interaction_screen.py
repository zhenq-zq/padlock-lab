"""Exact-complement triage across complete oligos, not mixed-material thermodynamics."""
from functools import lru_cache
try:
    from .module_design import RC
except ImportError:
    from module_design import RC
HARD_REJECT_NT=8
REVIEW_FLAG_NT=6

def dna(s):return s.upper().replace('U','T')

@lru_cache(maxsize=4096)
def longest_complement(a,b):
    a,b=dna(a),dna(b)
    for n in range(min(len(a),len(b)),0,-1):
        for i in range(len(a)-n+1):
            match=RC(a[i:i+n]);j=b.find(match)
            if j>=0:return {'length_nt':n,'a_start_0':i,'b_start_0':j,'a_sequence':a[i:i+n]}
    return {'length_nt':0,'a_start_0':None,'b_start_0':None,'a_sequence':''}

def terminal_complement(a,b):
    a,b=dna(a),dna(b)
    return next((n for n in range(len(a),0,-1) if RC(a[-n:]) in b),0)

def masked(seq,intervals):
    result=list(seq)
    for a,b in intervals:result[a:b]=['N']*(b-a)
    return ''.join(result)

def interaction_report(arm5,arm3,module,wt,mut):
    primer=module['settings']['primer'];crrna=dna(module['crrna'])
    probe=arm5+module['backbone']+arm3;n=len(probe);l=len(arm5)
    pa,pb=module['ranges']['primer'];unintended_probe=masked(probe,[(l+pa,l+pb)])
    product=RC(probe)
    activators=[(n-l-b,n-l-a) for a,b in module['ranges']['guide_sites']]
    outside=masked(product,activators)
    pairs=[('crrna_vs_primer',crrna,primer,False),
           ('crrna_vs_padlock',crrna,probe+probe,False),
           ('crrna_vs_rca_outside_activator',crrna,outside+outside,False),
           ('primer_vs_padlock_outside_binding_site',primer,unintended_probe+unintended_probe,True),
           ('primer_vs_rca',primer,product+product,True)]
    for kind,target in [('wt',wt),('mut',mut)]:
        pairs.extend([(f'primer_vs_{kind}_forward',primer,target,True),(f'primer_vs_{kind}_reverse',primer,RC(target),True)])
    checks=[]
    for identifier,a,b,terminal in pairs:
        m=longest_complement(a,b);t=terminal_complement(a,b) if terminal else None
        checks.append({'id':identifier,'max_complement_nt':m['length_nt'],'a_start_0':m['a_start_0'],'b_start_0':m['b_start_0'],
                       'primer_3prime_complement_nt':t,'reject':m['length_nt']>=HARD_REJECT_NT,
                       'review':REVIEW_FLAG_NT<=m['length_nt']<HARD_REJECT_NT})
    return {'passes':not any(v['reject'] for v in checks),'hard_reject_nt':HARD_REJECT_NT,'review_flag_nt':REVIEW_FLAG_NT,
            'checks':checks,'review_flags':[v['id'] for v in checks if v['review']],
            'scope':'Full crRNA handle+spacer; primer; padlock circular junction; two RCA sequence units with intended activator sites masked; both supplied target strands.',
            'limitations':'Exact sequence-complement heuristic only. Thresholds are engineering choices, not calibrated interference probabilities. No mixed DNA/RNA free energies, RNP kinetics or genome-wide search.'}
