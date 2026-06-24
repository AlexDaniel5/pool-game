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
// ---------------------------------------------------------------------------
// Shot input. The cue continuously aims at the cursor (the cue ball will
// travel toward the cursor). A plain click does nothing; to shoot you hold the
// mouse button and drag back toward the ball to wind up power, then release.

const maxLength = 240;   // px of pull-back for a full-power shot
const DEADZONE = 8;      // px below which the shot is cancelled
const MIN_SPEED = 300;   // mm/s, gentlest possible tap
const MAX_SPEED = 10000; // mm/s, full-power shot
const STRIKE_MS = 80;
const CUE_LEN = 220;     // px length of the rendered cue stick
const CUE_GAP = 4;       // px gap between the cue tip and the ball surface

let cueStick = null;     // the cue <div>, created once
let guide = null;        // the aim-guide SVG overlay, created once
let aimReady = false;    // document-level listeners bound?
let charging = false;    // is the button held and winding up power?
let lockedAim = null;    // {dx, dy, downX, downY, pull} captured at mousedown
let animating = false;   // is a shot currently playing back?
let lastMouseX = null;   // last cursor position, for refreshing aim after a shot
let lastMouseY = null;
let placingCue = false;  // ball-in-hand: is the player positioning the cue ball?
let ghostCue = null;     // the draggable cue-ball preview <div>, created once

// Physics-space dimensions of the playing surface (must match phylib.h)
const TABLE_LENGTH = 2700; // mm, the long axis (physics y)
const TABLE_WIDTH = 1350;  // mm, the short axis (physics x)
const BALL_RADIUS = 28.5;  // mm

// Current cue ball center/radius in screen space, or null if it is off the table
function getCueBall() {
    const el = document.querySelector("#poolTable circle[data_ball='cueBall']");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { el: el, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, r: rect.width / 2 };
}

// Build the cue stick and aim guide once, then keep them for the whole game
function ensureAimUI() {
    if (cueStick) return;
    cueStick = $('<div class="cueStick"></div>').appendTo('body');
    guide = buildGuide();
}

// Called on load and after every shot to (re)enable aiming for the new layout
function addEventListeners() {
    ensureAimUI();
    if (!aimReady) {
        $(document)
            .on('mousemove.pool', onAimMove)
            .on('mousedown.pool', onAimDown)
            .on('mouseup.pool', onAimUp);
        aimReady = true;
    }
    animating = false;
    charging = false;
    lockedAim = null;
    refreshAim();
}

// Redraw the aim using the last known cursor position (e.g. after a shot, so the
// player sees the new aim without having to wiggle the mouse first)
function refreshAim() {
    if (lastMouseX === null) return;
    onAimMove({ clientX: lastMouseX, clientY: lastMouseY, _synthetic: true });
}

function onAimMove(event) {
    if (!event._synthetic) {
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    }
    if (isGameOver || animating || placingCue) { hideAim(); return; }
    const cb = getCueBall();
    if (!cb) { hideAim(); return; }

    let dx, dy;
    if (charging && lockedAim) {
        // aim is frozen; the drag only winds up power. "Pull" is how far the
        // cursor has moved back toward the ball, i.e. opposite the shot direction
        dx = lockedAim.dx;
        dy = lockedAim.dy;
        const mvx = event.clientX - lockedAim.downX;
        const mvy = event.clientY - lockedAim.downY;
        const pull = -(mvx * dx + mvy * dy);
        lockedAim.pull = Math.max(0, Math.min(pull, maxLength));
    } else {
        // free aim: the shot points from the cue ball toward the cursor
        dx = event.clientX - cb.cx;
        dy = event.clientY - cb.cy;
        const len = Math.hypot(dx, dy);
        if (len < 1) return;
        dx /= len;
        dy /= len;
    }

    const ctx = buildAimContext(cb.el);
    updateAimGuide(guide, ctx, dx, dy);
    placeCue(cb, dx, dy, charging && lockedAim ? lockedAim.pull : 0);
}

function onAimDown(event) {
    if (event.button !== 0) return;
    if (isGameOver || animating || placingCue) return;
    if ($(event.target).closest('#gameInfo').length) return; // ignore UI clicks
    const cb = getCueBall();
    if (!cb) return;
    let dx = event.clientX - cb.cx;
    let dy = event.clientY - cb.cy;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    dx /= len;
    dy /= len;
    charging = true;
    lockedAim = { dx: dx, dy: dy, downX: event.clientX, downY: event.clientY, pull: 0 };
}

