"""Bounded co-design for a synthetic single-zone RCA activator; never an activity predictor."""
import hashlib
import random
import re
from functools import lru_cache
import RNA
from Bio.SeqUtils import MeltingTemp as mt
try:
    from .module_design import assemble,DEFAULTS,HANDLE,RC
except ImportError:
    from module_design import assemble,DEFAULTS,HANDLE,RC

try:
    from .boundary_extension import screen as boundary_screen,passes as boundary_passes,separate_boundaries
except ImportError:
    from boundary_extension import screen as boundary_screen,passes as boundary_passes,separate_boundaries

try:
    from .interaction_screen import interaction_report
except ImportError:
    from interaction_screen import interaction_report

RULES={'cross_complement_reject_nt':8,'cross_complement_review_nt':6,'cross_scope':'full crRNA, primer, padlock, unintended RCA, both target strands',
       'boundary_extension_max_nt':0,'boundary_check_targets':['WT','Mut'],'boundary_spacer_repair':'Only boundary-facing nucleotide of A/C may change; lengths preserved',
       'seed_version':20261023,'primer_pool':16,'guide_pool':16,'shortlist_each':8,
       'primer_length_nt':[19,24],'guide_length_nt':[20,24],'gc_fraction':[0.35,0.65],
       'homopolymer_limit':3,'primer_tm_margin_C':[5,25],'primer_tm_reference_margin_C':15,
       'primer_tm_concentration_nM':500,'homodimer_deltaG_floor':-7,
       'guide_spacer_open_floor':0.45,'target_exact_match_reject_nt':16,
       'unintended_primer_3prime_match_reject_nt':8,
       'fold_Mg_modeled':False,'ranking':'Transparent heuristic; no activity, LOD or global-optimum claim.'}

def sane(seq):
    return 0.35<=sum(x in 'GC' for x in seq)/len(seq)<=0.65 and re.search(r'(A{4}|C{4}|G{4}|T{4})',seq) is None

def tail_match(primer,other):
    for n in range(len(primer),0,-1):
        if RC(primer[-n:]) in other:return n
    return 0

@lru_cache(maxsize=512)
def dna_mfe(seq,temperature,salt):
    RNA.params_load_DNA_Mathews2004();md=RNA.md();md.temperature=temperature;md.salt=salt/1000;md.noGU=0;md.dangles=2
    return float(RNA.fold_compound(seq,md).mfe()[1])

@lru_cache(maxsize=256)
def rna_spacer_metrics(guide,temperature,salt):
    RNA.params_load_RNA_Turner2004()
    try:
        seq=HANDLE+guide.replace('T','U');md=RNA.md();md.temperature=temperature;md.salt=salt/1000;md.dangles=2
        fc=RNA.fold_compound(seq,md);structure,e=fc.mfe();fc.exp_params_rescale(e);fc.pf();bpp=fc.bpp();unpaired=[]
        for i in range(len(HANDLE)+1,len(seq)+1):
            unpaired.append(max(0.,1-sum(bpp[min(i,j)][max(i,j)] for j in range(1,len(seq)+1) if j!=i)))
        return {'model':'RNA Turner2004','structure':structure,'mfe':float(e),'spacer_open':sum(unpaired)/len(unpaired)}
    finally:RNA.params_load_DNA_Mathews2004()

