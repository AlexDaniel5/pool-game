// Fetch SVG content from file and insert it into #poolTable
function loadSVGContent() {
    $.get('poolTable.svg', function(data) {
      $('#poolTable').html(data.documentElement);
    });
}

let endX = 0;
let endY = 0;
// Event listener to track mouse
function addEventListeners() {
    // Identify cue ball by its colour
    var cueBall = $("circle[fill='WHITE']");
    // Event listener for clicking the cue ball
    console.log(cueBall)
    cueBall.on('mousedown', (event) => {
        console.log("MOUSEDOWNNNN")
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
            playerNum = $('#current_turn').attr('data_cp');
            console.log("Shot", gameid, velX, velY, playerNum)
            // Define the data to be sent in the POST request
            postData = {
                velX: -velX,
                velY: -velY,
                gameid: gameid,
                playerNum: playerNum
            };
            // Send POST request
            $.post('/shoot', postData, showShot)
        });
    });
}

function showShot(data, status) {
    var tables = data.split(":,:")
    tables.forEach(function(item, index) {
        setTimeout(function(){
            displayFrame(item)
        }, 10 * (index + 1))
    })
}

function displayFrame(frame){
    $("#poolTable").html(frame);
    addEventListeners();
}

// Call loadSVGContent() to fetch and insert SVG content
loadSVGContent();