function onAimUp(event) {
    if (!charging) return;
    charging = false;
    const la = lockedAim;
    const pull = la ? la.pull : 0;
    lockedAim = null;
    // Too little pull-back is an accidental click, not a shot: keep the turn so
    // the player can re-aim
    if (!la || pull < DEADZONE) {
        refreshAim();
        return;
    }
    // Power scales linearly with pull distance, with a gentle floor for finesse
    const t = Math.min((pull - DEADZONE) / (maxLength - DEADZONE), 1.0);
    const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * t;
    // Map the screen-space shot direction into physics space (the table is
    // rotated 90deg in CSS, hence the (dy, -dx) swap)
    const velX = la.dy * speed;
    const velY = -la.dx * speed;

    const cb = getCueBall();
    if (cb) strikeCue(cb, la.dx, la.dy);
    else if (cueStick) cueStick.css({ display: 'none' });
    hideGuide();
    animating = true;

    const gameid = $('#game_id').attr('data_id');
    const postData = { velX: velX, velY: velY, gameid: gameid };
    $.post('/shoot', postData, (data, status) => showShot(data, status, STRIKE_MS), 'json');
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
function buildGuide() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'aimGuide');
    function add(tag, cls) {
        const el = document.createElementNS(SVG_NS, tag);
        el.setAttribute('class', cls);
        el.setAttribute('visibility', 'hidden');
        svg.appendChild(el);
        return el;
    }
    const g = {
        svg: svg,
        ring: add('circle', 'aimRing'),
        path: add('polyline', 'aimPath'),
        cueDeflect: add('line', 'aimCueDeflect'),
        ghost: add('circle', 'aimGhost'),
        deflect: add('line', 'aimDeflect'),
    };
    document.body.appendChild(svg);
    return g;
}

// Draw the cue stick behind the ball (opposite the cursor), tip toward the
// shot. `pull` slides it back along the shaft to show the wind-up.
function placeCue(cb, dx, dy, pull) {
    const anchorX = cb.cx - dx * (cb.r + CUE_GAP);
    const anchorY = cb.cy - dy * (cb.r + CUE_GAP);
    const angle = Math.atan2(-dy, -dx); // shaft runs from tip back to the butt
    cueStick.css({
        display: 'block',
        opacity: '',
        transition: 'none',
        width: CUE_LEN + 'px',
        left: anchorX + 'px',
        top: anchorY + 'px',
        transform: `rotate(${angle}rad) translateX(${pull}px)`,
    });
}

// Lunge the cue into the ball, then fade it out
function strikeCue(cb, dx, dy) {
    const angle = Math.atan2(-dy, -dx);
    cueStick.css('transition', `transform ${STRIKE_MS}ms ease-out, opacity ${STRIKE_MS}ms ease-in`);
    requestAnimationFrame(() => {
        cueStick.css({ transform: `rotate(${angle}rad) translateX(${-cb.r}px)`, opacity: '0' });
    });
    setTimeout(() => {
        cueStick.css({ display: 'none', opacity: '', transition: 'none' });
        strikePulse(cb.cx, cb.cy);
    }, STRIKE_MS);
}

function hideGuide() {
    if (!guide) return;
    ['ring', 'path', 'ghost', 'deflect', 'cueDeflect'].forEach(k => guide[k].setAttribute('visibility', 'hidden'));
}

function hideAim() {
    if (cueStick) cueStick.css({ display: 'none' });
    hideGuide();
}

// ---------------------------------------------------------------------------
// Ball-in-hand placement (after a scratch). The incoming player moves the cue
// ball to any open spot on the felt and clicks to drop it; normal aiming is
// suspended (placingCue) until the ball is placed.

let binhBanner = null; // the "ball in hand" hint, created once

// Convert a screen point to physics/SVG coordinates. The table is rotated 90deg
// clockwise in CSS, so the felt's screen height spans physics x (TABLE_WIDTH)
// and its screen width spans physics y (TABLE_LENGTH). This is the position
// analogue of the (dy, -dx) swap the aim code uses for shot direction.
function screenToPhysics(screenX, screenY) {
    const felt = $('#poolTable rect[fill="url(#feltGrad)"]')[0].getBoundingClientRect();
    const s = (felt.bottom - felt.top) / TABLE_WIDTH; // screen px per mm
    return {
        x: (screenY - felt.top) / s,
        y: (felt.right - screenX) / s,
        s: s,
        felt: felt,
    };
}