@lru_cache(maxsize=32)
def pools(wt,mut,temperature,salt):
    seed=int(hashlib.sha256((wt+'|'+mut+'|20261023').encode()).hexdigest()[:16],16);rng=random.Random(seed)
    primers=[];guides=[];seenp=set();seeng=set()
    for _ in range(8000):
        if len(primers)<RULES['primer_pool']:
            seq=''.join(rng.choices('ACGT',k=rng.randint(19,24)))
            if seq not in seenp and sane(seq) and all(tail_match(seq,target)<8 for target in [wt,mut,RC(wt),RC(mut)]):
                seenp.add(seq)
                tm=float(mt.Tm_NN(seq,nn_table=mt.DNA_NN4,dnac1=500,dnac2=0,Na=0,K=salt,Tris=0,Mg=0,dNTPs=0,saltcorr=7))
                hairpin=dna_mfe(seq,temperature,salt);dim=dna_mfe(seq+'&'+seq,temperature,salt)-2*hairpin
                if temperature+5<=tm<=temperature+25 and dim>=-7 and tail_match(seq,seq)<8:
                    primers.append({'sequence':seq,'tm_C':tm,'hairpin_mfe':hairpin,'dimer_deltaG':dim,'quality':abs(tm-temperature-15)/10+max(0,-hairpin)/3+max(0,-dim)/7})
        if len(guides)<RULES['guide_pool']:
            seq=''.join(rng.choices('ACGT',k=rng.randint(20,24)))
            if seq not in seeng and sane(seq):
                seeng.add(seq)
                # Avoid an exact activator match to either strand of the supplied local target.
                if any(seq[i:i+16] in target for i in range(len(seq)-15) for target in [wt,mut,RC(wt),RC(mut)]):continue
                m=rna_spacer_metrics(seq,temperature,salt)
                if m['spacer_open']>=.45:guides.append({'sequence':seq,'rna':m,'quality':1-m['spacer_open']})
        if len(primers)==16 and len(guides)==16:break
    if len(primers)<3 or len(guides)<3:raise ValueError('当前约束下未获得足够的新 primer/gRNA 候选；请检查靶标或温度，未自动放宽规则。')
    return sorted(primers,key=lambda v:(v['quality'],v['sequence']))[:8],sorted(guides,key=lambda v:(v['quality'],v['sequence']))[:8],seed

