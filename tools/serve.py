"""Local test server that never lets the browser cache anything.
Run: python3 tools/serve.py 8000   then open http://localhost:8000"""
import http.server
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128  # the page asks for several files at once; the default queue of five dropped some
    daemon_threads = True


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
Server(('127.0.0.1', port), NoCache).serve_forever()
