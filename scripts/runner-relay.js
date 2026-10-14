// Local development relay for the runner game's multiplayer. Forwards every message to all
// other connected browsers, so different browsers (or a phone on the same Wi-Fi) can play
// together on localhost without the internet. Not used in production.
//
//   npm run relay

const { WebSocketServer } = require('ws');

const PORT = Number(process.env.RUNNER_RELAY_PORT) || 8787;
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (socket) => {
  socket.on('message', (data) => {
    for (const client of wss.clients) {
      if (client !== socket && client.readyState === client.OPEN) client.send(data.toString());
    }
  });
});

console.log(`Runner relay listening on ws://localhost:${PORT}`);
