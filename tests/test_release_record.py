import copy
import pytest
from analysis.design_candidates import generate
from analysis.module_design import DEFAULTS
from tests.test_design import WT,MUT

def test_counts_describe_real_stages_not_final_rank_count():
    r=generate({'wt':WT,'mut':MUT})
    assert r['counts']['arms_enumerated']==90
    assert r['counts']['thermal_pass']==59
    assert r['counts']['boundary_pass']==33
    assert r['counts']['selected']==3

def test_complete_replay_request_and_source_fingerprint():
    args={'wt':WT,'mut':MUT,'modules':{'linker_b':'ACGT'},'joint_design':True}
    r=generate(args)
    assert r['schema_version']==2
    assert r['request']['modules']['linker_b']=='ACGT'
    assert r['request']['modules']['primer']==DEFAULTS['primer']
    assert len(r['software']['source_sha256'])==64
    assert r['selection']=={'candidate_id':None,'role':None}
    again=generate(r['request'])
    assert [c['sequence'] for c in again['candidates']]==[c['sequence'] for c in r['candidates']]
    assert r['reference'] not in r['candidates']

def test_replay_detects_tampered_record():
    from analysis.replay import replay
    r=generate({'wt':WT,'mut':MUT})
    replayed=replay(r)
    assert replayed['replay']['candidate_sequences_match']
    changed=copy.deepcopy(r);changed['candidates'][0]['sequence']='AAAA'
    with pytest.raises(ValueError,match='match'):replay(changed)

def test_readout_salt_is_separate_from_ligation_salt_and_replayable():
    r=generate({'wt':WT,'mut':MUT,'joint_design':True,'k_mm':151,'readout_monovalent_mm':100,'readout_temperature_c':42})
    assert r['models']['fold_monovalent_mM']==151
    assert r['joint_design']['readout_monovalent_mM']==100
    assert r['request']['readout_monovalent_mm']==100
