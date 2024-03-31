// Fetch SVG content from file and insert it into #poolTable
function loadSVGContent() {
    $.get('poolTable.svg', function(data) {
        $('#poolTable').html(data.documentElement);
        addEventListeners();
    });
}

let solidBallCount = 7
let stripeBallCount = 7
let currentPlayer = parseInt($('#current_turn').attr('data_cp'), 10);
let player1Side = '';
let player2Side = '';
let winningPlayer = '';
let isGameOver = false;
// Event listener for pool table actions
function addEventListeners() {
    const cueBall = $("circle[fill='WHITE']");
    const line = $('<div class="line"></div>').appendTo('body');
    const maxLength = 150;
    let startX, startY, velX, velY;

    cueBall.on('mousedown', (event) => {
        const cueBallRect = cueBall[0].getBoundingClientRect();
        const cueBallCenterX = cueBallRect.left + cueBallRect.width / 2;
        const cueBallCenterY = cueBallRect.top + cueBallRect.height / 2;
        startX = cueBallCenterX;
        startY = cueBallCenterY;
        line.css({
            position: 'absolute',
            background: 'white',
            height: '2px',
            transformOrigin: 'left center',
            left: cueBallCenterX + 'px',
            top: cueBallCenterY + 'px',
        });
        $(document).on('mousemove', handleMouseMove);
        $(document).one('mouseup', handleMouseUp);
    });

    function handleMouseMove(event) {
        const mouseX = event.pageX;
        const mouseY = event.pageY;
        const distance = Math.hypot(mouseX - startX, mouseY - startY);
        const limitedDistance = Math.min(distance, maxLength);
        const angle = Math.atan2(mouseY - startY, mouseX - startX) + Math.PI;
        line.css({
            width: limitedDistance + 'px',
            transform: `rotate(${angle}rad)`,
        });
    }

    function handleMouseUp(event) {
        line.remove();
        $(document).off('mousemove', handleMouseMove);
        const mouseX = event.pageX;
        const mouseY = event.pageY;
        const rawVelX = mouseX - startX;
        const rawVelY = mouseY - startY;
        const scale = 10000;
        velX = Math.max(-scale, Math.min(scale, Math.round(rawVelX / maxLength * scale)));
        velY = Math.max(-scale, Math.min(scale, Math.round(rawVelY / maxLength * scale)));
        const gameid = $('#game_id').attr('data_id');
        const postData = {
            velX: -velX,
            velY: -velY,
            gameid: gameid,
        };
        $.post('/shoot', postData, showShot);
    }
}

// The animation
function showShot(data, status) {
    var tables = data.split("<!---->\n")
    tables.forEach(function(item, index) {
        setTimeout(function(){
            displayFrame(item)
        }, 10 * (index + 1))
    });
    // After the animation finishes, perform several operations
    setTimeout(function() {
        check8BallSunk();
        let prevSolid = solidBallCount;
        let prevStripe = stripeBallCount;
        countBalls();
        checkNaturalWin(prevSolid, prevStripe);
        if (!isGameOver) {
            addEventListeners();
            // To check if the player gets another turn
            if ((player1Side === 'Solids' && currentPlayer === 1 && prevSolid === solidBallCount)
            ||( player1Side === 'Stripes' && currentPlayer === 1 && prevStripe === stripeBallCount)
            || (player2Side === 'Solids' && currentPlayer === 2 && prevSolid === solidBallCount)
            ||( player2Side === 'Stripes' && currentPlayer === 2 && prevStripe === stripeBallCount)
            || (player1Side === '')) {
                switchCurrentP();
            }
        }
        else {
            $('#currentTurn').text(winningPlayer + " Won!");
        }
    }, 10 * tables.length);
}

function displayFrame(frame){
    $("#poolTable").html(frame);
}

// Switch the current player
function switchCurrentP() {
    var currentPlayerText = $('#currentP').text();
    currentPlayer = (currentPlayer === 1) ? 2 : 1;
    var p1Name = $('#p1Name').text();
    var p2Name = $('#p2Name').text();
    var nextPlayerText = currentPlayerText === p1Name ? p2Name : p1Name;
    $('#currentP').text(nextPlayerText);
}

// Check if the 8 ball is present in the SVG
function check8BallSunk() {
    const eightBall = $("circle[data_ball='8ball']");
    if (eightBall.length === 0) {
        if (currentPlayer === 1) {
            winningPlayer = $('#p2Name').text();
        } else {
            winningPlayer = $('#p1Name').text();
        }
        isGameOver = true;
    }
}

// Check if the player won by sinking all their side's balls and getting the 8 ball
function checkNaturalWin(prevSolid, prevStripe) {
    // If isGameOver is true it means the 8 ball was sunk
    if (isGameOver && ((player1Side === 'Solids' && currentPlayer === 1 && solidBallCount === 0 && solidBallCount === prevSolid)
    ||( player1Side === 'Stripes' && currentPlayer === 1 && stripeBallCount === 0 && stripeBallCount === prevStripe)
    || (player2Side === 'Solids' && currentPlayer === 2 && solidBallCount === 0 && solidBallCount === prevSolid)
    ||( player2Side === 'Stripes' && currentPlayer === 2 && stripeBallCount === 0 && stripeBallCount === prevStripe))) {
        if (currentPlayer === 1) {
            winningPlayer = $('#p1Name').text();
        } else {
            winningPlayer = $('#p2Name').text();
        }
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
        if ((solidCount < stripeCount && currentPlayer === 2) || (solidCount > stripeCount && currentPlayer === 1)) {
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

function goBack() {
    window.location.href = 'game_setup.html'; // Redirects to game_setup.html
}
// Call loadSVGContent() to fetch and insert SVG content
loadSVGContent();