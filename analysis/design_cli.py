"""Create a record: python -m analysis.design_cli request.json -o result.json."""
import argparse
import json
from pathlib import Path
from .design_candidates import generate

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('request',type=Path);parser.add_argument('-o','--output',required=True,type=Path);args=parser.parse_args()
    try:
        request=json.loads(args.request.read_text());result=generate(request)
        args.output.write_text(json.dumps(result,indent=2,ensure_ascii=False,allow_nan=False)+'\n')
    except (ValueError,OSError) as error:parser.exit(2,str(error)+'\n')
if __name__=='__main__':main()
