"""Loopback-only static dashboard and local candidate calculation API."""
import argparse
import json
import traceback
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
try:
    from .design_candidates import generate
    from .module_design import recommend
except ImportError:
    from design_candidates import generate
    from module_design import recommend

DASHBOARD = Path(__file__).resolve().parents[1] / 'm0-dashboard'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DASHBOARD), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        super().end_headers()

    def reply(self, code, data):
        body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(code)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path not in ('/api/design','/api/modules'):
            return self.reply(404,{'error':'接口不存在。'})
        expected = f'127.0.0.1:{self.server.server_port}'
        if self.headers.get('Host') != expected or self.headers.get('Origin',f'http://{expected}') != f'http://{expected}':
            return self.reply(403,{'error':'仅允许本机页面请求。'})
        if self.headers.get('Content-Type','').split(';')[0] != 'application/json':
            return self.reply(415,{'error':'请使用 application/json。'})
        try:
            length = int(self.headers.get('Content-Length','0'))
            if not 0 < length <= 16384:
                raise ValueError('请求为空或超过 16 KB。')
            data = json.loads(self.rfile.read(length))
            result = recommend(data) if self.path=='/api/modules' else generate(data)
        except (ValueError, UnicodeError) as error:
            return self.reply(400,{'error':str(error)})
        except Exception:
            # Do not expose paths/tracebacks to clients.
            traceback.print_exc()
            return self.reply(500,{'error':'本地计算失败，请检查服务终端。'})
        self.reply(200,result)

    def do_GET(self):
        if urlsplit(self.path).path == '/api/health':
            return self.reply(200,{'status':'ready','service':'padlock-m1'})
        super().do_GET()

    def setup(self):
        super().setup()
        self.connection.settimeout(20)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8768)
    args = parser.parse_args()
    server = HTTPServer(('127.0.0.1',args.port),Handler)
    print(f'Padlock Lab: http://127.0.0.1:{args.port}/design.html',flush=True)
    server.serve_forever()
