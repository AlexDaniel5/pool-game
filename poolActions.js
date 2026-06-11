// Fetch SVG content from file and insert it into #poolTable
function loadSVGContent() {
    $.get('poolTable.svg', function(data) {
        $('#poolTable').html(data.documentElement);
        addEventListeners();
        updateTurnUI();
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
    const cueBall = $("circle[data_ball='cueBall']");
    const line = $('<div class="cueStick"></div>').appendTo('body');
    const maxLength = 150;
    let startX, startY, velX, velY;
    let aimContext = null;
    let aimGuide = null;

    cueBall.on('mousedown', (event) => {
        const cueBallRect = cueBall[0].getBoundingClientRect();
        const cueBallCenterX = cueBallRect.left + cueBallRect.width / 2;
        const cueBallCenterY = cueBallRect.top + cueBallRect.height / 2;
        startX = cueBallCenterX;
        startY = cueBallCenterY;
        line.css({
            display: 'block',
            width: '0px',
            left: cueBallCenterX + 'px',
            top: cueBallCenterY + 'px',
        });
        aimContext = buildAimContext(cueBall[0]);
        aimGuide = createAimGuide(aimContext);
        $(document).on('mousemove', handleMouseMove);
        $(document).one('mouseup', handleMouseUp);
    });

    function handleMouseMove(event) {
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        const distance = Math.hypot(mouseX - startX, mouseY - startY);
        const limitedDistance = Math.min(distance, maxLength);
        // the cue sits on the drag side of the ball, striking toward the shot:
        // the shot travels from the mouse through the cue ball
        const angle = Math.atan2(mouseY - startY, mouseX - startX);
        line.css({
            width: limitedDistance + 'px',
            transform: `rotate(${angle}rad)`,
        });
        updateAimGuide(aimGuide, aimContext, mouseX, mouseY);
    }

    const STRIKE_MS = 80;

    function handleMouseUp(event) {
        $(document).off('mousemove', handleMouseMove);
        if (aimGuide) {
            aimGuide.svg.remove();
            aimGuide = null;
        }
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        const rawVelX = mouseX - startX;
        const rawVelY = mouseY - startY;
        const scale = 10000;
        const dist = Math.hypot(rawVelX, rawVelY);
        const t = Math.min(dist / maxLength, 1.0);
        const easedT = Math.pow(t, 1.5);
        const factor = dist > 0 ? easedT * scale / dist : 0;
        velX = Math.max(-scale, Math.min(scale, rawVelY * factor));
        velY = Math.max(-scale, Math.min(scale, -rawVelX * factor));

        line.css('transition', `width ${STRIKE_MS}ms ease-out, opacity ${STRIKE_MS}ms ease-in`);
        requestAnimationFrame(() => {
            line.css({ width: '0px', opacity: '0' });
        });
        setTimeout(() => {
            line.remove();
            if (t > 0.05) {
                strikePulse(startX, startY);
            }
        }, STRIKE_MS);

        const gameid = $('#game_id').attr('data_id');
        const postData = {
            velX: -velX,
            velY: -velY,
            gameid: gameid,
        };
        $.post('/shoot', postData, (data, status) => showShot(data, status, STRIKE_MS));
    }
}

// ---------------------------------------------------------------------------
// Aiming guide: trajectory line, cushion bounces, ghost ball and object-ball
// deflection. Purely visual; all math is done in screen space using the
// rendered positions, so the real physics is untouched.

const SVG_NS = 'http://www.w3.org/2000/svg';

// Snapshot of everything the guide needs, captured once per aim (nothing
// moves on the table while aiming)
function buildAimContext(cueEl) {
    const cueRect = cueEl.getBoundingClientRect();
    const r = cueRect.width / 2;
    const balls = [];
    $('#poolTable circle[data_num]').each(function() {
        if ($(this).attr('data_ball') === 'cueBall') return;
        const rect = this.getBoundingClientRect();
        balls.push({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            r: rect.width / 2,
        });
    });
    // playing surface bounds, inset by the ball radius so the line reflects
    // where the ball center actually meets the cushion
    const feltRect = $('#poolTable rect[fill="url(#feltGrad)"]')[0].getBoundingClientRect();
    return {
        cx: cueRect.left + r,
        cy: cueRect.top + cueRect.height / 2,
        r: r,
        balls: balls,
        bounds: {
            minX: feltRect.left + r,
            maxX: feltRect.right - r,
            minY: feltRect.top + r,
            maxY: feltRect.bottom - r,
        },
    };
}

// Full-viewport SVG overlay holding the guide elements
function createAimGuide(ctx) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'aimGuide');
    function add(tag, cls) {
        const el = document.createElementNS(SVG_NS, tag);
        el.setAttribute('class', cls);
        el.setAttribute('visibility', 'hidden');
        svg.appendChild(el);
        return el;
    }
    const guide = {
        svg: svg,
        ring: add('circle', 'aimRing'),
        path: add('polyline', 'aimPath'),
        ghost: add('circle', 'aimGhost'),
        deflect: add('line', 'aimDeflect'),
    };
    guide.ring.setAttribute('cx', ctx.cx);
    guide.ring.setAttribute('cy', ctx.cy);
    guide.ring.setAttribute('r', ctx.r + 4);
    guide.ring.removeAttribute('visibility');
    document.body.appendChild(svg);
    return guide;
}

