"""Exact contiguous Spacer1/3 extension at intended arm boundaries, on supplied flanks."""
COMP=dict(zip('ACGT','TGCA'))

def extensions(candidate,target,settings):
    left=candidate['target5'][0]-2
    right=candidate['target3'][1]
    a=b=0
    for base in settings['linker_a']:
        if left-a<0 or COMP[base]!=target[left-a]:break
        a+=1
    for base in reversed(settings['linker_c']):
        if right+b>=len(target) or COMP[base]!=target[right+b]:break
        b+=1
    return {'left_nt':a,'right_nt':b}

def screen(candidate,wt,mut,settings):
    return {kind:extensions(candidate,target,settings) for kind,target in [('wt',wt),('mut',mut)]}

def passes(metrics):
    return all(value==0 for side in metrics.values() for value in side.values())

def separate_boundaries(settings,candidate,wt,mut):
    """Change only the boundary-facing nucleotide, preserving linker lengths and all modules."""
    result=dict(settings)
    for key,index,pos in [('linker_a',0,candidate['target5'][0]-2),('linker_c',-1,candidate['target3'][1])]:
        seq=result[key]
        if not seq:continue
        forbidden={COMP[t[pos]] for t in (wt,mut) if 0<=pos<len(t)}
        if seq[index] in forbidden:
            replacement=next(b for b in 'ACGT' if b not in forbidden)
            result[key]=replacement+seq[1:] if index==0 else seq[:-1]+replacement
    return result
