<!DOCTYPE html>
<html>
<head>
    <title>Aquarium Wednesday</title>
    <style>
        body {
            background: #b3e0ff;
        }

        canvas {
            background: #66ccff;
            display: block;
            margin: 0 auto;
        }
    </style>
</head>
<body>
    <div id="fishControls" style="text-align:center; margin-top: 16px;">
        <input id="fishNameInput" type="text" placeholder="Fish name" maxlength="16">
        <input id="fishColorInput" type="color" value="#ff9900">
        <button id="addFishBtn">Add My Fish</button>
        <select id="fishEyeInput">
            <option value="round">Normal</option>
            <option value="bored">Tired</option>
            <option value="happy">Content</option>
        </select>

    </div>

    <canvas id="aquarium" width="900" height="600"></canvas>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const canvas = document.getElementById('aquarium');
        const ctx = canvas.getContext('2d');
        const socket = io();
        console.log('Socket.IO client loaded:', socket);

        let animationStart = Date.now();


        function getRandomColor() {
            // Returns a random hex color string
            return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        }
        document.getElementById('fishColorInput').value = getRandomColor();

        // Simple deterministic pseudo-random number generator
        function seededRandom(seed) {
            let value = seed % 2147483647;
            return function () {
                value = (value * 48271) % 2147483647;
                return (value - 1) / 2147483646; // Returns float between 0 and 1
            };
        }


        let fishArray = [];
        let fishEyeStates = {};

        let bubbles = [];

        function drawSand() {
            ctx.fillStyle = "#f7d488";
            ctx.beginPath();
            ctx.moveTo(0, canvas.height - 30);
            ctx.quadraticCurveTo(canvas.width * 0.25, canvas.height - 10, canvas.width * 0.5, canvas.height - 20);
            ctx.quadraticCurveTo(canvas.width * 0.75, canvas.height - 30, canvas.width, canvas.height - 10);
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();
            ctx.fill();
        }

        function drawSeaweed() {
            const seaweedCount = 7;
            const margin = 40;
            const minDist = 30;
            const rand = seededRandom(12345);
            let seaweedSpecs = [];

            // Generate random, deterministic seaweed properties
            while (seaweedSpecs.length < seaweedCount) {
                let x = margin + rand() * (canvas.width - 2 * margin);
                let height = 55 + rand() * 30; // 55-85 px tall
                let width = 3 + rand() * 4;    // 3-7 px wide
                // Ensure minimum distance between tufts
                if (seaweedSpecs.every(sw => Math.abs(sw.x - x) > minDist)) {
                    seaweedSpecs.push({ x, height, width });
                }
            }
            seaweedSpecs.sort((a, b) => a.x - b.x);

            let elapsed = (Date.now() - animationStart) / 1000;

            for (let i = 0; i < seaweedCount; i++) {
                let spec = seaweedSpecs[i];
                let baseX = spec.x;
                let baseY = canvas.height - 8; // Planted in the sand!
                let height = spec.height + Math.sin(elapsed / 0.9 + i) * 10; // Animate sway
                let lineWidth = spec.width;

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);

                for (let seg = 0; seg < 3; seg++) {
                    let segY = baseY - (height * (seg + 1) / 3);
                    let sway = Math.sin(elapsed + i + seg) * 8 * (1 - seg / 3);
                    ctx.quadraticCurveTo(
                        baseX + sway,
                        baseY - height * (seg + 0.5) / 3,
                        baseX,
                        segY
                    );
                }

                ctx.strokeStyle = "#228B22";
                ctx.lineWidth = lineWidth;
                ctx.shadowColor = "#145214";
                ctx.shadowBlur = 5;
                ctx.stroke();
                ctx.restore();
            }
        }

        function updateFishEyes(dt) {
            fishArray.forEach((fish, i) => {
                let state = fishEyeStates[i];
                if (!state) return;
                // Blinking logic
                state.blinkTimer -= dt;
                if (state.blinkTimer <= 0) {
                    state.blink = true;
                    state.blinkTimer = 0.15; // blink duration
                    if (!state.wasBlinking) {
                        state.wasBlinking = true;
                        state.nextBlink = Math.random() * 4 + 2;
                    }
                } else if (state.blink && state.blinkTimer <= 0) {
                    state.blink = false;
                    state.blinkTimer = state.nextBlink || (Math.random() * 4 + 2);
                    state.wasBlinking = false;
                }

                // Pupil wandering logic
                state.pupilTimer -= dt;
                if (state.pupilTimer <= 0) {
                    state.pupilTargetAngle = Math.random() * Math.PI * 2;
                    state.pupilTimer = Math.random() * 2 + 1;
                }
                // Smoothly move pupilAngle toward pupilTargetAngle
                let diff = state.pupilTargetAngle - state.pupilAngle;
                state.pupilAngle += diff * 0.1;
            });
        }

        function drawFish(fish) {
            const scale = fish.size || 1;
            ctx.save();
            ctx.translate(fish.x, fish.y);

            let flip = (fish.dx < 0) ? -1 : 1;
            ctx.scale(flip * scale, scale);

            // Draw the body
            ctx.beginPath();
            ctx.ellipse(0, 0, 30, 15, 0, 0, Math.PI * 2);
            ctx.fillStyle = fish.color;
            ctx.fill();

            // Draw single wiggling side fin
            const finOffsetX = -4; // negative = back
            const finOffsetY = 4;  // positive = down

            let finWiggle = Math.sin((fish.tailWigglePhase || 0) + 1.0) * 4;

            ctx.beginPath();
            ctx.moveTo(8 + finOffsetX, 0 + finOffsetY);
            ctx.quadraticCurveTo(
                16 + finOffsetX, -6 + finWiggle + finOffsetY,
                20 + finOffsetX, 0 + finOffsetY
            );
            ctx.quadraticCurveTo(
                16 + finOffsetX, 6 + finWiggle + finOffsetY,
                8 + finOffsetX, 0 + finOffsetY
            );
            ctx.closePath();
            ctx.fillStyle = fish.finColor || "#ffe066"; // fallback if missing
            ctx.globalAlpha = 0.7;
            ctx.fill();
            ctx.globalAlpha = 1.0;


            // Draw the tail with wiggle
            let tailWiggle = Math.sin(fish.tailWigglePhase || 0) * 10;
            ctx.beginPath();
            ctx.moveTo(-30, 0);
            ctx.lineTo(-45, -10 + tailWiggle);
            ctx.lineTo(-45, 10 + tailWiggle);
            ctx.closePath();
            ctx.fillStyle = fish.tailColor || "#d94f00";
            ctx.fill();

            // Draw eyes
            let eyeType = fish.eyes || "round";
            let state = fishEyeStates[fishArray.indexOf(fish)] || {};
            let blink = state.blink;
            let pupilAngle = state.pupilAngle || 0;

            // Eye position
            let eyeX = 10, eyeY = -5, eyeSpacing = 10, eyeRadius = 6, pupilRadius = 2;
            for (let e = -1; e <= 1; e += 2) { // two eyes
                ctx.save();
                ctx.translate(eyeX, eyeY * e);

                // Eyeball
                ctx.beginPath();
                ctx.ellipse(0, 0, eyeRadius, eyeRadius * (blink ? 0.2 : 1), 0, 0, Math.PI * 2);
                ctx.fillStyle = "#fff";
                ctx.fill();

                // Eyelids for half-lidded
                if (!blink && (eyeType === "bored" || eyeType === "happy")) {
                    ctx.save();
                    ctx.beginPath();
                    if (eyeType === "bored") {
                        ctx.ellipse(0, -eyeRadius * 0.4, eyeRadius, eyeRadius * 0.5, 0, 0, Math.PI, true);
                        ctx.lineTo(-eyeRadius, 0);
                    } else if (eyeType === "happy") {
                        ctx.ellipse(0, -eyeRadius * 0.1, eyeRadius, eyeRadius * 0.5, 0, 0, Math.PI, false);
                        ctx.lineTo(-eyeRadius, 0);
                    }
                    ctx.closePath();
                    ctx.fillStyle = "#ffe066";
                    ctx.globalAlpha = 0.8;
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                    ctx.restore();
                }

                // Pupil movement
                let pupilDist = blink ? 0 : eyeRadius * 0.5;
                let px = Math.cos(pupilAngle) * pupilDist;
                let py = Math.sin(pupilAngle) * pupilDist * (blink ? 0.2 : 1);

                // Pupil
                ctx.beginPath();
                ctx.arc(px, py, pupilRadius, 0, Math.PI * 2);
                ctx.fillStyle = "#222";
                ctx.fill();

                ctx.restore();
            }


            ctx.restore();

            // Draw name if present
            if (fish.name && fish.name.trim().length > 0) {
                ctx.font = `${14 * scale}px Arial`;
                ctx.fillStyle = "#222";
                ctx.textAlign = "center";
                ctx.fillText(fish.name, fish.x, fish.y - 25 * scale);
            }
        }


        function drawBubble(bubble) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.restore();
        }

        function drawCrab(crab) {
            if (!crab) return;
            ctx.save();
            ctx.translate(crab.x, crab.y);

            // Body
            ctx.beginPath();
            ctx.arc(0, 0, 12, Math.PI, 2 * Math.PI);
            ctx.fillStyle = "#d2691e";
            ctx.fill();

            // Animated Legs (3 per side)
            ctx.strokeStyle = "#a0522d";
            ctx.lineWidth = 2;
            const legLength = 12;

            for (let i = -1; i <= 1; i++) {
                let phase = (crab.stepPhase || 0) + i * 0.6;
                let raw = Math.sin(phase);
                let quantized = Math.sign(raw);
                let wiggle = quantized * 0.25;

                let baseAngle = Math.PI / 3 + i * 0.2;
                let angleLeft = baseAngle - wiggle;
                let angleRight = Math.PI - baseAngle + wiggle;

                // Left leg
                ctx.beginPath();
                ctx.moveTo(-8, 4 + i * 3);
                ctx.lineTo(
                    -8 + legLength * Math.cos(angleLeft),
                    4 + i * 3 + legLength * Math.sin(angleLeft)
                );
                ctx.stroke();

                // Right leg
                ctx.beginPath();
                ctx.moveTo(8, 4 + i * 3);
                ctx.lineTo(
                    8 + legLength * Math.cos(angleRight),
                    4 + i * 3 + legLength * Math.sin(angleRight)
                );
                ctx.stroke();
            }

            // Claws (arms with pincers)
            function drawClaw(side) {
                // side: -1 for left, 1 for right
                var baseX = 13 * side;  // position to the left/right of body
                var baseY = -5;         // a little above crab center
                var clawWidth = 8;      // smaller width
                var clawHeight = 6;     // smaller height
                var clawAngle = side * Math.PI / 4; // rotate outward 45 degrees

                ctx.save();
                ctx.translate(baseX, baseY);
                ctx.rotate(clawAngle);

                // Draw a Pac-Man style claw (ellipse with a wedge missing)
                ctx.beginPath();
                var startAngle = -Math.PI / 4;
                var endAngle = 2 * Math.PI - Math.PI / 4;
                var mouthOpen = Math.PI / 3; // size of the "mouth" wedge

                ctx.ellipse(
                    0, 0,
                    clawWidth, clawHeight,
                    0,
                    startAngle + mouthOpen / 2,
                    endAngle - mouthOpen / 2,
                    false
                );
                ctx.lineTo(0, 0); // close the mouth
                ctx.closePath();

                ctx.fillStyle = "#d2691e";
                ctx.strokeStyle = "#a0522d";
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();

                ctx.restore();
            }



            drawClaw(-1); // left
            drawClaw(1);  // right

            // Eyes
            ctx.beginPath();
            ctx.arc(-4, -10, 2, 0, 2 * Math.PI);
            ctx.arc(4, -10, 2, 0, 2 * Math.PI);
            ctx.fillStyle = "#fff";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-4, -10, 1, 0, 2 * Math.PI);
            ctx.arc(4, -10, 1, 0, 2 * Math.PI);
            ctx.fillStyle = "#222";
            ctx.fill();

            ctx.restore();
        }



        let lastTime = Date.now();
        function draw() {
            let now = Date.now();
            let dt = (now - lastTime) / 1000;
            lastTime = now;

            updateFishEyes(dt);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawSeaweed();
            drawSand();
            drawCrab(crab);

            for (let bubble of bubbles) drawBubble(bubble);
            for (let fish of fishArray) drawFish(fish);
            requestAnimationFrame(draw);
        }



        let crab = null;
        socket.on('aquariumState', (state) => {
            fishArray = state.fishArray;
            bubbles = state.bubbles;
            crab = state.crab || null;
            // Initialize eye states for new fish
            fishArray.forEach((fish, i) => {
                if (!fishEyeStates[i]) {
                    fishEyeStates[i] = {
                        blink: false,
                        blinkTimer: Math.random() * 4 + 2, // seconds until next blink
                        pupilAngle: Math.random() * Math.PI * 2,
                        pupilTargetAngle: Math.random() * Math.PI * 2,
                        pupilTimer: Math.random() * 2 + 1
                    };
                }
            });
        });



        document.getElementById('addFishBtn').onclick = function () {
            const nameInput = document.getElementById('fishNameInput');
            const colorInput = document.getElementById('fishColorInput');
            const eyeInput = document.getElementById('fishEyeInput');
            const name = nameInput.value.trim();
            const color = colorInput.value || "#ff9900";
            const eyes = eyeInput.value || "round";
            socket.emit('addFish', { name, color, eyes });

            colorInput.value = getRandomColor();
            nameInput.value = '';
        };



        draw();


        canvas.addEventListener('click', function (event) {
            // Get mouse position relative to the canvas
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // Find the first fish under the mouse
            for (let i = 0; i < fishArray.length; i++) {
                const fish = fishArray[i];
                // Fish hitbox: ellipse of rx=30, ry=15
                const dx = mouseX - fish.x;
                const dy = mouseY - fish.y;
                if ((dx * dx) / (30 * 30) + (dy * dy) / (15 * 15) <= 1) {
                    // Found a fish! Tell the server to reverse its direction
                    socket.emit('reverseFish', i);
                    break;
                }
            }
        });
    </script>
</body>
</html>
