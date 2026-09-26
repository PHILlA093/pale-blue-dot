"""Isolated UI smoke-test server. Bind only to loopback; never calls a real AI API."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        route = urlsplit(self.path).path
        if route == '/qa-train.html':
            html = (ROOT / 'train.html').read_text(encoding='utf-8')
            html = html.replace('<script src="js/train.js"></script>',
                                '<script src="tests/browser-fixture.js"></script>\n<script src="js/train.js"></script>')
            data = html.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if route in ('/index.html', '/train.html', '/guanlan.html', '/favicon.ico', '/tests/browser-fixture.js') or route.startswith(('/js/', '/css/', '/vendor/')):
            return super().do_GET()
        self.send_error(404)


if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 18864), Handler).serve_forever()
