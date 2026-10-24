import math
from analysis.design_candidates import fold_probe, REFERENCE

def test_fold_coordinates_correspond_to_every_base_and_pair():
    result=fold_probe(REFERENCE,20,11)
    assert len(result['coordinates'])==len(REFERENCE)
    assert all(math.isfinite(v) for p in result['coordinates'] for v in p)
    for i,j in result['pairs']:
        assert i<j and result['structure'][i]=='(' and result['structure'][j]==')'
    assert len(result['pairs'])==result['structure'].count('(')


def test_suboptimal_structures_have_real_coordinates_and_pairing():
    result=fold_probe(REFERENCE,20,11,45,151,True)
    assert result['alternatives']
    for f in result['alternatives']:
        assert len(f['structure'])==len(REFERENCE)==len(f['coordinates'])
        assert f['pairs'] and f['mfe']>=result['mfe']-0.01
