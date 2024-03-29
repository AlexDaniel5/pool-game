import phylib
import os
import sqlite3
import math

################################################################################
# import constants from phylib to global varaibles
BALL_RADIUS = phylib.PHYLIB_BALL_RADIUS
SMALLER_RADIUS = BALL_RADIUS / 1.3
SMALLEST_RADIUS = BALL_RADIUS / 1.8
BALL_DIAMETER = 2 * BALL_RADIUS
HOLE_RADIUS = 2 * BALL_DIAMETER
TABLE_LENGTH = phylib.PHYLIB_TABLE_LENGTH
TABLE_WIDTH = TABLE_LENGTH / 2.0
SIM_RATE = phylib.PHYLIB_SIM_RATE
VEL_EPSILON = phylib.PHYLIB_VEL_EPSILON
DRAG = phylib.PHYLIB_DRAG
MAX_TIME = phylib.PHYLIB_MAX_TIME
MAX_OBJECTS = phylib.PHYLIB_MAX_OBJECTS

FRAME_RATE = 0.01

HEADER = """<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"
"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="700" height="1375" viewBox="-25 -25 1400 2750"
xmlns="http://www.w3.org/2000/svg"
xmlns:xlink="http://www.w3.org/1999/xlink">
<rect width="1350" height="2700" x="0" y="0" fill="#C0D0C0" />"""
FOOTER = """</svg>\n"""

################################################################################
# the standard colours of pool balls
# if you are curious check this out:  
# https://billiards.colostate.edu/faq/ball/colors/

BALL_COLOURS = [ 
    "WHITE",
    "YELLOW",
    "BLUE",
    "RED",
    "PURPLE",
    "ORANGE",
    "GREEN",
    "BROWN",
    "BLACK",
    "KHAKI",
    "LIGHTBLUE",
    "PINK",             # no LIGHTRED
    "MEDIUMPURPLE",     # no LIGHTPURPLE
    "LIGHTSALMON",      # no LIGHTORANGE
    "LIGHTGREEN",
    "SANDYBROWN",       # no LIGHTBROWN 
    ]

################################################################################
class Coordinate( phylib.phylib_coord ):
    """
    This creates a Coordinate subclass, that adds nothing new, but looks
    more like a nice Python class.
    """
    pass


################################################################################
class StillBall( phylib.phylib_object ):
    """
    Python StillBall class.
    """

    def __init__( self, number, pos ):
        """
        Constructor function. Requires ball number and position (x,y) as
        arguments.
        """

        # this creates a generic phylib_object
        phylib.phylib_object.__init__( self, 
                                    phylib.PHYLIB_STILL_BALL, 
                                    number, 
                                    pos, None, None, 
                                    0.0, 0.0 )
    
        # this converts the phylib_object into a StillBall class
        self.__class__ = StillBall


    # add an svg method here
    def svg(self):
        if self.obj.still_ball.number > 8:
            return """
            <circle cx="%d" cy="%d" r="%d" fill="%s" />
            <circle cx="%d" cy="%d" r="%d" fill="%s" />
            <circle cx="%d" cy="%d" r="%d" fill="%s" />
            """ % (
                self.obj.still_ball.pos.x, self.obj.still_ball.pos.y, BALL_RADIUS, BALL_COLOURS[self.obj.still_ball.number],
                self.obj.still_ball.pos.x, self.obj.still_ball.pos.y, SMALLER_RADIUS, "ghostwhite",  # Adjust SMALLER_RADIUS and color as needed
                self.obj.still_ball.pos.x, self.obj.still_ball.pos.y, SMALLEST_RADIUS, BALL_COLOURS[self.obj.still_ball.number]  # Adjust SMALLEST_RADIUS as needed
            )
        else:
            return """ <circle cx="%d" cy="%d" r="%d" fill="%s" />\n""" % (self.obj.still_ball.pos.x, self.obj.still_ball.pos.y, BALL_RADIUS, BALL_COLOURS[self.obj.still_ball.number])

