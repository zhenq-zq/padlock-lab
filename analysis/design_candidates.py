"""M1: bounded single-SNV padlock candidates, not experimental validation."""
import math
import re
from datetime import datetime, timezone
from functools import lru_cache

import Bio
import RNA
from Bio.SeqUtils import MeltingTemp as mt
try:
    from .module_design import assemble
except ImportError:
    from module_design import assemble

REFERENCE = 'GTGCATCATTCATTTGTTTCCTCAGATACCCTAACCATCGATGTCAGTACGTGGTAGTCAGTTCCTAGGTGCAGTTCTTTGCCACCATGAC'
BACKBONE = REFERENCE[18:80]
CHEMISTRY = dict(Na=0, K=151, Tris=20.1, Mg=10, dNTPs=0)

def reverse_complement(seq):
    return seq.translate(str.maketrans('ACGT','TGCA'))[::-1]

def clean_sequence(value, name):
    if not isinstance(value, str):
        raise ValueError(f'{name} 必须是 DNA 序列。')
    seq = re.sub(r'\s+', '', value).upper()
    if not 25 <= len(seq) <= 1000 or re.fullmatch('[ACGT]+', seq) is None:
        raise ValueError(f'{name} 请填入 25–1000 nt 的 A/C/G/T 序列，不含 FASTA 标题或其他符号。')
    return seq

def number(data, key, default, minimum, maximum):
    try:
        value = float(data.get(key, default))
    except (ValueError, TypeError, OverflowError):
        raise ValueError(f'{key} 必须为数值。') from None
    if isinstance(data.get(key), bool) or not math.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError(f'{key} 必须在 {minimum}–{maximum} 之间。')
    return value

def arm_tm(seq, probe_nm, chemistry=None):
    # Independent perfect-match duplex, probe excess approximation.
    return mt.Tm_NN(seq, nn_table=mt.DNA_NN4, dnac1=probe_nm, dnac2=0,
                    selfcomp=False, saltcorr=7, **(CHEMISTRY if chemistry is None else chemistry))

@lru_cache(maxsize=128)
def fold_probe(seq, length5, length3, temperature=45, monovalent_mm=151, include_alternatives=False):
    RNA.params_load_DNA_Mathews2004()
    md = RNA.md()
    md.temperature = temperature
    md.salt = monovalent_mm/1000
    md.noGU = 0
    md.dangles = 2
    md.compute_bpp = 1
    fc = RNA.fold_compound(seq, md)
    structure, mfe = fc.mfe()
    fc.exp_params_rescale(mfe)
    fc.pf()
    bpp = fc.bpp()
    unpaired = [1.0] * len(seq)
    for i in range(1, len(seq)+1):
        for j in range(i+1, len(seq)+1):
            unpaired[i-1] -= bpp[i][j]
            unpaired[j-1] -= bpp[i][j]
    coords = RNA.get_xy_coordinates(structure)
    coordinates = [[float(coords.get(i).X),float(coords.get(i).Y)] for i in range(len(seq))]
    stack, pairs = [], []
    for i, symbol in enumerate(structure):
        if symbol == '(':
            stack.append(i)
        elif symbol == ')':
            pairs.append([stack.pop(),i])
    alternatives=[]
    if include_alternatives:
        seen={structure}
        for sol in sorted(fc.subopt_zuker(),key=lambda x:x.energy):
            st=sol.structure
            if not st or st in seen:continue
            seen.add(st)
            stack2=[];pairs2=[]
            for index,symbol in enumerate(st):
                if symbol=='(':stack2.append(index)
                elif symbol==')':pairs2.append([stack2.pop(),index])
            xy=RNA.get_xy_coordinates(st)
            alternatives.append({'structure':st,'mfe':float(sol.energy),'pairs':pairs2,
                'coordinates':[[float(xy.get(i).X),float(xy.get(i).Y)] for i in range(len(seq))]})
            if len(alternatives)==7:break
    return {'alternatives':alternatives,'alternative_method':'Zuker constrained-pair suboptimal structures; not exhaustive and not population-ranked','structure': structure, 'mfe': float(mfe), 'coordinates':coordinates, 'pairs':pairs, 'unpaired':[max(0,min(1,v)) for v in unpaired],
            'mean_unpaired5': max(0,min(1,sum(unpaired[:length5])/length5)),
            'mean_unpaired3': max(0,min(1,sum(unpaired[-length3:])/length3))}

