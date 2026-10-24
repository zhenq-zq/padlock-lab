import json
from pathlib import Path
import pytest
from Bio.Seq import Seq
from analysis.design_candidates import generate, reverse_complement

ROWS = json.loads((Path(__file__).resolve().parents[1] / 'analysis/m1/catalog/variants.json').read_text())

def test_catalog_identity():
    assert len(ROWS) == len({row['id'] for row in ROWS}) == 10
    assert {row['gene'] for row in ROWS} == {'PIK3CA','KRAS','BRAF','EGFR'}

@pytest.mark.parametrize('row', ROWS, ids=lambda row: row['id'])
def test_catalog_translation_and_real_candidate_generation(row):
    wt = row['wt']
    assert len(wt) == 61 and row['position'] == 31 and wt[30] == row['ref']
    mut = wt[:30] + row['alt'] + wt[31:]
    c = int(row['hgvs'].split(':c.')[1][:-3])
    start = 30 - (c-1)%3
    assert str(Seq(wt[start:start+3]).translate()) == row['protein'][0]
    assert str(Seq(mut[start:start+3]).translate()) == row['protein'][-1]
    result = generate({'wt':wt,'mut':mut})
    assert len(result['candidates']) == 3
    assert len({c['sequence'] for c in result['candidates']})==3
    for probe in result['candidates']:
        assert probe['arm5'] == reverse_complement(mut[30-probe['length5']:30])
        assert probe['arm3'] == reverse_complement(mut[30:30+probe['length3']])
        assert probe['tm5']>probe['tm3']
        assert all(v==0 for side in probe['boundary_extension'].values() for v in side.values())
