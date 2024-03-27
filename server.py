from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qsl
import sys
import os
import Physics
import math
import json

class MyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/game_setup.html':
            # Retrieve the HTML file
            fp = open( '.'+self.path )
            content = fp.read()
            # Generate the headers
            self.send_response(200)  # OK
            self.send_header("Content-type", "text/html")
            self.send_header("Content-length", len(content))
            self.end_headers()

            # Send it to the browser
            self.wfile.write(bytes(content, "utf-8"))
        elif parsed.path == '/poolTable.svg':
            try:
                with open(os.path.join('.', parsed.path[1:]), 'rb') as file:
                    self.send_response(200)
                    self.send_header('Content-type', 'image/svg+xml')
                    self.end_headers()
                    self.wfile.write(file.read())
            except FileNotFoundError:
                self.send_error(404, 'File Not Found: {}'.format(parsed.path))
        # Generate 404 for GET requests that aren't the files above
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(bytes("404: %s not found" % self.path, "utf-8"))

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/pool_table.html':
            # Receive the form data
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            formData = dict(parse_qsl(post_data))
            # Retrieve player names
            p1Name = str(formData['p1_name'])
            p2Name = str(formData['p2_name'])

            table = Physics.Table()

            # Add all normal balls to table
            ballNum = 1
            xSpacing = 61
            xChange = 30.5
            yChange = 52.8
            col = 1
            for row in range(5):
                x = 675 - xChange * row
                y = 675 - yChange * row
                for cols in range(col):
                    pos = Physics.Coordinate(x, y)
                    table += Physics.StillBall(ballNum, pos)
                    ballNum += 1
                    x += xSpacing
                col += 1

            # Cue ball
            pos = Physics.Coordinate(677, 2025)
            sb = Physics.StillBall(0, pos)
            table += sb

            db = Physics.Database(reset=True)
            db.createDB()
            
            filename = "poolTable.svg"
            with open(filename, 'w') as file:
                file.write(table.svg())
            table = table.segment()

            # Open and read the content of the file
            htmlContent = ''
            filename = "pool_table.html"
            with open(filename, 'rb') as file:
                htmlContent = file.read()
            htmlContent = htmlContent.decode('utf-8')
            print(p1Name, p2Name)
            htmlContent = htmlContent.replace('{player1}', p1Name)
            htmlContent = htmlContent.replace('{player2}', p2Name)
            # Send a successful HTTP response with SVG content to the client
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.send_header('Content-length', len(htmlContent))
            self.end_headers()
            self.wfile.write(htmlContent.encode('utf-8'))
        else:
            # Generate 404 for POST requests that aren't the file above
            self.send_response(404)
            self.end_headers()
            self.wfile.write(bytes("404: %s not found" % self.path, "utf-8"))

if __name__ == '__main__':
    httpd = HTTPServer( ( 'localhost', int(sys.argv[1]) ), MyHandler )
    print( "Server listing in port:  ", int(sys.argv[1]) )
    print(f'Server started on http://localhost:{sys.argv[1]}/game_setup.html')
    httpd.serve_forever()
