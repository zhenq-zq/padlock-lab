import json
import math
import pytest
from analysis.design_candidates import generate, reverse_complement, REFERENCE, BACKBONE, arm_tm

WT = 'TTCATGAAACAAATGAATGATGCACATCATGGTGGCTGGACAACAAAAAT'
MUT = 'TTCATGAAACAAATGAATGATGCACGTCATGGTGGCTGGACAACAAAAAT'

def test_reference_mapping_and_candidate_junction():
    result = generate({'wt': WT, 'mut': MUT})
    assert result['variant'] == {'position': 26, 'wt': 'A', 'mut': 'G'}
    assert result['reference']['sequence'] == REFERENCE
    assert result['reference']['matches_input'] is True
    assert len(BACKBONE) == 62
    assert REFERENCE == reverse_complement(MUT[7:25]) + BACKBONE + reverse_complement(MUT[25:36])
    assert len(result['candidates']) == 3
    assert [c['recommendation_label'] for c in result['candidates']] == ['折中推荐','抓取偏稳','判别偏严']
    assert len({c['sequence'] for c in result['candidates']})==3
    assert all(math.isfinite(c['selection_score']) for c in result['candidates'])
    for c in result['candidates']:
        l5, l3 = c['length5'], c['length3']
        assert c['arm5'] == reverse_complement(MUT[25-l5:25])
        assert c['arm3'] == reverse_complement(MUT[25:25+l3])
        assert c['sequence'] == c['arm5'] + BACKBONE + c['arm3']
        assert c['sequence'][-1] == 'C'
        assert c['tm5'] > c['tm3']
        fold = c['fold']
        assert len(fold['structure']) == len(c['sequence'])
        assert 0 <= fold['mean_unpaired5'] <= 1
        assert 0 <= fold['mean_unpaired3'] <= 1
        assert math.isfinite(fold['mfe'])
    json.dumps(result, allow_nan=False)

@pytest.mark.parametrize('patch', [
    {'mut': WT}, {'mut': MUT[:-1]}, {'mut': MUT.replace('G','N',1)},
    {'mut': 'A'+MUT[1:]}, {'wt': '>header\n'+WT}, {'wt': None},
    {'probe_nm': 0}, {'probe_nm': float('nan')}, {'probe_nm': 10**1000}, {'tm5_goal': 30, 'tm3_goal': 45},
    {'wt': 'A'*1001, 'mut':'G'+'A'*1000},
    {'wt':'A'*50, 'mut':'G'+'A'*49},
])
def test_reject_invalid_input(patch):
    with pytest.raises(ValueError):
        generate({'wt': WT, 'mut': MUT, **patch})

def test_new_locus_changes_sequence_and_marks_reference():
    wt = WT[:10]+'C'+WT[11:]
    mut = MUT[:10]+'C'+MUT[11:]
    result = generate({'wt':wt.lower()+'\n', 'mut':mut})
    assert result['reference']['matches_input'] is False
    for c in result['candidates']:
        assert reverse_complement(c['arm5']) == mut[25-c['length5']:25]
    assert result['input']['wt'] == wt

def test_tm_responds_to_concentration_and_magnesium():
    sequence = 'GCCACCATGAC'
    assert arm_tm(sequence,100) > arm_tm(sequence,10)
    from Bio.SeqUtils import MeltingTemp as mt
    assert arm_tm(sequence,100) > mt.Tm_NN(sequence, nn_table=mt.DNA_NN4,
        dnac1=100,dnac2=0,Na=0,K=151,Tris=20.1,Mg=0,dNTPs=0,saltcorr=7)

def test_palindromic_arm_is_duplex_with_distinct_target():
    # Probe and target are distinct molecular species; selfcomp remains False.
    from Bio.SeqUtils import MeltingTemp as mt
    seq = 'GCGCATATGCGC'
    expected=mt.Tm_NN(seq,nn_table=mt.DNA_NN4,dnac1=100,dnac2=0,
                      Na=0,K=151,Tris=20.1,Mg=10,dNTPs=0,saltcorr=7,selfcomp=False)
    assert arm_tm(seq,100) == pytest.approx(expected)

def test_no_candidates_is_explicit_empty_result():
    wt='A'*26+'GC'*12
    mut=wt[:25]+'G'+wt[26:]
    result=generate({'wt':wt,'mut':mut})
    assert result['enumerated'] > 0
    assert result['retained']==0 and result['candidates']==[]

def test_minimum_flanks_and_poor_tm_are_not_validation():
    wt='A'*25
    mut=wt[:16]+'G'+wt[17:]
    result=generate({'wt':wt,'mut':mut})
    assert result['enumerated']==1
    for c in result['candidates']:
        assert c['target5']==[1,16] and c['target3']==[17,25]
        assert c['within_5c'] is False
    assert result['status']=='computed_candidates_not_validated'


def test_auto_arms_provide_distinct_temperature_based_trials():
    out=generate({'wt':WT,'mut':MUT,'temperature_c':45})
    assert out['input']['fixed_arms'] is False
    rows=out['candidates']
    assert [r['recommendation_label'] for r in rows]==['折中推荐','抓取偏稳','判别偏严']
    assert len({(r['length5'],r['length3']) for r in rows})==3
    assert all('未计算WT错配Tm' in r['recommendation_note'] for r in rows)
    assert all(math.isfinite(r['selection_score']) for r in rows)