class RollingBall(phylib.phylib_object):
    def __init__(self, number, pos, vel, acc):
        phylib.phylib_object.__init__( self,
                                    phylib.PHYLIB_ROLLING_BALL,
                                    number,
                                    pos, vel, acc,
                                    0.0, 0.0 )
        self.__class__ = RollingBall

    def svg(self):
        if self.obj.still_ball.number > 8:
            return """
            <circle cx="%d" cy="%d" r="%d" fill="%s" />
            <circle cx="%d" cy="%d" r="%d" fill="%s" />
            <circle cx="%d" cy="%d" r="%d" fill="%s" />
            """ % (
                self.obj.still_ball.pos.x, self.obj.still_ball.pos.y, BALL_RADIUS, BALL_COLOURS[self.obj.still_ball.number],
                self.obj.still_ball.pos.x, self.obj.still_ball.pos.y, SMALLER_RADIUS, "ghostwhite",  # Adjust SMALLER_RADIUS and color as needed
                self.obj.still_ball.pos.x, self.obj.still_ball.pos.y, SMALLEST_RADIUS, BALL_COLOURS[self.obj.still_ball.number]  # Adjust SMALLEST_RADIUS as needed
            )
        else:
            return """ <circle cx="%d" cy="%d" r="%d" fill="%s" />\n""" % (self.obj.still_ball.pos.x, self.obj.still_ball.pos.y, BALL_RADIUS, BALL_COLOURS[self.obj.still_ball.number])

class Hole(phylib.phylib_object):
    def __init__(self, pos):
        phylib.phylib_object.__init__( self,
                                    phylib.PHYLIB_HOLE,
                                    0,
                                    pos, None, None,
                                    0.0, 0.0 )
        self.__class__ = Hole

    def svg(self):
        return """ <circle cx="%d" cy="%d" r="%d" fill="black" />\n""" % (self.obj.hole.pos.x, self.obj.hole.pos.y, HOLE_RADIUS)
        
class HCushion(phylib.phylib_object):
    def __init__(self, y):
        phylib.phylib_object.__init__( self,
                                    phylib.PHYLIB_HCUSHION,
                                    0,
                                    None, None, None,
                                    0.0, y )
        self.__class__ = HCushion
    
    def svg(self):
        ynum = 2700
        if self.obj.hcushion.y == 0:
            ynum = -25
        return """ <rect width="1400" height="25" x="-25" y="%d" fill="darkgreen" />\n""" % (ynum)

class VCushion(phylib.phylib_object):
    def __init__(self, x):
        phylib.phylib_object.__init__( self,
                                    phylib.PHYLIB_VCUSHION,
                                    0,
                                    None, None,None,
                                    x, 0.0 )
        self.__class__ = VCushion

    def svg(self):
        xnum = 1350
        if self.obj.vcushion.x == 0:
            xnum = -25
        return """ <rect width="25" height="2750" x="%d" y="-25" fill="darkgreen" />\n""" % (xnum)



################################################################################