// Cast the cue ball's path from its center along (dirX, dirY), stopping at
// the first object ball or reflecting off cushions (up to MAX_BOUNCES)
function traceShotPath(ctx, dirX, dirY) {
    const MAX_BOUNCES = 2;
    let budget = 2500;
    let px = ctx.cx;
    let py = ctx.cy;
    const points = [[px + dirX * (ctx.r + 3), py + dirY * (ctx.r + 3)]];
    let hitBall = null;

    for (let i = 0; i <= MAX_BOUNCES; i++) {
        // nearest object ball along the ray (centers touch at r + ball.r)
        let tBall = Infinity, ball = null;
        for (const b of ctx.balls) {
            const mx = b.x - px, my = b.y - py;
            const proj = mx * dirX + my * dirY;
            if (proj <= 0) continue;
            const rr = b.r + ctx.r;
            const disc = proj * proj - (mx * mx + my * my - rr * rr);
            if (disc < 0) continue;
            const t = proj - Math.sqrt(disc);
            if (t > 0.5 && t < tBall) {
                tBall = t;
                ball = b;
            }
        }
        // first cushion along the ray
        let tWall = Infinity, flipX = false, flipY = false;
        if (dirX > 1e-9) { tWall = (ctx.bounds.maxX - px) / dirX; flipX = true; }
        else if (dirX < -1e-9) { tWall = (ctx.bounds.minX - px) / dirX; flipX = true; }
        if (Math.abs(dirY) > 1e-9) {
            const ty = dirY > 0 ? (ctx.bounds.maxY - py) / dirY : (ctx.bounds.minY - py) / dirY;
            if (ty < tWall) { tWall = ty; flipX = false; flipY = true; }
        }
        tWall = Math.max(0, tWall);

        if (tBall <= Math.min(tWall, budget)) {
            px += dirX * tBall;
            py += dirY * tBall;
            points.push([px, py]);
            hitBall = ball;
            break;
        }
        if (!isFinite(tWall) || tWall >= budget) {
            const t = Math.min(budget, tWall);
            points.push([px + dirX * t, py + dirY * t]);
            break;
        }
        px += dirX * tWall;
        py += dirY * tWall;
        points.push([px, py]);
        budget -= tWall;
        if (flipX) dirX = -dirX;
        if (flipY) dirY = -dirY;
    }
    return { points: points, hitBall: hitBall, hitX: px, hitY: py };
}

