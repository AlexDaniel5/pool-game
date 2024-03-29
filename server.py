from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qsl
import sys
import os
import Physics
import math
import json
import random

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
        # Find my master svg file
        elif parsed.path == '/poolTable.svg':
            try:
                with open(os.path.join('.', parsed.path[1:]), 'rb') as file:
                    self.send_response(200)
                    self.send_header('Content-type', 'image/svg+xml')
                    self.end_headers()
                    self.wfile.write(file.read())
            except FileNotFoundError:
                self.send_error(404, 'File Not Found: {}'.format(parsed.path))
        # Find any javascript files I create
        elif parsed.path.endswith('.js'):
            try:
                with open(os.path.join('.', parsed.path[1:]), 'rb') as file:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/javascript')
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
            p1Name = formData.get('p1_name', None)
            p2Name = formData.get("p2_name", None)
            gameName = formData.get('game_name', None)
            gameID = formData.get('game_id', None)

            # Randomize who plays first
            playerNum = random.randint(1, 2)
            if playerNum == 1:
                currentPlayer = p1Name
            else:
                currentPlayer = p2Name

            game = Physics.Game(gameID, gameName, p1Name, p2Name)

            # Open and read the content of the file
            htmlContent = ''
            filename = "pool_table.html"
            with open(filename, 'rb') as file:
                htmlContent = file.read()
            htmlContent = htmlContent.decode('utf-8')
            htmlContent = htmlContent.replace('<span id="p1Name"></span>', p1Name)
            htmlContent = htmlContent.replace('<span id="p2Name"></span>', p2Name)
            htmlContent = htmlContent.replace('<span id="currentP"></span>', f'<span id="currentP">{currentPlayer}</span>')
            htmlContent = htmlContent.replace('data_id="0"', f'data_id="{game.gameID}"')
            htmlContent = htmlContent.replace('data_cp="0"', f'data_cp="{playerNum}"')
            # Send a successful HTTP response with SVG content to the client
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.send_header('Content-length', len(htmlContent))
            self.end_headers()
            self.wfile.write(htmlContent.encode('utf-8'))
        elif parsed.path == '/shoot':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            formData = dict(parse_qsl(post_data))

            velX = float(formData.get('velX'))
            velY = float(formData.get('velY'))
            gameid = int(formData.get('gameid'))
            playerNum = int(formData.get('playerNum'))
            game = Physics.Game(gameid)
            shots, table = game.shoot(game.gameName, game.player1Name, game.database.readTable(game.tableID), velX, velY)
            for i in range(len(shots)):
                svgString = shots[i].svg()
                shots[i] = svgString
            content = ":,:".join(shots)

            file_path = 'poolTable.svg'
            with open(file_path, 'w') as file:
                file.write(shots[-1])

            # print("Current player", playerNum)
            # if playerNum == 1:
            #     currentPlayer = game.player2Name
            #     playerNum = 2
            # else:
            #     currentPlayer = game.player1Name
            #     playerNum = 1
            # htmlContent = ''
            # filename = "pool_table.html"
            # with open(filename, 'rb') as file:
            #     htmlContent = file.read()
            # htmlContent = htmlContent.decode('utf-8')
            #htmlContent = htmlContent.replace('<span id="currentP"></span>', f'<span id="currentP">{currentPlayer}</span>')
            #htmlContent = htmlContent.replace('data_cp="1"', f'data_cp="{playerNum}"')
            self.send_response(200)
            self.send_header('Content-type', 'text')
            self.send_header('Content-length', len(content))
            self.end_headers()
            self.wfile.write(bytes(content, "utf-8"))
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
