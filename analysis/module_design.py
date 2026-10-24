"""Bounded, single-module structural screening; no activity predictions."""
import re
import random

DEFAULTS = dict(primer='ATCGATGGTTAGGGTATCT',guide='GGUAGUCAGUUCCUAGGUGCAGU',linker_a='TCCTC',linker_b='GTCAGTACGT',linker_c='TCTTT',zone_count=1,zone_linkers='')
HANDLE = 'UAAUUUCUACUAAGUGUAGAU'

def RC(seq):
    return seq.translate(str.maketrans('ACGT','TGCA'))[::-1]

def assemble(settings):
    if not isinstance(settings,dict) or set(settings)-set(DEFAULTS)-{'zone_count','zone_linkers'}:
        raise ValueError('模块字段不正确。')
    values={}
    for key,default in DEFAULTS.items():
        if key in ('zone_count','zone_linkers'):continue
        seq=settings.get(key,default)
        if not isinstance(seq,str):raise ValueError(f'{key} 必须为序列。')
        seq=re.sub(r'\s+','',seq).upper()
        if key=='guide':seq=seq.replace('T','U')
        lo,hi=(12,40) if key=='primer' else (20,24) if key=='guide' else (0,40)
        if not lo<=len(seq)<=hi or re.fullmatch('[ACGU]*' if key=='guide' else '[ACGT]*',seq) is None:
            raise ValueError(f'{key} 长度要求 {lo}–{hi} nt，仅允许标准碱基。')
        values[key]=seq
    a=values['linker_a'];p=RC(values['primer']);b=values['linker_b'];g=values['guide'].replace('U','T');c=values['linker_c']
    count=settings.get('zone_count',1)
    if isinstance(count,bool) or not isinstance(count,int) or not 1<=count<=5:
        raise ValueError('CRISPR zone 数量必须为 1–5 的整数。')
    gaps=settings.get('zone_linkers',','.join(['CCT','AAC','CCT','AAC'][:count-1]))
    if not isinstance(gaps,str):raise ValueError('重复区间隔必须为逗号分隔的 DNA 序列。')
    gaps=re.sub(r'\s+','',gaps).upper()
    parts=gaps.split(',') if gaps else []
    if len(parts)!=count-1 or any(not re.fullmatch('[ACGT]{1,40}',v) for v in parts):
        raise ValueError('请为每两个 CRISPR zone 填一个间隔序列，用逗号分隔。')
    values.update(zone_count=count,zone_linkers=gaps)
    block=g;sites=[[len(a+p+b),len(a+p+b)+len(g)]]
    for gap in parts:
        block+=gap;start=len(a+p+b+block);block+=g;sites.append([start,start+len(g)])
    backbone=a+p+b+block+c
    return dict(settings=values,backbone=backbone,crrna=HANDLE+values['guide'],enzyme='NEB EnGen Lba Cas12a (M0653)',activator='RCA ssDNA',ranges={'primer':[len(a),len(a+p)],'guide':[len(a+p+b),len(a+p+b+block)],'guide_sites':sites})

def recommend(data):
    if not isinstance(data,dict):raise ValueError('请求必须为JSON对象。')
    try:
        from .design_candidates import fold_probe
    except ImportError:
        from design_candidates import fold_probe
    from math import isfinite
    temperature=float(data.get('temperature_c',37));salt=float(data.get('monovalent_mm',151))
    if not isfinite(temperature) or not 10<=temperature<=80 or not isfinite(salt) or not 0<salt<=2000:raise ValueError('折叠温度或单价盐条件无效。')
    kind=data.get('kind')
    if kind not in ('rca','cas','linker'):raise ValueError('未知模块。')
    arm5=data.get('arm5');arm3=data.get('arm3')
    if not isinstance(arm5,str) or not isinstance(arm3,str) or not re.fullmatch('[ACGT]{16,26}',arm5) or not re.fullmatch('[ACGT]{9,17}',arm3):
        raise ValueError('请先生成候选，选择一个有效的识别臂组合。')
    baseline=assemble(data.get('modules',{}));values=baseline['settings']
    key={'rca':'primer','cas':'guide','linker':'linker_b'}[kind]
    pool={values[key]}
    if kind=='rca':
        for n in range(16,min(24,len(values[key]))+1):pool.add(values[key][-n:])
    elif kind=='cas':
        for n in range(20,len(values[key])+1):pool.add(values[key][:n])
    else:
        rng=random.Random(20260924)
        for _ in range(24):
            seq=list(values[key]);rng.shuffle(seq);pool.add(''.join(seq))
    def evaluate(settings):
        module=assemble(settings);sequence=arm5+module['backbone']+arm3
        folded=fold_probe(sequence,len(arm5),len(arm3),temperature,salt)
        product=fold_probe(RC(sequence),len(arm3),len(arm5),temperature,salt)
        pa,pb=module['ranges']['primer'];ga,gb=module['ranges']['guide']
        pa+=len(arm5);pb+=len(arm5);ga+=len(arm5);gb+=len(arm5)
        rca=1-sum(folded['unpaired'][pa:pb])/(pb-pa)
        cas_sites=[1-sum(product['unpaired'][len(sequence)-len(arm5)-end:len(sequence)-len(arm5)-start])/(end-start) for start,end in module['ranges']['guide_sites']]
        cas=sum(cas_sites)/len(cas_sites)
        return dict(settings=module['settings'],sequence=sequence,rca_paired=rca,cas_paired=cas,cas_sites_paired=cas_sites,worst_paired=max(rca,cas),mean_paired=(rca+cas)/2,crrna=module['crrna'])
    base=evaluate(values)
    rows=[evaluate({**values,key:seq}) for seq in sorted(pool)]
    primary={'rca':'rca_paired','cas':'cas_paired','linker':'worst_paired'}[kind]
    rows.sort(key=lambda r:(r[primary],r['mean_paired'],r['settings'][key]!=values[key],r['settings'][key]))
    for row in rows:row['is_current']=row['settings']==values
    return dict(kind=kind,baseline=base,candidates=rows if data.get('_all_candidates') else rows[:5],screened=len(rows),arm5=arm5,arm3=arm3,
                model={'temperature_C':temperature,'monovalent_mM':salt,'magnesium_modeled':False},
                rule=f'Sort by lower {primary}, then lower mean of both site paired fractions; structural screen only.',
                limits=['Primer pool: existing 3prime-preserving truncations, 16–24nt. Guide pool: existing 5prime-preserving truncations, 20–24nt. Linker pool: same-composition middle-segment shuffles.',
                        'RCA product is one reverse-complement unit; no multimer, polymerase or RNP simulation.',
                        'No primer Tm, dimer, off-target or enzyme-activity ranking. Not experimental best.'])
