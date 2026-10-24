"""Replay an exported schema2 design record: python -m analysis.replay record.json -o replay.json."""
import argparse
import json
from pathlib import Path
from .provenance import software_record,stable_hash

def replay(record,allow_version_mismatch=False):
    if not isinstance(record,dict) or record.get('schema_version')!=2 or not isinstance(record.get('request'),dict):
        raise ValueError('Replay requires a schema_version2 record with its full request.')
    expected=record.get('software',{}).get('source_sha256')
    if not expected or expected!=software_record()['source_sha256']:
        if not allow_version_mismatch:raise ValueError('Source version does not match the saved record; explicitly allow a version mismatch to compare.')
    if record.get('request_sha256')!=stable_hash(record['request']):raise ValueError('Request checksum does not match.')
    from .design_candidates import generate
    result=generate(record['request'])
    matches=[c['sequence'] for c in record.get('candidates',[])]==[c['sequence'] for c in result['candidates']]
    if not matches:raise ValueError('Replayed candidate sequences do not match the saved record.')
    selection=record.get('selection',{})
    allowed={c['id']:'computed' for c in result['candidates']}
    if result['reference']['matches_input']:allowed[result['reference']['id']]='experimental_reference'
    identifier=selection.get('candidate_id')
    if identifier is not None:
        if identifier not in allowed or selection.get('role')!=allowed[identifier]:raise ValueError('Selected candidate does not match the record.')
        result['selection']=selection
    result['replay']={'candidate_sequences_match':True,'source_matches':expected==result['software']['source_sha256']}
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('record',type=Path);parser.add_argument('-o','--output',type=Path,required=True)
    parser.add_argument('--allow-version-mismatch',action='store_true')
    args=parser.parse_args()
    try:result=replay(json.loads(args.record.read_text()),args.allow_version_mismatch)
    except (ValueError,OSError) as error:parser.exit(2,str(error)+'\n')
    args.output.write_text(json.dumps(result,indent=2,ensure_ascii=False,allow_nan=False)+'\n')
if __name__=='__main__':main()