def generate_joint(data,base):
    try:
        from .design_candidates import fold_probe,describe,number
    except ImportError:
        from design_candidates import fold_probe,describe,number
    inp=base['input'];t=inp['temperature_c'];ligation_salt=inp['k_mm']+inp['na_mm']
    salt=number(data,'readout_monovalent_mm',ligation_salt,0.001,2000)
    readout=data.get('readout_temperature_c',37)
    if isinstance(readout,bool):raise ValueError('读出温度必须为10–80°C的数值。')
    try:readout=float(readout)
    except (TypeError,ValueError):raise ValueError('读出温度必须为10–80°C的数值。') from None
    if not 10<=readout<=80:raise ValueError('读出温度必须为10–80°C的数值。')
    if base['modules']['settings']['zone_count']!=1:raise ValueError('联合设计当前只支持单 Cas12a 区；3-zone研究保留归档。')
    primer_pool,guide_pool,seed=pools(inp['wt'],inp['mut'],readout,salt)
    arms=[];seen=set()
    for c in base['candidates']:
        pair=(c['arm5'],c['arm3'])
        if pair not in seen:arms.append(c);seen.add(pair)
    if not arms:raise ValueError('未获得可用识别臂，无法进行联合设计。')
    rows=[];interaction_rejected=0
    for arm in arms:
        for pr in primer_pool:
            for gr in guide_pool:
                p,g=pr['sequence'],gr['sequence']
                if tail_match(p,g)>=8 or tail_match(p,RC(g))>=8:continue
                settings={**base['modules']['settings'],'primer':p,'guide':g.replace('T','U'),'zone_count':1,'zone_linkers':''}
                settings=separate_boundaries(settings,arm,inp['wt'],inp['mut'])
                boundary=boundary_screen(arm,inp['wt'],inp['mut'],settings)
                if not boundary_passes(boundary):continue
                m=assemble(settings)
                interactions=interaction_report(arm['arm5'],arm['arm3'],m,inp['wt'],inp['mut'])
                if not interactions['passes']:
                    interaction_rejected+=1
                    continue
                c=describe(arm['arm5'],arm['arm3'],inp['probe_nm'],inp['tm5_goal'],inp['tm3_goal'],base['models']['tm_chemistry_mM'],m['backbone'])
                s=c['sequence'];l5=c['length5'];l3=c['length3'];a,b=m['ranges']['primer'];ga,gb=m['ranges']['guide_sites'][0]
                lig=fold_probe(s,l5,l3,t,ligation_salt);rca=fold_probe(s,l5,l3,readout,salt);product=fold_probe(RC(s),l3,l5,readout,salt)
                primer_open=sum(rca['unpaired'][l5+a:l5+b])/(b-a)
                guide_open=sum(product['unpaired'][len(s)-l5-gb:len(s)-l5-ga])/(gb-ga)
                arm_open=(lig['mean_unpaired5']+lig['mean_unpaired3'])/2
                junction_open=sum(lig['unpaired'][:3]+lig['unpaired'][-3:])/6
                recognition=(2-arm_open-junction_open)/2
                readout_penalty=(2-primer_open-guide_open)/2
                metrics={'primer_Tm_C':pr['tm_C'],'primer_hairpin_mfe':pr['hairpin_mfe'],'primer_homodimer_deltaG':pr['dimer_deltaG'],'crrna_model':gr['rna']['model'],'crrna_mfe':gr['rna']['mfe'],'crrna_structure':gr['rna']['structure'],'crrna_spacer_open':gr['rna']['spacer_open'],'primer_site_open':primer_open,'activator_site_open':guide_open,'arm_open_mean':arm_open,'junction_open':junction_open,'readout_temperature_C':readout}
                quality=.1*pr['quality']+.2*gr['quality']
                balanced=recognition+readout_penalty+quality+arm['tm_deviation']/40
                c.update(interactions=interactions,boundary_extension=boundary,target5=arm['target5'],target3=arm['target3'],modules=m,joint_metrics=metrics,structural_screen={'rca_paired':1-primer_open,'cas_paired':1-guide_open,'temperature_C':readout},recommendation_scores={'balanced':balanced,'recognition':recognition+quality,'readout':readout_penalty+quality},recommendation_note='单区联合计算筛选；新 primer 与 crRNA 必须配套使用，两侧Spacer在所给WT/Mut侧翼无连续延伸配对；尚未实验验证。',is_current_modules=False)
                rows.append(c)
    if len(rows)<3:raise ValueError('联合设计未获得三套通过边界与完整寡核苷酸交叉检查的候选；未自动降低筛选要求。')
    chosen=[]
    for metric,label in [('balanced','联合综合推荐'),('recognition','联合识别优先'),('readout','联合读出优先')]:
        # Require genuinely different paired modules, not three labels on one set.
        used={(v['modules']['settings']['primer'],v['modules']['settings']['guide']) for v in chosen}
        remaining=[v for v in rows if (v['modules']['settings']['primer'],v['modules']['settings']['guide']) not in used]
        if not remaining:break
        c=min(remaining,key=lambda v:(v['recommendation_scores'][metric],v['sequence']));c['recommendation_label']=label;c['id']=f'J-{len(chosen)+1:02d}';c['is_reference_sequence']=False
        c['fold']=fold_probe(c['sequence'],c['length5'],c['length3'],t,ligation_salt,True);chosen.append(c)
    base.update(candidates=chosen,backbone=chosen[0]['modules']['backbone'],modules=chosen[0]['modules'],joint_design={'rules':RULES,'seed':seed,'evaluated':len(rows),'readout_temperature_C':readout,'readout_monovalent_mM':salt,'reference_retained':True,'primer_tm_note':'500nM primer, monovalent salt only; distinct from recognition-arm Tm model.'},ranking='Bounded single-zone joint heuristic: recognition-arm Tm/accessibility, primer binding-site and synthetic RCA activator accessibility, primer hairpin/dimer and full crRNA spacer folding; not enzyme activity.')
    base['counts'].update(joint_evaluated=len(rows),interaction_rejected=interaction_rejected,selected=len(chosen))
    base['models']['crrna_fold']='ViennaRNA RNA Turner2004; no RNP modeled'
    base['limitations']+=['Joint sequence pool is bounded and deterministic, not exhaustive or experimentally calibrated.','Synthetic ssDNA activator design, not genomic gRNA targeting; only exact16nt local-target matches screened, not genome-wide specificity.','Intrinsic primer Tm uses500nM and monovalent salt only; actual RCA primer conditions require verification.']
    return base