def describe(arm5, arm3, probe_nm, goal5, goal3, chemistry=None, backbone=BACKBONE):
    tm5, tm3 = arm_tm(arm5,probe_nm,chemistry), arm_tm(arm3,probe_nm,chemistry)
    return {'arm5':arm5,'arm3':arm3,'length5':len(arm5),'length3':len(arm3),
            'sequence':arm5+backbone+arm3,'tm5':tm5,'tm3':tm3,
            'gc5':100*sum(b in 'GC' for b in arm5)/len(arm5),
            'gc3':100*sum(b in 'GC' for b in arm3)/len(arm3),
            'tm_deviation':abs(tm5-goal5)+abs(tm3-goal3),
            'within_5c':abs(tm5-goal5)<=5 and abs(tm3-goal3)<=5}

try:
    from .boundary_extension import screen as boundary_screen,passes as boundary_passes
except ImportError:
    from boundary_extension import screen as boundary_screen,passes as boundary_passes

try:
    from .interaction_screen import interaction_report
except ImportError:
    from interaction_screen import interaction_report

def _generate_core(data, *, _joint_seed=False):
    if not isinstance(data, dict):
        raise ValueError('请求必须是 JSON 对象。')
    joint=data.get('joint_design',False)
    if not isinstance(joint,bool):raise ValueError('joint_design 必须为布尔值。')
    if joint:
        try:from .joint_design import generate_joint
        except ImportError:from joint_design import generate_joint
        return generate_joint(data,generate({**data,'joint_design':False},_joint_seed=True))
    wt, mut = clean_sequence(data.get('wt'),'WT'), clean_sequence(data.get('mut'),'Mut')
    if len(wt) != len(mut):
        raise ValueError('WT 和 Mut 长度必须相同；第一版仅支持单碱基替换。')
    variants = [i for i,(a,b) in enumerate(zip(wt,mut)) if a != b]
    if len(variants) != 1:
        raise ValueError(f'检测到 {len(variants)} 个差异；请提供仅含一个 SNV 的同方向序列。')
    k = variants[0]
    if k < 16 or len(mut)-k < 9:
        raise ValueError('位点上游至少需要 16 nt，下游至少需要 8 nt；建议两侧各约 30 nt。')
    probe_nm = number(data,'probe_nm',100,1,10000)
    goal5 = number(data,'tm5_goal',55,20,90)
    goal3 = number(data,'tm3_goal',45,20,90)
    if goal5 <= goal3:
        raise ValueError('本设计模式要求 5′ 臂目标 Tm 高于 3′ 臂。')
    chemistry = {ion:number(data,key,CHEMISTRY[ion],0,upper) for ion,key,upper in [
        ('Mg','mg_mm',100),('K','k_mm',1000),('Na','na_mm',1000),('Tris','tris_mm',500),('dNTPs','dntp_mm',100)]}
    if chemistry['Na']+chemistry['K']+chemistry['Tris']/2 <= 0:
        raise ValueError('当前盐修正要求 Na、K 或 Tris 至少一项大于 0；不支持纯镁/无盐条件。')
    temperature = number(data,'temperature_c',45,10,80)
    fold_salt=chemistry['Na']+chemistry['K']
    if fold_salt<=0:raise ValueError('二级结构计算要求 Na⁺ + K⁺ 大于 0。当前模型不使用 Mg 或 Tris 替代单价盐。')
    modules = assemble(data.get('modules',{}))
    backbone = modules['backbone']
    candidates = []
    count = 0
    counts={'arms_enumerated':0,'thermal_pass':0,'boundary_pass':0,'interaction_pass':0,'structure_evaluated':0,'selected':0}
    fixed_arms=data.get('fixed_arms',False)
    if not isinstance(fixed_arms,bool):raise ValueError('fixed_arms 必须为布尔值。')
    if fixed_arms and (k<18 or len(mut)-k<11 or reverse_complement(mut[k-18:k])!=REFERENCE[:18] or reverse_complement(mut[k:k+11])!=REFERENCE[80:]):
        raise ValueError('当前目标与原 6_padlock 的 18/11 nt 识别臂不匹配。请选择原目标或解除固定。')
    for l5 in ([18] if fixed_arms else range(16,min(26,k)+1)):
        for l3 in ([11] if fixed_arms else range(9,min(17,len(mut)-k)+1)):
            count += 1
            counts['arms_enumerated']+=1
            row = describe(reverse_complement(mut[k-l5:k]),reverse_complement(mut[k:k+l3]),probe_nm,goal5,goal3,chemistry,backbone)
            if row['tm5']>row['tm3']:counts['thermal_pass']+=1
            if not fixed_arms and row['tm5'] <= row['tm3']:
                continue
            row['target5'] = [k-l5+1,k]
            row['target3'] = [k+1,k+l3]
            row['boundary_extension']=boundary_screen(row,wt,mut,modules['settings'])
            if boundary_passes(row['boundary_extension']):counts['boundary_pass']+=1
            if not _joint_seed and not boundary_passes(row['boundary_extension']):continue
            row['interactions']=interaction_report(row['arm5'],row['arm3'],modules,wt,mut)
            if row['interactions']['passes']:counts['interaction_pass']+=1
            if not _joint_seed and not row['interactions']['passes']:continue
            candidates.append(row)
    candidates.sort(key=lambda c:(c['tm_deviation'],c['length5']+c['length3'],c['length5']))
    if fixed_arms and candidates:
        try:
            from .module_design import recommend
        except ImportError:
            from module_design import recommend
        seed=candidates[0]
        screen=recommend({'kind':'linker','arm5':seed['arm5'],'arm3':seed['arm3'],'modules':modules['settings'],'temperature_c':temperature,'monovalent_mm':fold_salt,'_all_candidates':True})
        candidates=[]
        for v in screen['candidates']:
            module=assemble(v['settings'])
            row=describe(seed['arm5'],seed['arm3'],probe_nm,goal5,goal3,chemistry,module['backbone'])
            sequence=row['sequence']; pa,pb=module['ranges']['primer']; pa+=18;pb+=18
            metrics=[]
            for t in sorted(set([max(10,temperature-5),temperature,min(80,temperature+5)])):
                f=fold_probe(sequence,18,11,t,fold_salt)
                product=fold_probe(reverse_complement(sequence),11,18,t,fold_salt)
                arm=(1-f['mean_unpaired5']+1-f['mean_unpaired3'])/2
                # Include the ligation-adjacent ends separately, avoiding hidden junctions.
                junction=1-sum(f['unpaired'][:3]+f['unpaired'][-3:])/6
                primer=1-sum(f['unpaired'][pa:pb])/(pb-pa)
                sites=[1-sum(product['unpaired'][len(sequence)-18-end:len(sequence)-18-start])/(end-start) for start,end in module['ranges']['guide_sites']]
                metrics.append((arm,junction,primer,max(sites)))
            worst=[max(m[j] for m in metrics) for j in range(4)]
            recognition=(worst[0]+worst[1])/2
            readout=(worst[2]+worst[3])/2
            row.update(target5=seed['target5'],target3=seed['target3'],modules=module,
                       structural_screen={'rca_paired':v['rca_paired'],'cas_paired':v['cas_paired'],'temperature_C':temperature},
                       recommendation_scores={'recognition':recognition,'readout':readout,'balanced':(recognition+readout)/2,'temperature_range_C':[max(10,temperature-5),min(80,temperature+5)]},
                       is_current_modules=v['settings']==modules['settings'])
            row['boundary_extension']=boundary_screen(row,wt,mut,module['settings'])
            if not _joint_seed and not boundary_passes(row['boundary_extension']):continue
            row['interactions']=interaction_report(row['arm5'],row['arm3'],module,wt,mut)
            if not _joint_seed and not row['interactions']['passes']:continue
            candidates.append(row)
        chosen=[]
        for metric,label in [('balanced','综合推荐'),('recognition','识别优先'),('readout','读出优先')]:
            remaining=[c for c in candidates if c not in chosen]
            if not remaining:break
            best=min(remaining,key=lambda c:(c['recommendation_scores'][metric],c['recommendation_scores']['balanced'],c['modules']['settings']['linker_b']))
            best['recommendation_label']=label
            chosen.append(best)
        candidates=chosen
        counts['structure_evaluated']=screen['screened']
        count=screen['screened']
    if not fixed_arms:
        # Soft design references, relative to ligation temperature; no mismatch/ligation model.
        delta_ref=goal5-goal3
        left_ref=temperature+delta_ref
        right_ref=temperature
        def thermal_score(c,right):
            return abs(c['tm5']-left_ref)+1.5*abs(c['tm3']-right)+0.5*abs((c['tm5']-c['tm3'])-delta_ref)+3*max(0,temperature-c['tm5'])
        pool=sorted(candidates,key=lambda c:thermal_score(c,right_ref))[:24]
        counts['structure_evaluated']=len(pool)
        for c in pool:
            f=fold_probe(c['sequence'],c['length5'],c['length3'],temperature,fold_salt)
            c['fold']=f
            junction=1-sum(f['unpaired'][:3]+f['unpaired'][-3:])/6
            arm=1-(f['mean_unpaired5']+f['mean_unpaired3'])/2
            pa,pb=modules['ranges']['primer'];pa+=c['length5'];pb+=c['length5']
            primer=1-sum(f['unpaired'][pa:pb])/(pb-pa)
            product=fold_probe(reverse_complement(c['sequence']),c['length3'],c['length5'],temperature,fold_salt)
            sites=[1-sum(product['unpaired'][len(c['sequence'])-c['length5']-end:len(c['sequence'])-c['length5']-start])/(end-start) for start,end in modules['ranges']['guide_sites']]
            c['structure_penalty']=5*(arm+junction+primer+max(sites))/4
            c['tm_gap']=c['tm5']-c['tm3']
        chosen=[]
        for label,offset in [('折中推荐',0),('抓取偏稳',2),('判别偏严',-2)]:
            remaining=[c for c in pool if c not in chosen]
            if not remaining:break
            def score(c):
                left=left_ref+(2 if label=='抓取偏稳' else 0)
                return thermal_score(c,right_ref+offset if label=='判别偏严' else right_ref)+abs(c['tm5']-left)-abs(c['tm5']-left_ref)+c['structure_penalty']
            best=min(remaining,key=score)
            best['recommendation_label']=label
            best['selection_score']=score(best)
            best['recommendation_note']='按45°C连接参考、两臂Tm及结构遮挡初筛；未计算WT错配Tm或连接酶选择性。' if temperature==45 else '按连接温度、两臂Tm及结构遮挡初筛；未计算WT错配Tm或连接酶选择性。'
            chosen.append(best)
        candidates=chosen
    retained = len(candidates)
    selected = candidates[:3]
    counts['selected']=len(selected)
    counts['thermal_filter_applied']=not fixed_arms
    for i,row in enumerate(selected,1):
        row['id'] = f'M1-{i:02d}'
        row['is_reference_sequence'] = row['sequence'] == REFERENCE
        row['fold'] = fold_probe(row['sequence'],row['length5'],row['length3'],temperature,fold_salt,True)
    ref = describe(REFERENCE[:18],REFERENCE[80:],probe_nm,goal5,goal3,chemistry)
    ref.update(id='6_Padlock_Tm55/45',fold=fold_probe(REFERENCE,18,11,temperature,fold_salt,True),
               matches_input=(k>=18 and len(mut)-k>=11 and
                   reverse_complement(mut[k-18:k])==REFERENCE[:18] and
                   reverse_complement(mut[k:k+11])==REFERENCE[80:]))
    original_modules = assemble({})
    ref.update(modules=original_modules,is_reference_sequence=True,is_experimental_reference=True,
               recommendation_label='原实验设计',recommendation_note='原91nt实验参考，非新方案的计算验证。',
               target5=[k-18+1,k],target3=[k+1,k+11])
    return {'schema_version':1,'created_utc':datetime.now(timezone.utc).isoformat(),
            'status':'computed_candidates_not_validated',
            'input':{'fixed_arms':fixed_arms,'wt':wt,'mut':mut,'probe_nm':probe_nm,'tm5_goal':goal5,'tm3_goal':goal3,'temperature_c':temperature,
                     'mg_mm':chemistry['Mg'],'k_mm':chemistry['K'],'na_mm':chemistry['Na'],'tris_mm':chemistry['Tris'],'dntp_mm':chemistry['dNTPs']},
            'variant':{'position':k+1,'wt':wt[k],'mut':mut[k]},
            'backbone':backbone,'modules':modules,'modification':'5′ phosphorylation; PAGE',
            'boundary_rule':'Zero contiguous Spacer1/3 extension on supplied WT and Mut flanks; experimental reference exempt.',
            'counts':counts,'enumerated':count,'retained':retained,'candidates':selected,'reference':ref,
            'models':{'tm':f'Biopython {Bio.__version__}; DNA_NN4; saltcorr=7 (Owczarzy 2008)',
                      'tm_chemistry_mM':chemistry,'tm_dnac1_nM':probe_nm,'tm_dnac2_nM':0,
                      'fold':f'ViennaRNA {RNA.__version__}; DNA Mathews2004',
                      'fold_temperature_C':temperature,'fold_monovalent_mM':fold_salt,'fold_magnesium_modeled':False,'fold_noGU':False,'fold_material':'DNA Mathews2004','fold_engine':'ViennaRNA'},
            'ranking':'Fixed arms: three distinct linker candidates selected by balanced, recognition and readout ensemble accessibility across temperature ±5C. Tm goals are reference annotations. Unlocked arms: shortlist by ligation-relative arm Tm and soft Tm-gap reference, then ensemble arm/junction/primer accessibility; distinct balanced, stronger-anchor and weaker-discrimination-arm trial candidates. No mismatch model.',
            'limitations':['Nominal Mg, not measured free Mg; NAD/EDTA effects not modeled.',
               'Independent-arm Tm, low target approximation; no tethering, target competition or cooling kinetics.',
               'Fold omits Mg; mean unpaired is not simultaneous whole-arm opening.',
               'Editable backbone segments not functionally validated; no genome specificity, mismatch Tm or ligation prediction.',
               'Heuristic ranking; not experimentally validated.']}


def generate(data, *, _joint_seed=False):
    result=_generate_core(data,_joint_seed=_joint_seed)
    if _joint_seed:return result
    try:
        from .provenance import software_record,stable_hash
    except ImportError:
        from provenance import software_record,stable_hash
    request={**result['input'],'modules':assemble(data.get('modules',{}))['settings'],
             'joint_design':data.get('joint_design',False),
             'readout_temperature_c':number(data,'readout_temperature_c',37,10,80)}
    request['readout_monovalent_mm']=number(data,'readout_monovalent_mm',result['input']['k_mm']+result['input']['na_mm'],0.001,2000)
    result.update(schema_version=2,request=request,request_sha256=stable_hash(request),
                  software=software_record(),selection={'candidate_id':None,'role':None})
    for row in result['candidates']:row['role']='computed'
    result['reference']['role']='experimental_reference'
    result['models'].update(fold_dangles=2,fold_compute_bpp=True,coordinate_system='1-based inclusive on supplied target; module ranges0-based half-open')
    return result
