from analysis.interaction_screen import longest_complement,interaction_report
from analysis.module_design import assemble

def test_known_complement_directions_and_terminal_match():
    assert longest_complement('ACCGTACA','TGTACGGT')['length_nt']==8
    assert longest_complement('AAAAAAAA','CCCCCCCC')['length_nt']==0

def test_intended_primer_and_activator_sites_are_not_false_positives():
    m=assemble({})
    r=interaction_report('GTGCATCATTCATTTGTT','GCCACCATGAC',m,'CCCCCCCCCCCCCCCCCCCC','GGGGGGGGGGGGGGGGGGGG')
    intended=[v for v in r['checks'] if v['id']=='primer_vs_padlock_outside_binding_site'][0]
    assert intended['max_complement_nt']<len(m['settings']['primer'])
    assert r['hard_reject_nt']==8 and r['review_flag_nt']==6
    assert any(v['id']=='crrna_vs_primer' for v in r['checks'])
    assert any(v['id']=='primer_vs_wt_reverse' for v in r['checks'])

def test_designed_sets_are_screened_against_full_crrna_and_both_strands():
    from analysis.design_candidates import generate
    from tests.test_design import WT,MUT
    r=generate({'wt':WT,'mut':MUT,'joint_design':True})
    assert len(r['candidates'])==3
    for c in r['candidates']:
        x=c['interactions'];assert x['passes']
        assert len(x['checks'])>=9
        assert all(not v['reject'] for v in x['checks'])

def test_fixed_module_auto_design_does_not_recommend_clear_handle_complement():
    from analysis.design_candidates import generate
    from analysis.module_design import HANDLE,RC
    from tests.test_design import WT,MUT
    primer=RC(HANDLE.replace('U','T')[:12])
    r=generate({'wt':WT,'mut':MUT,'modules':{'primer':primer}})
    assert not r['candidates']
    assert r['reference']['matches_input']
