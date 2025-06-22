const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static('public'));

const AQUARIUM_WIDTH = 900;
const AQUARIUM_HEIGHT = 600;
const FISH_SIZE_MIN = 0.4; // Smallest fish (change as desired)
const FISH_SIZE_MAX = 2.0; // Largest fish (change as desired)

function randomFishSize() {
    return Math.random() * (FISH_SIZE_MAX - FISH_SIZE_MIN) + FISH_SIZE_MIN;
}

function randomHSLColor() {
    return `hsl(${Math.floor(Math.random() * 360)}, ${70 + Math.floor(Math.random() * 20)}%, ${50 + Math.floor(Math.random() * 20)}%)`;
}


// Multiple fish
let fishArray = [];
const numFish = 5;
for (let i = 0; i < numFish; i++) {
    fishArray.push({
        x: Math.random() * AQUARIUM_WIDTH,
        y: Math.random() * (AQUARIUM_HEIGHT - 100) + 50,
        dx: (Math.random() - 0.5) * 4 + 2,
        dy: (Math.random() - 0.5) * 2,
        color: `hsl(${Math.random() * 360},80%,60%)`,
        tailColor: randomHSLColor(),
        finColor: randomHSLColor(),
        size: randomFishSize(),
        tailWigglePhase: Math.random() * Math.PI * 2
    });



}

// Bubbles (background)
let bubbles = [];
const numBubbles = 15;
for (let i = 0; i < numBubbles; i++) {
    bubbles.push({
        x: Math.random() * AQUARIUM_WIDTH,
        y: Math.random() * AQUARIUM_HEIGHT,
        radius: Math.random() * 10 + 5,
        speed: Math.random() * 1 + 0.5
    });
}

// Update and broadcast state regularly
setInterval(() => {
    // Update fish positions
    for (let fish of fishArray) {
        fish.x += fish.dx;
        fish.y += fish.dy;
        // If the fish is not already leaving and hits a wall
        if (!fish.leaving && (fish.x < 0 || fish.x > AQUARIUM_WIDTH)) {
            if (fishArray.length > 3 && Math.random() < 0.05) {
                fish.leaving = true;
                fish.leaveDirection = (fish.x < 0) ? 'left' : 'right';
                // Optionally, ensure it keeps swimming out:
                fish.dx = Math.abs(fish.dx) * (fish.leaveDirection === 'right' ? 1 : -1);
            } else {
                fish.dx *= -1;
            }
        }

        if (fish.y < 30 || fish.y > AQUARIUM_HEIGHT - 30) fish.dy *= -1;
        fish.tailWigglePhase += 0.2; // or whatever speed you like

    }
    fishArray = fishArray.filter(fish => !fish._remove);

    // Update bubbles
    for (let bubble of bubbles) {
        bubble.y -= bubble.speed;
        if (bubble.y < 0) {
            bubble.y = AQUARIUM_HEIGHT;
            bubble.x = Math.random() * AQUARIUM_WIDTH;
            bubble.radius = Math.random() * 10 + 5;
            bubble.speed = Math.random() * 1 + 0.5;
        }
    }
    // Broadcast to all clients
    io.emit('aquariumState', { fishArray, bubbles });
}, 30);

// Socket.IO event handling
io.on('connection', (socket) => {
    console.log('A user connected');
    // Send current state to new client
    socket.emit('aquariumState', { fishArray, bubbles });

    // Listen for 'addFish' event from this client
    socket.on('addFish', (data) => {
        const name = (data && typeof data.name === 'string') ? data.name : "";
        const color = (data && typeof data.color === 'string' && data.color.match(/^#[0-9a-fA-F]{6}$/)) ? data.color : `hsl(${Math.random() * 360},80%,60%)`;
        const newFish = {
            x: Math.random() * 600,
            y: Math.random() * 300 + 50,
            dx: (Math.random() - 0.5) * 4 + 2,
            dy: (Math.random() - 0.5) * 2,
            color,
            name,
            size: randomFishSize(),
            tailColor: randomHSLColor(),
            finColor: randomHSLColor(),
            tailWigglePhase: Math.random() * Math.PI * 2 // <-- add this line
        };

        fishArray.push(newFish);
        io.emit('aquariumState', { fishArray, bubbles });
    });

    // Listen for 'reverseFish' event from this client
    socket.on('reverseFish', (fishIndex) => {
        if (
            typeof fishIndex === 'number' &&
            fishIndex >= 0 &&
            fishIndex < fishArray.length
        ) {
            // Reverse both dx and dy for a fun effect
            fishArray[fishIndex].dx *= -1;
            fishArray[fishIndex].dy *= -1;
            io.emit('aquariumState', { fishArray, bubbles });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
