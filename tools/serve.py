# Local development server (not needed in production; any static host works).
# Python's default http.server queues only 5 pending connections, which drops requests on a fresh load.
import functools, http.server, sys

class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory='.')
print(f'quarchive on http://localhost:{port}')
Server(('127.0.0.1', port), handler).serve_forever()
