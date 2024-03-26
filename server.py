from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qsl
import json
import sys

class MyHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        BaseHTTPRequestHandler.end_headers(self)

    def do_GET(self):
        # Parse the URL path
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        if path == '/pool_table.html':
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
        elif path == '/poolTable.svg':  # Handle SVG file request
            try:
                with open('poolTable.svg', 'rb') as file:
                    content = file.read()
                    self.send_response(200)
                    self.send_header('Content-type', 'image/svg+xml')
                    self.send_header('Content-length', len(content))
                    self.end_headers()
                    self.wfile.write(content)
            except FileNotFoundError:
                self.send_error(404, 'File Not Found: poolTable.svg')
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(bytes("404: %s not found" % path, "utf-8"))

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        post_params = json.loads(post_data.decode('utf-8'))

        # Returns the updated table state
        shoot(post_params['cue_ball_pos'], post_params['shoot_params'])

        # Send a redirect response to the client
        self.send_response(303)  # Redirect status code
        self.send_header('Location', '/pool_table.html')  # Redirect to the HTML page
        self.end_headers()

if __name__ == '__main__':
    httpd = HTTPServer( ( 'localhost', int(sys.argv[1]) ), MyHandler )
    print( "Server listing in port:  ", int(sys.argv[1]) )
    print(f'Server started on http://localhost:{sys.argv[1]}/pool_table.html')
    httpd.serve_forever()