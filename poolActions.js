// Fetch SVG content from file and insert it into #poolTable
function loadSVGContent() {
    $.get('poolTable.svg', function(data) {
      $('#poolTable').html(data.documentElement);
    addEventListeners();
    });
}

let endX = 0;
let endY = 0;
let solidBallCount = 7
let stripeBallCount = 7
let playerNum = parseInt($('#current_turn').attr('data_cp'), 10);
let player1Side = '';
let player2Side = '';
// Event listener for pool table actions
function addEventListeners() {
    // No more actions can be made
    var cueBall = $("circle[fill='WHITE']");
    // Event listener for clicking the cue ball
    cueBall.on('mousedown', (event) => {
        const cueBall = event.target;
        const cueBallRect = cueBall.getBoundingClientRect(); //Returns size of cueball
        const cueBallCenterX = cueBallRect.left + cueBallRect.width / 2;
        const cueBallCenterY = cueBallRect.top + cueBallRect.height / 2;
        // Create line element
        const line = $('<div class="line"></div>').appendTo('body');
        line.css({
            position: 'absolute',
            background: 'white',
            height: '2px',
            transformOrigin: 'left center',
        });

        // Event listener for moving the mouse
        $(document).on('mousemove', (event) => {
            const mouseX = event.pageX;
            const mouseY = event.pageY;

            // Calculate the distance between cue ball center and mouse cursor
            const distance = Math.sqrt(Math.pow(mouseX - cueBallCenterX, 2) + Math.pow(mouseY - cueBallCenterY, 2));
            // Limit the line length based on cursor position
            const maxLength = 150;
            const limitedDistance = Math.min(distance, maxLength);
            // Calculate the endpoint coordinates based on limited distance
            endX = cueBallCenterX + limitedDistance * (mouseX - cueBallCenterX) / distance;
            endY = cueBallCenterY + limitedDistance * (mouseY - cueBallCenterY) / distance;

            line.css({
                width: limitedDistance + 'px',
                transform: `rotate(${Math.atan2(endY - cueBallCenterY, endX - cueBallCenterX) + Math.PI}rad)`,
                left: cueBallCenterX + 'px',
                top: cueBallCenterY + 'px',
            });
        });

        // Event listener for releasing the mouse button
        $(document).on('mouseup', (event) => {
            line.remove();
            $(document).off('mousemove');
            $(document).off('mouseup');
            const cueBallCenterX = cueBallRect.left + cueBallRect.width / 2;
            const cueBallCenterY = cueBallRect.top + cueBallRect.height / 2;
            const mouseX = event.pageX;
            const mouseY = event.pageY;
            let rawVelX = mouseX - cueBallCenterX;
            let rawVelY = mouseY - cueBallCenterY;
            const maxDistance = 150; // Maximum distance for normalization
            let normalizedVelX = rawVelX / maxDistance;
            let normalizedVelY = rawVelY / maxDistance;
            // Normalize velocity
            const scale = 10000;
            let scaledVelX = Math.round(normalizedVelX * scale);
            let scaledVelY = Math.round(normalizedVelY * scale);
            // Cap the velocity at ±10000
            velX = Math.max(-10000, Math.min(10000, scaledVelX));
            velY = Math.max(-10000, Math.min(10000, scaledVelY));
            gameid = $('#game_id').attr('data_id');
            // Define the data to be sent in the POST request
            postData = {
                velX: -velX,
                velY: -velY,
                gameid: gameid,
            };
            // Send POST request
            $.post('/shoot', postData, showShot)
        });
    });
}

function showShot(data, status) {
    var tables = data.split(":,:")
    let isGameOver = false;
    tables.forEach(function(item, index) {
        setTimeout(function(){
            displayFrame(item)
        }, 10 * (index + 1))
    });
    // Add event listeners to the last svg displayed
    setTimeout(function() {
        check8BallSunk();
        let prevSolid = solidBallCount;
        let prevStripe = stripeBallCount;
        countBalls();
        if (!isGameOver) {
            addEventListeners();
            if ((player1Side === 'Solids' && $('#currentP').text() === $('#p1Name').text() && prevSolid === solidBallCount)
            ||( player1Side === 'Stripes' && $('#currentP').text() === $('#p1Name').text() && prevStripe === stripeBallCount)
            || (player2Side === 'Solids' && $('#currentP').text() === $('#p2Name').text() && prevSolid === solidBallCount)
            ||( player2Side === 'Stripes' && $('#currentP').text() === $('#p2Name').text() && prevStripe === stripeBallCount)) {
                switchCurrentP();
            }
        }
    }, 10 * tables.length);
}

function displayFrame(frame){
    $("#poolTable").html(frame);
}

function switchCurrentP() {
    var currentPlayerText = $('#currentP').text();
    var p1Name = $('#p1Name').text();
    var p2Name = $('#p2Name').text();
    var nextPlayerText = currentPlayerText === p1Name ? p2Name : p1Name;
    $('#currentP').text(nextPlayerText);
}

function check8BallSunk() {
    // Check if the 8 ball is present in the SVG
    const eightBall = $("circle[data_ball='8ball']");
    if (eightBall.length === 0) {
        console.log("8 Ball has been sunk!");
        // Determine the current player
        const currentPlayer = $('#currentP').text();
        let winningPlayer = '';
        if (currentPlayer === $('#p1Name').text()) {
            winningPlayer = $('#p2Name').text();
        } else {
            winningPlayer = $('#p1Name').text();
        }
        $('#currentTurn').text(winningPlayer + " Won!");
        gameIsOver = true;
    }
}

function countBalls() {
    // Select all circles representing balls
    const allBalls = $("circle[data_ball='solid'], circle[data_ball='stripe']");
    let solidCount = 0;
    let stripeCount = 0;
    let firstSunk = false;
    if (solidBallCount + stripeBallCount === 14) {
        firstSunk = true;
    }

    // Loop through each ball and increment the respective count
    allBalls.each(function() {
        const ballType = $(this).attr('data_ball');
        if (ballType === 'solid') {
            solidCount++;
        } else if (ballType === 'stripe') {
            stripeCount++;
        }
    });
    solidBallCount = solidCount;
    stripeBallCount = stripeCount;
    // Adds text to identify which player is what side
    if (solidCount + stripeCount < 14 && firstSunk) {
        if ((solidCount < stripeCount && playerNum === 1) || (solidCount > stripeCount && playerNum === 2)) {
            player1Side = 'Stripes';
            player2Side = 'Solids';
        }
        else {
            player1Side = 'Solids';
            player2Side = 'Stripes';
        }
        $('#player1Side').text(player1Side);
        $('#player2Side').text(player2Side);
    }
}

// Call loadSVGContent() to fetch and insert SVG content
loadSVGContent();