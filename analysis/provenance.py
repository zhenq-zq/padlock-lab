"""Portable software and request provenance; contains no machine paths or credentials."""
from pathlib import Path
import hashlib
import json
import platform
import subprocess
APP_VERSION='0.2.0-rc.1'
ALGORITHM_VERSION='single-zone-joint-20261023-release1'
ROOT=Path(__file__).resolve().parents[1]
SOURCES=('design_candidates.py','module_design.py','joint_design.py','boundary_extension.py','interaction_screen.py','provenance.py','replay.py')

def stable_hash(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode()).hexdigest()

def software_record():
    sources={name:hashlib.sha256((ROOT/'analysis'/name).read_bytes()).hexdigest() for name in SOURCES if (ROOT/'analysis'/name).exists()}
    commit=None
    if (ROOT/'.git').exists():
        p=subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,capture_output=True,text=True)
        if p.returncode==0:commit=p.stdout.strip()
    return {'name':'Padlock Lab','version':APP_VERSION,'algorithm_version':ALGORITHM_VERSION,'source_sha256':stable_hash(sources),'source_files_sha256':sources,'commit':commit,'python_version':platform.python_version(),'commit_note':'Source hashes identify this exact working source; commit alone may omit uncommitted edits.'}
