"""Integration checks against a running local service (opt-in URL)."""
import json
import os
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import pytest

URL = os.environ.get('PADLOCK_TEST_URL')
pytestmark = pytest.mark.skipif(not URL, reason='Set PADLOCK_TEST_URL to the running local service.')
WT = 'TTCATGAAACAAATGAATGATGCACATCATGGTGGCTGGACAACAAAAAT'
MUT = 'TTCATGAAACAAATGAATGATGCACGTCATGGTGGCTGGACAACAAAAAT'

def request(path, data=None, **headers):
    req = Request(URL+path, data=None if data is None else json.dumps(data).encode(),
                  headers={'Content-Type':'application/json',**headers})
    try:
        with urlopen(req,timeout=10) as response:
            return response.status,response.read()
    except HTTPError as error:
        return error.code,error.read()

def test_health_and_static_page():
    code,body=request('/api/health')
    assert code==200 and json.loads(body)['service']=='padlock-m1'
    code,body=request('/design.html')
    assert code==200 and b'id="design-form"' in body
    assert request('/../PROJECT_MEMORY.md')[0]==404

def test_live_generation_and_bad_request():
    code,body=request('/api/design',{'wt':WT,'mut':MUT},Origin=URL)
    assert code==200
    result=json.loads(body)
    assert len(result['candidates'])==3
    assert result['candidates'][0]['sequence'].endswith('CCACCATGAC')
    assert request('/api/design',{'wt':WT,'mut':WT},Origin=URL)[0]==400
    assert request('/api/design',{'wt':WT,'mut':MUT},Origin='https://example.org')[0]==403
    assert request('/api/design',{'wt':WT,'mut':MUT},Host='evil.example')[0]==403

def test_large_and_nonobject_payload():
    assert request('/api/design',{'wt':'A'*20000})[0]==400
    assert request('/api/design',[])[0]==400
    assert request('/api/design',{},**{'Content-Type':'text/plain'})[0]==415

def test_modules_endpoint_and_custom_generation():
    code,body=request('/api/design',{'wt':WT,'mut':MUT,'modules':{'linker_b':'ACGT'}},Origin=URL)
    assert code==200
    data=json.loads(body)
    assert len(data['backbone'])==56
    assert data['backbone'].startswith('TCCTC')
    c=data['candidates'][0]
    payload={'kind':'linker','arm5':c['arm5'],'arm3':c['arm3'],'modules':data['modules']['settings']}
    code,body=request('/api/modules',payload,Origin=URL)
    assert code==200 and json.loads(body)['candidates']
    assert request('/api/modules',payload,Origin='https://example.org')[0]==403
    assert request('/api/modules',{'kind':'unknown'},Origin=URL)[0]==400