class Table( phylib.phylib_table ):
    """
    Pool table class.
    """

    def __init__( self ):
        """
        Table constructor method.
        This method call the phylib_table constructor and sets the current
        object index to -1.
        """
        phylib.phylib_table.__init__( self )
        self.current = -1

    def __iadd__( self, other ):
        """
        += operator overloading method.
        This method allows you to write "table+=object" to add another object
        to the table.
        """
        self.add_object( other )
        return self

    def __iter__( self ):
        """
        This method adds iterator support for the table.
        This allows you to write "for object in table:" to loop over all
        the objects in the table.
        """
        return self

    def __next__( self ):
        """
        This provides the next object from the table in a loop.
        """
        self.current += 1;  # increment the index to the next object
        if self.current < MAX_OBJECTS:   # check if there are no more objects
            return self[ self.current ]; # return the latest object

        # if we get there then we have gone through all the objects
        self.current = -1;    # reset the index counter
        raise StopIteration;  # raise StopIteration to tell for loop to stop

    def __getitem__( self, index ):
        """
        This method adds item retreivel support using square brackets [ ] .
        It calls get_object (see phylib.i) to retreive a generic phylib_object
        and then sets the __class__ attribute to make the class match
        the object type.
        """
        result = self.get_object( index ); 
        if result==None:
            return None
        if result.type == phylib.PHYLIB_STILL_BALL:
            result.__class__ = StillBall
        if result.type == phylib.PHYLIB_ROLLING_BALL:
            result.__class__ = RollingBall
        if result.type == phylib.PHYLIB_HOLE:
            result.__class__ = Hole
        if result.type == phylib.PHYLIB_HCUSHION:
            result.__class__ = HCushion
        if result.type == phylib.PHYLIB_VCUSHION:
            result.__class__ = VCushion
        return result

    def __str__( self ):
        """
        Returns a string representation of the table that matches
        the phylib_print_table function from A1Test1.c.
        """
        result = "";    # create empty string
        result += "time = %6.1f;\n" % self.time;    # append time
        for i,obj in enumerate(self): # loop over all objects and number them
            result += "  [%02d] = %s\n" % (i,obj);  # append object description
        return result;  # return the string

    def segment( self ):
        """
        Calls the segment method from phylib.i (which calls the phylib_segment
        functions in phylib.c.
        Sets the __class__ of the returned phylib_table object to Table
        to make it a Table object.
        """

        result = phylib.phylib_table.segment( self )
        if result:
            result.__class__ = Table
            result.current = -1
        return result

    # add svg method here
    def svg(self):
        result = HEADER
        for obj in self:
            if obj is not None:
                result += obj.svg()
        result += FOOTER
        return result
    
    def roll( self, t ):
        new = Table()
        for ball in self:
            if isinstance( ball, RollingBall ):
                # create a new ball with the same number as the old ball
                new_ball = RollingBall( ball.obj.rolling_ball.number,
                Coordinate(0,0),
                Coordinate(0,0),
                Coordinate(0,0) )
                # compute where it rolls to
                phylib.phylib_roll( new_ball, ball, t )
                # add ball to table
                new += new_ball
            if isinstance( ball, StillBall ):
                # create a new ball with the same number and pos as the old ball
                new_ball = StillBall( ball.obj.still_ball.number,
                                        Coordinate( ball.obj.still_ball.pos.x,
                                                    ball.obj.still_ball.pos.y ) )
                # add ball to table
                new += new_ball
        # return table
        return new

    def cueBall(self, table, xvel, yvel):
        for object in table:
            if isinstance(object, StillBall) and object.obj.still_ball.number == 0:
                cueBall = object
                xpos = cueBall.obj.still_ball.pos.x
                ypos = cueBall.obj.still_ball.pos.y
        if isinstance(cueBall, StillBall):
            cueBall.type = phylib.PHYLIB_ROLLING_BALL
            cueBall.obj.rolling_ball.pos.x = xpos
            cueBall.obj.rolling_ball.pos.y = ypos
            cueBall.obj.rolling_ball.vel.x = xvel
            cueBall.obj.rolling_ball.vel.y = yvel
            speed = math.sqrt(xvel ** 2 + yvel ** 2)
            # Calculate acceleration
            accX = 0.0
            accY = 0.0
            if speed > VEL_EPSILON:
                dragFactor = DRAG / speed
                accX = -xvel * dragFactor
                accY = -yvel * dragFactor
            cueBall.obj.rolling_ball.acc = Coordinate(accX, accY)
            cueBall.obj.rolling_ball.number = 0
        else:
            raise ValueError("Cue ball not found in the table.")

