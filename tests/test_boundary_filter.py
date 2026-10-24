import pytest
from analysis.design_candidates import generate
from analysis.module_design import RC
from tests.test_design import WT,MUT

def extensions(c,target,settings):
    left=c['target5'][0]-2;right=c['target3'][1];a=b=0
    for base in settings['linker_a']:
        if left-a<0 or RC(base)!=target[left-a]:break
        a+=1
    for base in settings['linker_c'][::-1]:
        if right+b>=len(target) or RC(base)!=target[right+b]:break
        b+=1
    return a,b

@pytest.mark.parametrize('joint',[False,True])
def test_all_automatic_candidates_have_no_adjacent_spacer_extension(joint):
    result=generate({'wt':WT,'mut':MUT,'joint_design':joint})
    assert result['candidates']
    for c in result['candidates']:
        settings=c.get('modules',result['modules'])['settings']
        for target in [WT,MUT]:assert extensions(c,target,settings)==(0,0)
    assert result['reference']['sequence'].startswith('GTGCATCATTCATTTGTTTCCTC')
    assert extensions(result['reference'],MUT,result['reference']['modules']['settings'])==(2,0)

def test_fixed_original_arms_do_not_return_extension_as_automatic_recommendation():
    result=generate({'wt':WT,'mut':MUT,'fixed_arms':True})
    assert result['candidates']==[]
    assert result['reference']['matches_input']

def test_both_boundary_directions_and_minimal_repair():
    from analysis.boundary_extension import extensions,separate_boundaries
    c={'target5':[3,5],'target3':[6,8]}
    settings={'linker_a':'TTAC','linker_c':'GGGA','primer':'ACGT','guide':'ACGU'}
    target='AACGTACGTA'
    assert extensions(c,target,settings)=={'left_nt':2,'right_nt':1}
    new=separate_boundaries(settings,c,target,target)
    assert new['linker_a'][1:]==settings['linker_a'][1:]
    assert new['linker_c'][:-1]==settings['linker_c'][:-1]
    assert new['primer']==settings['primer'] and new['guide']==settings['guide']
    assert extensions(c,target,new)=={'left_nt':0,'right_nt':0}
    assert settings['linker_a']=='TTAC'  # input settings not mutated

def test_empty_linkers_and_target_edges_do_not_invent_flank_matches():
    from analysis.boundary_extension import extensions
    assert extensions({'target5':[1,2],'target3':[3,4]},'ACGT',{'linker_a':'T','linker_c':'A'})=={'left_nt':0,'right_nt':0}
    assert extensions({'target5':[2,2],'target3':[3,3]},'ACGT',{'linker_a':'','linker_c':''})=={'left_nt':0,'right_nt':0}
