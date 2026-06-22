const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

let queue = [];

function tryMatch() {
  let hirerIdx = queue.findIndex(u => u.role === 'hire');
  let workerIdx = queue.findIndex(u => u.role === 'work');
  let a, b;
  if (hirerIdx !== -1 && workerIdx !== -1) {
    a = queue.splice(hirerIdx, 1)[0];
    workerIdx = queue.findIndex(u => u.role === 'work');
    b = queue.splice(workerIdx, 1)[0];
  } else if (queue.length >= 2) {
    a = queue.splice(0, 1)[0];
    b = queue.splice(0, 1)[0];
  } else { return; }

  const roomId = `room_${a.socketId}_${b.socketId}`;
  io.to(a.socketId).emit('matched', { roomId, peer: { name: b.name, role: b.role, skills: b.skills, budget: b.budget }, initiator: true });
  io.to(b.socketId).emit('matched', { roomId, peer: { name: a.name, role: a.role, skills: a.skills, budget: a.budget }, initiator: false });
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('join-queue', (data) => {
    queue = queue.filter(u => u.socketId !== socket.id);
    queue.push({ socketId: socket.id, ...data });
    console.log(`Queue: ${queue.length} waiting`);
    socket.emit('queue-position', queue.length);
    tryMatch();
  });
  socket.on('signal', ({ roomId, signal }) => { socket.to(roomId).emit('signal', { signal }); });
  socket.on('join-room', (roomId) => { socket.join(roomId); });
  socket.on('chat-msg', ({ roomId, text, name }) => { socket.to(roomId).emit('chat-msg', { text, name }); });
  socket.on('skip', ({ roomId }) => { socket.to(roomId).emit('peer-skipped'); socket.leave(roomId); });
  socket.on('disconnect', () => { queue = queue.filter(u => u.socketId !== socket.id); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ QuickMatch running at http://localhost:${PORT}`));