function enterBallInHand() {
    placingCue = true;
    animating = false;
    charging = false;
    lockedAim = null;
    // hide the cue ball the server auto-respawned at its legacy spot; the
    // preview ghost stands in for it until the player drops it
    $('body').addClass('placingCue');
    hideAim();
    ensureAimUI();
    if (!ghostCue) ghostCue = $('<div class="ghostCue"></div>').appendTo('body');
    if (!binhBanner) binhBanner = $('<div class="binhBanner"></div>').appendTo('body');
    binhBanner.text('Ball in hand — move the mouse and click to place the cue ball')
        .css('display', 'block');
    // ensure the document aim listeners exist (they no-op while placingCue);
    // then add dedicated placement listeners
    if (!aimReady) {
        $(document).on('mousemove.pool', onAimMove).on('mousedown.pool', onAimDown).on('mouseup.pool', onAimUp);
        aimReady = true;
    }
    $(document).on('mousemove.place', onPlaceMove).on('click.place', onPlaceClick);
    updateGhost(lastMouseX, lastMouseY);
}

// Validity + clamped on-felt position for a candidate screen point. Returns the
// physics coords to post, the screen center to draw the ghost at, and whether
// the spot is clear of other balls.
function evalPlacement(screenX, screenY) {
    const cb = getCueBall();           // current cue ball, used only for its size
    const r = cb ? cb.r : 14;          // screen radius
    const p = screenToPhysics(screenX, screenY);
    // clamp so the whole ball stays on the felt
    const px = Math.min(Math.max(p.x, BALL_RADIUS), TABLE_WIDTH - BALL_RADIUS);
    const py = Math.min(Math.max(p.y, BALL_RADIUS), TABLE_LENGTH - BALL_RADIUS);
    // screen center of that clamped spot (forward of screenToPhysics)
    const sx = p.felt.right - py * p.s;
    const sy = p.felt.top + px * p.s;
    // reject if it would overlap another ball (compared in screen space)
    let ok = true;
    $('#poolTable circle[data_num]').each(function() {
        if ($(this).attr('data_ball') === 'cueBall') return;
        const rect = this.getBoundingClientRect();
        const bx = rect.left + rect.width / 2;
        const by = rect.top + rect.height / 2;
        if (Math.hypot(bx - sx, by - sy) < r + rect.width / 2) ok = false;
    });
    return { x: px, y: py, sx: sx, sy: sy, r: r, ok: ok };
}

function updateGhost(screenX, screenY) {
    if (screenX === null || screenY === null || !ghostCue) return null;
    const e = evalPlacement(screenX, screenY);
    ghostCue.css({
        display: 'block',
        left: e.sx + 'px',
        top: e.sy + 'px',
        width: (e.r * 2) + 'px',
        height: (e.r * 2) + 'px',
    }).toggleClass('blocked', !e.ok);
    return e;
}

function onPlaceMove(event) {
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    updateGhost(event.clientX, event.clientY);
}

function onPlaceClick(event) {
    if (event.button !== 0) return;
    if ($(event.target).closest('#gameInfo').length) return; // ignore UI clicks
    const e = updateGhost(event.clientX, event.clientY);
    if (!e || !e.ok) return; // overlapping a ball: keep waiting for a clear spot
    // lock placement: drop the placement listeners and hide the hint, but keep
    // aiming suppressed (placingCue) until the server returns the new table
    $(document).off('.place');
    if (ghostCue) ghostCue.css('display', 'none');
    if (binhBanner) binhBanner.css('display', 'none');
    const gameid = $('#game_id').attr('data_id');
    $.post('/placeCue', { x: e.x, y: e.y, gameid: gameid }, (data) => {
        $('body').removeClass('placingCue');
        displayFrame(data.frame);
        placingCue = false;
        addEventListeners();
    }, 'json');
}

