import pytest
from analysis.design_candidates import generate
from tests.test_design import WT, MUT

def test_conditions_are_applied_without_mutating_defaults():
    base=generate({'wt':WT,'mut':MUT})
    changed=generate({'wt':WT,'mut':MUT,'mg_mm':5,'temperature_c':50})
    assert changed['models']['tm_chemistry_mM']['Mg']==5
    assert changed['reference']['tm5'] != base['reference']['tm5']
    assert changed['models']['fold_temperature_C']==50
    assert changed['models']['fold_magnesium_modeled'] is False
    assert generate({'wt':WT,'mut':MUT})['models']['tm_chemistry_mM']['Mg']==10

@pytest.mark.parametrize('patch',[{'mg_mm':-1},{'k_mm':float('nan')},{'temperature_c':1000},{'na_mm':0,'k_mm':0,'tris_mm':0,'mg_mm':0}])
def test_invalid_conditions_rejected(patch):
    with pytest.raises(ValueError):generate({'wt':WT,'mut':MUT,**patch})
