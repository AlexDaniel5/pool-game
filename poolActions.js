// Fetch SVG content from file and insert it into #poolTable
function loadSVGContent() {
    $.get('poolTable.svg', function(data) {
      $('#poolTable').html(data.documentElement);
      // All events possible on the SVG file
      addEventListeners();
    });
}

let lastX = 0;
let lastY = 0;
const tableStartX = 436;
const tableEndX = 691;
// Event listener to track mouse
function addEventListeners() {
    function trackMouse(event) {
        const svgRect = $('#poolTable')[0].getBoundingClientRect();
        const mouseX = event.clientX - tableStartX;
        const mouseY = event.clientY - svgRect.top;
        if (mouseX >= 0 && mouseX <= (tableEndX - tableStartX) && mouseY >= 0 && mouseY <= svgRect.height) {
            $('#valx').text(`x=${mouseX}`);
            $('#valy').text(`y=${Math.round(mouseY)}`);
            lastX = mouseX;
            lastY = Math.round(mouseY);
        } else {
            if (mouseX < 0) {
                $('#valx').text(`x=0`);
            } else if (mouseX > (tableEndX - tableStartX)) {
                $('#valx').text(`x=${tableEndX - tableStartX}`);
            } else {
                $('#valx').text(`x=${lastX}`);
            }
            $('#valy').text(`y=${lastY}`);
        }
    }
    $('#poolTable').on('mousemove', trackMouse);

    // Identify cue ball by its colour
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
            const endX = cueBallCenterX + limitedDistance * (mouseX - cueBallCenterX) / distance;
            const endY = cueBallCenterY + limitedDistance * (mouseY - cueBallCenterY) / distance;

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
            velX = event.pageX - cueBallCenterX
            velY = event.pageY - cueBallCenterY
            gameid = $('#game_id').attr('data_id');
            playerNum = $('#current_turn').attr('data_cp');
            console.log(gameid, velX, velY, playerNum)
            // Define the data to be sent in the POST request
            postData = {
                velX: velX,
                velY: velY,
                gameid: gameid,
                playerNum: playerNum
            };

            // Send POST request to the specified URL (/shoot.html in this case)
            $.post('/shoot', postData)
                .done(function(data) {
                    // Handle successful response here if needed
                    console.log('POST request successful:');
                })
                .fail(function(error) {
                    // Handle errors if the POST request fails
                    console.error('Error sending POST request:', error);
                });
        });

    });
}

// Call loadSVGContent() to fetch and insert SVG content
loadSVGContent();