function updateAimGuide(guide, ctx, mouseX, mouseY) {
    if (!guide) return;
    // the shot travels from the mouse through the cue ball
    let dirX = ctx.cx - mouseX;
    let dirY = ctx.cy - mouseY;
    const dragLen = Math.hypot(dirX, dirY);
    if (dragLen < 3) {
        guide.path.setAttribute('visibility', 'hidden');
        guide.ghost.setAttribute('visibility', 'hidden');
        guide.deflect.setAttribute('visibility', 'hidden');
        return;
    }
    dirX /= dragLen;
    dirY /= dragLen;

    const trace = traceShotPath(ctx, dirX, dirY);
    guide.path.setAttribute('points', trace.points.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
    guide.path.removeAttribute('visibility');

    if (trace.hitBall) {
        // ghost ball at the predicted contact position
        guide.ghost.setAttribute('cx', trace.hitX.toFixed(1));
        guide.ghost.setAttribute('cy', trace.hitY.toFixed(1));
        guide.ghost.setAttribute('r', ctx.r);
        guide.ghost.removeAttribute('visibility');
        // object ball departs along the line from the ghost center through its own
        const b = trace.hitBall;
        let ndx = b.x - trace.hitX;
        let ndy = b.y - trace.hitY;
        const nLen = Math.hypot(ndx, ndy) || 1;
        ndx /= nLen;
        ndy /= nLen;
        const DEFLECT_LEN = 70;
        guide.deflect.setAttribute('x1', (b.x + ndx * b.r).toFixed(1));
        guide.deflect.setAttribute('y1', (b.y + ndy * b.r).toFixed(1));
        guide.deflect.setAttribute('x2', (b.x + ndx * (b.r + DEFLECT_LEN)).toFixed(1));
        guide.deflect.setAttribute('y2', (b.y + ndy * (b.r + DEFLECT_LEN)).toFixed(1));
        guide.deflect.removeAttribute('visibility');
    } else {
        guide.ghost.setAttribute('visibility', 'hidden');
        guide.deflect.setAttribute('visibility', 'hidden');
    }
}

// Small expanding ring shown at the moment the cue strikes the ball
function strikePulse(x, y) {
    const ring = $('<div class="strikePulse"></div>').appendTo('body');
    ring.css({ left: x + 'px', top: y + 'px' });
    setTimeout(() => ring.remove(), 350);
}

// Screen-space centers of every ball currently on the table, keyed by number
function recordBallPositions() {
    const map = {};
    $('#poolTable circle[data_num]').each(function() {
        const rect = this.getBoundingClientRect();
        map[$(this).attr('data_num')] = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
    });
    return map;
}

// A ball that was present last frame but is gone now was pocketed:
// play a small ripple at its last known position
function spawnPocketRipples(prev, curr) {
    for (const num in prev) {
        if (!(num in curr)) {
            const ripple = $('<div class="pocketRipple"></div>').appendTo('body');
            ripple.css({ left: prev[num].x + 'px', top: prev[num].y + 'px' });
            setTimeout(() => ripple.remove(), 500);
        }
    }
}

// The animation
function showShot(data, status, delay = 0) {
    const frames = data.split("<!---->\n");
    const FRAME_MS = 10;
    let prevPositions = recordBallPositions();
    let startTime = null;
    let lastIndex = -1;

    // After the animation finishes, perform several operations
    function finishShot() {
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
            $('#currentTurn').text(winningPlayer + " Won!").addClass('win');
            $('.playerCard').removeClass('active');
        }
    }

    function step(timestamp) {
        if (startTime === null) startTime = timestamp;
        const index = Math.min(Math.floor((timestamp - startTime) / FRAME_MS), frames.length - 1);
        if (index !== lastIndex) {
            displayFrame(frames[index]);
            const positions = recordBallPositions();
            spawnPocketRipples(prevPositions, positions);
            prevPositions = positions;
            lastIndex = index;
        }
        if (index < frames.length - 1) {
            requestAnimationFrame(step);
        } else {
            finishShot();
        }
    }
    setTimeout(() => requestAnimationFrame(step), delay);
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
    updateTurnUI();
}

// Highlight the card of the player whose turn it is
function updateTurnUI() {
    $('#p1Card, #p2Card').removeClass('active');
    if (!isGameOver) {
        $(currentPlayer === 1 ? '#p1Card' : '#p2Card').addClass('active');
    }
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
