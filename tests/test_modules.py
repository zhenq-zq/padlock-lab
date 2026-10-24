import pytest
from analysis.design_candidates import BACKBONE,REFERENCE,generate
from analysis.module_design import assemble,recommend,DEFAULTS,RC
from tests.test_design import WT,MUT

def test_defaults_reconstruct_original_backbone_and_directions():
    m=assemble({})
    assert m['backbone']==BACKBONE
    p=m['ranges']['primer'];g=m['ranges']['guide']
    assert m['backbone'][p[0]:p[1]]==RC(m['settings']['primer'])
    assert m['backbone'][g[0]:g[1]]==m['settings']['guide'].replace('U','T')
    assert m['crrna']=='UAAUUUCUACUAAGUGUAGAU'+m['settings']['guide']

def test_custom_modules_propagate_without_changing_reference():
    out=generate({'wt':WT,'mut':MUT,'modules':{'linker_b':'ACGT'}})
    assert len(out['backbone'])==56
    for c in out['candidates']:assert c['sequence']==c['arm5']+out['backbone']+c['arm3']
    assert out['reference']['sequence']==REFERENCE

@pytest.mark.parametrize('settings',[{'primer':'N'*19},{'guide':'A'*19},{'linker_a':'X'},{'enzyme':'other'},{'primer':None}])
def test_invalid_module_settings_rejected(settings):
    with pytest.raises(ValueError):assemble(settings)

def test_recommendations_change_only_requested_module_and_keep_current():
    for kind,key in [('rca','primer'),('cas','guide'),('linker','linker_b')]:
        out=recommend({'kind':kind,'arm5':REFERENCE[:18],'arm3':REFERENCE[-11:],'modules':{}})
        assert out['baseline']['settings']==DEFAULTS
        assert out['candidates']
        metric={'rca':'rca_paired','cas':'cas_paired','linker':'worst_paired'}[kind]
        assert [r[metric] for r in out['candidates']]==sorted(r[metric] for r in out['candidates'])
        for c in out['candidates']:
            for k,v in DEFAULTS.items():
                if k!=key:assert c['settings'][k]==v
            assert 0<=c['worst_paired']<=1


def test_three_zones_and_fixed_original_arms():
    mut='TTCATGAAACAAATGAATGATGCACGTCATGGTGGCTGGACAACAAAAAT'
    wt=mut[:25]+'A'+mut[26:]
    settings={'linker_a':'ACCTC','guide':'AUUAUAGUGAGUCGUAUAUU','zone_count':3,'zone_linkers':'CCT,AAC'}
    out=generate({'wt':wt,'mut':mut,'fixed_arms':True,'modules':settings})
    assert len(out['candidates'])==3
    assert all(x['arm5']==REFERENCE[:18] and x['arm3']==REFERENCE[-11:] and len(x['fold']['structure'])==len(x['sequence']) for x in out['candidates'])
    c=out['candidates'][0]
    assert c['arm5']==REFERENCE[:18] and c['arm3']==REFERENCE[-11:]
    assert len(c['sequence'])==134
    m=out['modules'];assert len(m['ranges']['guide_sites'])==3
    for a,b in m['ranges']['guide_sites']:
        assert m['backbone'][a:b]=='ATTATAGTGAGTCGTATATT'
    r=recommend({'kind':'rca','arm5':c['arm5'],'arm3':c['arm3'],'modules':settings})
    assert all(len(x['cas_sites_paired'])==3 for x in r['candidates'])

@pytest.mark.parametrize('settings',[{'zone_count':0},{'zone_count':True},{'zone_count':3,'zone_linkers':'CCT'},{'zone_count':2,'zone_linkers':'N'}])
def test_bad_repeats_rejected(settings):
    with pytest.raises(ValueError):assemble(settings)
