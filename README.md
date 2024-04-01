## General Information
Name: Alex Daniel
Date: March 31, 2024

### To Run
- In the terminal write: make
- Then type into the terminal: export LD_LIBRARY_PATH=`pwd`
- And finally type into terminal: python3 server.py 58467
- (ctrl + left click) the link in terminal

### Description
I have created a Jank Pool game where users can input the names of the two players along with the game's name. If no input is provided, default values are used. Players cannot have the same name to avoid confusion during gameplay. In this game, players are not initially assigned to teams. When a player successfully pots a ball, they are assigned to the team with fewer balls. If there is an equal number of balls on both teams, they are automatically assigned to the stripe team. Players win the game either by potting all of their balls followed by the 8-ball, or if the opponent pots the 8-ball before clearing all their own balls. There is a back button located in the game information at the top right corner to initiate a new game.

### Notes
- A player won't win if they sink their side's last ball at the same time as the 8 ball
- A player will still win if they sink the 8 ball with the cueball last
