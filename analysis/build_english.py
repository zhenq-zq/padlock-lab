"""Build the English reader assets from maintained source and an explicit translation table."""
import argparse,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FILES=['design.js','workflow.js','modules.js','design-workspace.js','studio.js','binding-view.js','mutation-input.js','sequence-import.js','region-colors.js','variant-library.js','variant-catalog.js']

def translations():
    result={}
    for line in (ROOT/'translations/en.txt').read_text().splitlines():
        if '=' in line:
            a,b=line.split('=',1);result[a]=b
    return result

def translate(text):
    for a,b in sorted(translations().items(),key=lambda x:len(x[0]),reverse=True):text=text.replace(a," "+b+" ")
    return text

def build(check=False):
    def store(path,text):
        if check:
            if not path.exists() or path.read_text()!=text:raise ValueError(f"Generated asset out of date: {path.relative_to(ROOT)}")
        else:path.write_text(text)
    area=ROOT/'m0-dashboard';dest=area/'en';dest.mkdir(exist_ok=True);unknown=set()
    for name in FILES:
        text=translate((area/name).read_text())
        if name=='design.js':
            text=text.replace('el.textContent = text;', 'el.textContent = window.PadlockI18n.message(text);')
            text=text.replace(': error.message;', ': window.PadlockI18n.message(error.message);')
        if name=='modules.js':text=text.replace('.textContent=error.message;', '.textContent=window.PadlockI18n.message(error.message);')
        unknown.update(re.findall('[\u3400-\u9fff]+',text));store(dest/name,text)
    text=translate((area/'design.html').read_text()).replace('lang="zh-CN"','lang="en"')
    for name in FILES:text=text.replace('src="'+name, 'src="en/'+name)
    text=text.replace('<script src="probe.js">','<script src="i18n.js"></script><script src="probe.js">')
    text=text.replace('href="index.html"','href="design-en.html"').replace('class="brand" href="design.html"','class="brand" href="design-en.html"')
    text=text.replace('id="language-switch" class="quiet-button" href="design-en.html" lang="en">English', 'id="language-switch" class="quiet-button" href="design.html" lang="zh-CN">中文')
    text=re.sub(r'<aside>.*?</aside>','<aside><a class="nav active" href="design-en.html">Design studio</a><a class="nav" href="guide.html">User guide</a></aside>',text,count=1,flags=re.S)
    text=text.replace('</head>','<link rel="stylesheet" href="reader.css?v=visual2"></head>').replace('<script src="en/studio.js','<script src="reader.js?v=visual2"></script><script src="en/studio.js')
    unknown.update(v for v in re.findall('[\u3400-\u9fff]+',text) if v!='中文');store(area/'design-en.html',text)
    runtime="'use strict';\nwindow.PadlockI18n={message(text){if(typeof text!=='string')return text;for(const [a,b] of "+json.dumps(sorted(translations().items(),key=lambda x:len(x[0]),reverse=True),ensure_ascii=False)+")text=text.split(a).join(' '+b+' ');return text.trim();}};\n"
    store(area/'i18n.js',runtime)
    return sorted(unknown)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    unknown=build(args.check)
    if unknown:parser.exit(1,'Untranslated Chinese fragments: '+', '.join(unknown)+'\n')
if __name__=='__main__':main()