class Database:
    def __init__(self, reset = False):
        if reset and os.path.exists("phylib.db"):
            os.remove("phylib.db")
        # Create/open a new database connection
        self.conn = sqlite3.connect("phylib.db")
        self.cursor = self.conn.cursor()

    def createDB(self):
        self.cursor = self.conn.cursor()
        self.cursor.execute("""CREATE TABLE IF NOT EXISTS BALL (
                        BALLID INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        BALLNO INTEGER NOT NULL,
                        XPOS FLOAT NOT NULL,
                        YPOS FLOAT NOT NULL,
                        XVEL FLOAT,
                        YVEL FLOAT);""")
        
        self.cursor.execute("""CREATE TABLE IF NOT EXISTS TTABLE (
                            TABLEID INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                            TIME FLOAT NOT NULL);""")
        
        self.cursor.execute("""CREATE TABLE IF NOT EXISTS BALLTABLE (   
                            BALLID INTEGER NOT NULL,
                            TABLEID INTEGER NOT NULL,
                            FOREIGN KEY (BALLID) REFERENCES BALL(BALLID),
                            FOREIGN KEY (TABLEID) REFERENCES TTABLE(TABLEID) );""")
        
        self.cursor.execute("""CREATE TABLE IF NOT EXISTS SHOT (
                            SHOTID INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                            PLAYERID INTEGER NOT NULL,
                            GAMEID INTEGER NOT NULL,
                            FOREIGN KEY (PLAYERID) REFERENCES PLAYER(PLAYERID),
                            FOREIGN KEY (GAMEID) REFERENCES GAME(GAMEID) );""")

        self.cursor.execute("""CREATE TABLE IF NOT EXISTS TABLESHOT (
                            TABLEID INTEGER NOT NULL,
                            SHOTID INTEGER NOT NULL,
                            FOREIGN KEY (TABLEID) REFERENCES TTABLE(TABLEID),
                            FOREIGN KEY (SHOTID) REFERENCES SHOT(SHOTID) );""")

        self.cursor.execute("""CREATE TABLE IF NOT EXISTS GAME (
                            GAMEID INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                            TABLEID INTEGER NOT NULL,
                            GAMENAME VARCHAR (64),
                            FOREIGN KEY (TABLEID) REFERENCES TTABLE);""")
        
        self.cursor.execute("""CREATE TABLE IF NOT EXISTS PLAYER (
                            PLAYERID INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                            GAMEID INTEGER NOT NULL,
                            PLAYERNAME VARCHAR (64) NOT NULL,
                            FOREIGN KEY (GAMEID) REFERENCES GAME(GAMEID) );""")

        self.conn.commit()
        self.cursor.close()                    
    
    def readTable(self, tableID):
        self.cursor = self.conn.cursor()
        self.cursor.execute("SELECT * FROM TTable WHERE TABLEID = ?", (tableID+1,))
            
        data = self.cursor.fetchall()
        if not data:
            return None
        table = Table()
        self.cursor.execute("""SELECT Ball.BALLID, Ball.BALLNO, Ball.XPOS, Ball.YPOS, Ball.XVEL, Ball.YVEL FROM Ball
                            INNER JOIN BallTable
                            ON Ball.BALLID = BallTable.BALLID
                            WHERE BallTable.TABLEID = ? """, (tableID+1,))
        balls = self.cursor.fetchall()
        # Create Ball objects
        for ball in balls:
            ballID, ballNO, posX, posY, velX, velY = ball
            if (velX is None or velX == 0)  and (velY is None or velY == 0):
                ball = StillBall(ballNO, Coordinate(posX, posY))
            else:
                speed = math.sqrt(velX ** 2 + velY ** 2)
                # Calculate acceleration
                accX = 0.0
                accY = 0.0
                if speed > VEL_EPSILON:
                    dragFactor = DRAG / speed
                    accX = -velX * dragFactor
                    accY = -velY * dragFactor
                # Add attributes to ball
                ball = RollingBall(ballNO, Coordinate(posX, posY), Coordinate(velX, velY), Coordinate(accX, accY))
            table += ball
        self.cursor.execute("SELECT TIME FROM TTABLE WHERE TABLEID = ?", (tableID+1,))
        time = self.cursor.fetchone()
        table.time = time[0]
        self.conn.commit()
        self.cursor.close()
        return table

    def writeTable(self, table, gameName):
        self.cursor = self.conn.cursor()
        self.cursor.execute("INSERT INTO TTable (TIME) VALUES (?)", (table.time,))
        tableID = self.cursor.lastrowid
        self.cursor.execute("INSERT INTO GAME (TABLEID, GAMENAME) VALUES (?, ?)", (tableID, gameName))
        # Get objects from table and add it to the Ball and BallTable databases
        for object in table:
            # None type cause an error on the elif statements
            if object is None:
                continue
            elif isinstance(object, StillBall):
                num = object.obj.still_ball.number
                posx = object.obj.still_ball.pos.x
                posy = object.obj.still_ball.pos.y
                self.cursor.execute("""
                    INSERT INTO BALL (BALLNO, XPOS, YPOS) 
                    VALUES (?, ?, ?)""", (num, posx, posy))
            elif isinstance(object, RollingBall):
                num = object.obj.rolling_ball.number
                posx = object.obj.rolling_ball.pos.x
                posy = object.obj.rolling_ball.pos.y
                velx = object.obj.rolling_ball.vel.x
                vely = object.obj.rolling_ball.vel.y
                self.cursor.execute("""
                    INSERT INTO BALL (BALLNO, XPOS, YPOS, XVEL, YVEL) 
                    VALUES (?, ?, ?, ?, ?)""", (num, posx, posy, velx, vely))
            # Other objects won't execute the code below and will be skipped
            else:
                continue
            ballID = self.cursor.lastrowid
            self.cursor.execute("""
                INSERT INTO BALLTABLE (BALLID, TABLEID)
                VALUES (?, ?)""", (ballID, tableID))
                
        self.conn.commit()
        self.cursor.close()
        
        return tableID - 1

    def getGame(self, gameID):
        self.cursor = self.conn.cursor()
        self.cursor.execute("""
                            SELECT PLAYERNAME, GAMENAME 
                            FROM PLAYER
                            INNER JOIN GAME ON GAME.GAMEID = PLAYER.GAMEID
                            WHERE PLAYER.GAMEID = ?
                            ORDER BY PLAYERID
                            """, (gameID,))
        data = self.cursor.fetchall()
        self.cursor.execute("SELECT TABLEID FROM GAME WHERE GAMEID = ?", (gameID,))
        table_row = self.cursor.fetchone()
        tableID = int(table_row[0])
        self.conn.commit()
        self.cursor.close()
        return data, tableID

    def shotFinished(self, tableID, gameID):
        self.cursor = self.conn.cursor()
        self.cursor.execute("UPDATE GAME SET TABLEID = ? WHERE GAMEID = ?", (tableID, gameID))
        data = self.cursor.fetchone()
        self.conn.commit()
        self.cursor.close()

    def setGame(self, gameName, tableID, player1Name, player2Name):
        self.cursor = self.conn.cursor()
        # Insert a new game into the game table
        self.cursor.execute("INSERT INTO GAME (TABLEID, GAMENAME) VALUES (?, ?)", (tableID, gameName))
        gameID = self.cursor.lastrowid
        # Insert both players into the player table
        self.cursor.execute("INSERT INTO PLAYER (GAMEID, PLAYERNAME) VALUES (?, ?)", (gameID, player1Name))
        self.cursor.execute("INSERT INTO PLAYER (GAMEID, PLAYERNAME) VALUES (?, ?)", (gameID, player2Name))

        self.conn.commit()
        self.cursor.close()
        return gameID

    def newShot(self, playerName, gameID):
        self.cursor = self.conn.cursor()
        # Retrieve player ID based on the game and player name
        playerID = self.cursor.execute("""SELECT Game.GAMEID, Player.PLAYERID FROM Game 
                            INNER JOIN Player
                            ON Game.GAMEID = Player.GAMEID
                            WHERE Game.GAMEID = ? AND Player.PLAYERNAME = ?""", (gameID, playerName)).fetchone()
        # Insert a new shot into the shot table
        #self.cursor.execute("INSERT INTO SHOT (PLAYERID, GAMEID) VALUES (?, ?)", (playerID, gameID))
        shotID = self.cursor.lastrowid
        self.conn.commit()
        self.cursor.close()
        return shotID

    def addTableShot(self, newTableID, shotID):
        self.cursor = self.conn.cursor()
        # Inser table ID and shot ID into the tableshot table
        self.cursor.execute("""
                        INSERT INTO TABLESHOT (TABLEID, SHOTID)
                        VALUES (?, ?)""", (newTableID, shotID))
        self.conn.commit()
        self.cursor.close()

    def close(self):
        self.conn.commit()
        self.conn.close()

