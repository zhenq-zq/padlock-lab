from pathlib import Path
from analysis.catalog import load_catalog,render_catalog

def test_generated_catalog_matches_all_provenance_sources():
    rows=load_catalog()
    assert len(rows)==10 and len({r['id'] for r in rows})==10
    assert len({r['hgvs'] for r in rows})==len(rows)
    assert len([r for r in rows if r['gene']=='PIK3CA' and r['protein']=='H1047R'])==1
    lab=[r for r in rows if r.get('experiment_reference')]
    assert len(lab)==1 and len(lab[0]['wt'])==50 and lab[0]['position']==26
    assert all(len(r['wt'])==61 and r['position']==31 for r in rows if not r.get('experiment_reference'))
    assert (Path(__file__).resolve().parents[1]/'m0-dashboard/variant-catalog.js').read_text()==render_catalog()
