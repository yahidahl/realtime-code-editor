import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all (or set to your frontend URL later)
    methods: ["GET", "POST"],
  },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  let currentRoom = null;
  let currentUser = null;

  // Join Room
  socket.on("join", ({ roomId, userName }) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      if (rooms.get(currentRoom)) {
        rooms.get(currentRoom).delete(currentUser);
        io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
      }
    }

    currentRoom = roomId;
    currentUser = userName;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(userName);
    io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));

    console.log(`👤 ${userName} joined room ${roomId}`);
  });

  // Code sync
  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdate", code);
  });

  // Leave Room
  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser) {
      rooms.get(currentRoom)?.delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom) || []));

      socket.leave(currentRoom);
      console.log(`👋 ${currentUser} left room ${currentRoom}`);

      currentRoom = null;
      currentUser = null;
    }
  });

  // Typing indicator
  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  // Language change
  socket.on("languageChange", ({ roomId, language }) => {
    io.to(roomId).emit("languageUpdate", language);
  });

  // Disconnect
  socket.on("disconnect", () => {
    if (currentRoom && currentUser) {
      rooms.get(currentRoom)?.delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom) || []));
      console.log(`❌ ${currentUser} disconnected from ${currentRoom}`);
    }
  });
});

const port = process.env.PORT || 5000;
const __dirname = path.resolve();

console.log("📂 __dirname:", __dirname);
console.log("📂 Serving static from:", path.join(__dirname, "frontend", "dist"));

app.use(express.static(path.join(__dirname, "frontend", "dist")));

app.get("*", (req, res) => {
  console.log("📂 Sending:", path.join(__dirname, "frontend", "dist", "index.html"));
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});