class Game:
    def __init__(self, gameID=None, gameName=None, player1Name=None, player2Name=None):
        self.database = Database()
        # Retrieve game information based on the given gameID
        if (
            gameID is not None
            and gameName is None
            and player1Name is None
            and player2Name is None
        ):
            self.gameID = gameID
            game, self.tableID = self.database.getGame(gameID)
            self.player1Name, self.gameName = game[0]
            self.player2Name = game[1][0]
        # Creating a game with attributes given
        elif (
            gameID is None
            and gameName is not None
            and player1Name is not None
            and player2Name is not None
        ):
            self.gameName = gameName
            self.player1Name = player1Name
            self.player2Name = player2Name
            self.tableID = Game.createTable(gameName)
            self.gameID = self.database.setGame(gameName, self.tableID, player1Name, player2Name)
        else:
            raise TypeError("Invalid arguments for constructor.")
    
    def createTable(gameName):
        table = Table()
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
                pos = Coordinate(x, y)
                table += StillBall(ballNum, pos)
                ballNum += 1
                x += xSpacing
            col += 1
        # Cue ball
        pos = Coordinate(677, 2025)
        sb = StillBall(0, pos)
        table += sb
        filename = "poolTable.svg"
        with open(filename, 'w') as file:
            file.write(table.svg())

        # Initialize database
        db = Database()
        db.createDB()
        return db.writeTable(table, gameName)

    def shoot(self, gameName, playerName, table, xvel, yvel):
        self.database = Database()
        gameID = self.gameID
        # Retrieve game and player information
        #shotID = self.database.newShot(playerName, gameID)
        # Set attributes of cueball
        table.cueBall(table, xvel, yvel)
        
        tablesList = []
        while True:
            oldTable = table
            table = table.segment()
            # Break the while loop if the new table doesn't exist
            if table is None:
                break
            segmentSeconds = math.floor((table.time - oldTable.time) / FRAME_RATE)
            # Iterate over the frames and write the new table state
            for i in range(segmentSeconds):
                nextFrameTime = i * FRAME_RATE
                newTable = oldTable.roll(nextFrameTime)
                newTable.time = nextFrameTime + oldTable.time
                #newTableID = self.database.`writeTable`(newTable, gameName)
                #self.database.addTableShot(newTableID, shotID)
                
                # Append the new table to the tables_list
                tablesList.append(newTable)
        tablesList.append(oldTable)
        tableID = self.database.writeTable(oldTable, gameName)
        self.database.shotFinished(tableID, gameID)
        #self.database.updateGame(tableID, gameID)
        return tablesList, oldTable