// Cast the cue ball's path from its center along (dirX, dirY), stopping at
// the first object ball or reflecting off cushions (up to MAX_BOUNCES)
function traceShotPath(ctx, dirX, dirY) {
    const MAX_BOUNCES = 2;
    // cap the guide at roughly one table length so it stays short instead of
    // skittering across the whole surface and off several cushions
    let budget = Math.max(ctx.bounds.maxX - ctx.bounds.minX, ctx.bounds.maxY - ctx.bounds.minY);
    // but if a ball sits just past the cap, extend to it so a near-hit still
    // shows the contact (ghost ball + deflection) instead of stopping short
    const BALL_GRACE = ctx.r * 6;
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

        if (tBall <= tWall && tBall <= budget + BALL_GRACE) {
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

// dirX/dirY: the unit screen-space direction the cue ball will travel
function updateAimGuide(guide, ctx, dirX, dirY) {
    if (!guide) return;
    // ring around the cue ball follows it as it moves between shots
    guide.ring.setAttribute('cx', ctx.cx);
    guide.ring.setAttribute('cy', ctx.cy);
    guide.ring.setAttribute('r', ctx.r + 4);
    guide.ring.removeAttribute('visibility');

    const trace = traceShotPath(ctx, dirX, dirY);
    guide.path.setAttribute('points', trace.points.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
    guide.path.removeAttribute('visibility');

    if (trace.hitBall) {
        // ghost ball at the predicted contact position
        guide.ghost.setAttribute('cx', trace.hitX.toFixed(1));
        guide.ghost.setAttribute('cy', trace.hitY.toFixed(1));
        guide.ghost.setAttribute('r', ctx.r);
        guide.ghost.removeAttribute('visibility');
        // n = impact line (ghost center -> object ball center). On contact the
        // object ball leaves along n and the cue ball along the tangent. The
        // momentum split is the cut angle: object ball gets cos(theta), cue ball
        // gets sin(theta), so the two guide lines lengthen/shorten oppositely.
        const b = trace.hitBall;
        let ndx = b.x - trace.hitX;
        let ndy = b.y - trace.hitY;
        const nLen = Math.hypot(ndx, ndy) || 1;
        ndx /= nLen;
        ndy /= nLen;
        const MAX_LINE = 95;
        // object ball departs along n, length ~ cos(theta) (longest on a full hit)
        const cosT = Math.min(1, Math.abs(dirX * ndx + dirY * ndy));
        const objLen = MAX_LINE * cosT;
        guide.deflect.setAttribute('x1', (b.x + ndx * b.r).toFixed(1));
        guide.deflect.setAttribute('y1', (b.y + ndy * b.r).toFixed(1));
        guide.deflect.setAttribute('x2', (b.x + ndx * (b.r + objLen)).toFixed(1));
        guide.deflect.setAttribute('y2', (b.y + ndy * (b.r + objLen)).toFixed(1));
        guide.deflect.removeAttribute('visibility');
        // cue ball carries on along the tangent, length ~ sin(theta) (zero on a
        // full hit, longest on a thin cut)
        const dot = dirX * ndx + dirY * ndy;
        let cdx = dirX - dot * ndx;
        let cdy = dirY - dot * ndy;
        const sinT = Math.hypot(cdx, cdy); // = sin(theta) since dir is a unit vector
        if (sinT > 1e-3) {
            cdx /= sinT;
            cdy /= sinT;
            const CUE_MAX_LINE = 38; // cue ball line is kept much shorter
            const cueLen = CUE_MAX_LINE * Math.min(1, sinT);
            guide.cueDeflect.setAttribute('x1', trace.hitX.toFixed(1));
            guide.cueDeflect.setAttribute('y1', trace.hitY.toFixed(1));
            guide.cueDeflect.setAttribute('x2', (trace.hitX + cdx * cueLen).toFixed(1));
            guide.cueDeflect.setAttribute('y2', (trace.hitY + cdy * cueLen).toFixed(1));
            guide.cueDeflect.removeAttribute('visibility');
        } else {
            guide.cueDeflect.setAttribute('visibility', 'hidden');
        }
    } else {
        guide.ghost.setAttribute('visibility', 'hidden');
        guide.deflect.setAttribute('visibility', 'hidden');
        guide.cueDeflect.setAttribute('visibility', 'hidden');
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
    const frames = data.frames.split("<!---->\n");
    const scratched = data.scratch;
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
        checkNaturalWin(prevSolid, prevStripe, scratched);
        if (!isGameOver && scratched) {
            // A scratch is a foul: the turn always passes, and the incoming
            // player gets ball-in-hand to place the cue ball anywhere.
            switchCurrentP();
            enterBallInHand();
            return;
        }
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
function checkNaturalWin(prevSolid, prevStripe, cueScratched) {
    // If isGameOver is true it means the 8 ball was sunk. Scratching (potting the
    // cue ball) on the 8-ball shot is a loss, so leave the opponent win that
    // check8BallSunk already set instead of awarding it to the current player.
    if (!cueScratched && isGameOver && ((player1Side === 'Solids' && currentPlayer === 1 && solidBallCount === 0 && solidBallCount === prevSolid)
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
