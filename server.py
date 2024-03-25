from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qsl
import sys

class MyHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        BaseHTTPRequestHandler.end_headers(self)

    def do_GET(self):
        if self.path == '/pool_table.html':
            try:
                with open('pool_table.html', 'rb') as file:
                    content = file.read()
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html')
                    self.send_header('Content-length', len(content))
                    self.end_headers()
                    self.wfile.write(content)
            except FileNotFoundError:
                self.send_error(404, 'File Not Found: pool_table.html')
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(bytes("404: %s not found" % self.path, "utf-8"))

if __name__ == '__main__':
    httpd = HTTPServer( ( 'localhost', int(sys.argv[1]) ), MyHandler )
    print( "Server listing in port:  ", int(sys.argv[1]) )
    print(f'Server started on http://localhost:{sys.argv[1]}/pool_table.html')
    httpd.serve_forever()