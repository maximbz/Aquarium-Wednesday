const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server); // <-- this defines 'io'

// Express routes
app.get('/', (req, res) => {
    res.send('Hello from Express with Socket.IO!');
});

// Socket.IO setup
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Listen using the HTTP server, not app.listen!
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});



const AQUARIUM_WIDTH = 900;
const AQUARIUM_HEIGHT = 600;

// Multiple fish
let fishArray = [];
const numFish = 5;
for (let i = 0; i < numFish; i++) {
    fishArray.push({
        x: Math.random() * AQUARIUM_WIDTH,
        y: Math.random() * (AQUARIUM_HEIGHT - 100) + 50,
        dx: (Math.random() - 0.5) * 4 + 2,
        dy: (Math.random() - 0.5) * 2,
        color: `hsl(${Math.random() * 360},80%,60%)`
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

setInterval(() => {
    // Update fish positions
    for (let fish of fishArray) {
        fish.x += fish.dx;
        fish.y += fish.dy;
        // Bounce off edges
        if (fish.x < 0 || fish.x > AQUARIUM_WIDTH) fish.dx *= -1;
        if (fish.y < 30 || fish.y > AQUARIUM_HEIGHT - 30) fish.dy *= -1;
    }
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

io.on('connection', (socket) => {
    // Send current state to new client
    socket.emit('aquariumState', { fishArray, bubbles });

    // Listen for 'addFish' event from this client
    socket.on('addFish', (data) => {
        // Accept the name as-is (even if it's blank)
        const name = (data && typeof data.name === 'string') ? data.name : "";
        const color = (data && typeof data.color === 'string' && data.color.match(/^#[0-9a-fA-F]{6}$/)) ? data.color : `hsl(${Math.random() * 360},80%,60%)`;
        const newFish = {
            x: Math.random() * 600,
            y: Math.random() * 300 + 50,
            dx: (Math.random() - 0.5) * 4 + 2,
            dy: (Math.random() - 0.5) * 2,
            color,
            name // <-- this can now be blank!
        };
        fishArray.push(newFish);
        io.emit('aquariumState', { fishArray, bubbles });

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



});


