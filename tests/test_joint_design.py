import pytest
from analysis.design_candidates import generate,REFERENCE,fold_probe
from analysis.module_design import DEFAULTS,HANDLE,RC
from analysis.joint_design import rna_spacer_metrics
from tests.test_design import WT,MUT

def test_joint_design_outputs_distinct_paired_single_zone_sets_and_reproducible():
    args={'wt':WT,'mut':MUT,'joint_design':True}
    result=generate(args)
    assert result['joint_design']['evaluated']>3
    assert len(result['candidates'])==3
    for c in result['candidates']:
        m=c['modules'];s=m['settings'];a,b=m['ranges']['primer'];g,h=m['ranges']['guide_sites'][0]
        assert s['zone_count']==1
        assert m['backbone'][a:b]==RC(s['primer'])
        assert m['backbone'][g:h]==s['guide'].replace('U','T')
        assert m['crrna']==HANDLE+s['guide']
        assert s['primer'] not in DEFAULTS['primer'] and s['guide'] not in DEFAULTS['guide']
        assert c['sequence']==c['arm5']+m['backbone']+c['arm3']
        assert 0<=c['joint_metrics']['crrna_spacer_open']<=1
    again=generate(args)
    assert [c['sequence'] for c in result['candidates']]==[c['sequence'] for c in again['candidates']]
    assert result['reference']['sequence']==REFERENCE

def test_rna_model_does_not_change_following_dna_calculation():
    before=fold_probe('ACCGTTTTTTACGGT',5,5,37,151)['mfe']
    metrics=rna_spacer_metrics(DEFAULTS['guide'],37,151)
    fold_probe.cache_clear()
    assert fold_probe('ACCGTTTTTTACGGT',5,5,37,151)['mfe']==before
    assert metrics['model']=='RNA Turner2004'

@pytest.mark.parametrize('value',[1,'yes',None])
def test_joint_mode_requires_boolean(value):
    with pytest.raises(ValueError):generate({'wt':WT,'mut':MUT,'joint_design':value})

def test_joint_design_cannot_silently_create_three_zones():
    with pytest.raises(ValueError):generate({'wt':WT,'mut':MUT,'joint_design':True,'modules':{'zone_count':3,'zone_linkers':'AAA,TTT'}})

def test_original_reference_has_its_own_modules_and_matching_target_coordinates():
    result=generate({'wt':WT,'mut':MUT})
    ref=result['reference']
    assert ref['matches_input']
    assert ref['modules']['settings']==DEFAULTS
    assert ref['target5'][1]==result['variant']['position']-1
    assert ref['target3'][0]==result['variant']['position']
