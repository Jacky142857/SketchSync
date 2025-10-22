const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// REST API endpoint to check if room exists
app.get('/api/room/check/:roomKey', (req, res) => {
  const { roomKey } = req.params;
  const exists = rooms.has(roomKey);
  console.log(`[API] Room check for ${roomKey}: ${exists}`);
  res.json({ exists });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// In-memory storage for rooms
const rooms = new Map();

// Room data structure
function createRoom(roomId) {
  return {
    id: roomId,
    users: new Map(), // userId -> user data
    presence: new Map(), // userId -> presence data
    canvasObjects: new Map(), // objectId -> canvas object
    comments: new Map(), // threadId -> thread data
    history: [] // For undo/redo
  };
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  let currentRoom = null;
  let currentUser = null;

  // Join room
  socket.on('join-room', ({ roomId, user }) => {
    currentRoom = roomId;
    currentUser = { ...user, connectionId: socket.id };

    // Create room if doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, createRoom(roomId));
    }

    const room = rooms.get(roomId);
    room.users.set(socket.id, currentUser);
    room.presence.set(socket.id, { cursor: null, message: null });

    // Join socket room
    socket.join(roomId);

    // Send initial state to joining user
    socket.emit('room-state', {
      users: Array.from(room.users.values()),
      presence: Object.fromEntries(room.presence),
      canvasObjects: Object.fromEntries(room.canvasObjects),
      comments: Object.fromEntries(room.comments)
    });

    // Notify others of new user
    socket.to(roomId).emit('user-joined', currentUser);

    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Update presence
  socket.on('update-presence', (presenceData) => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (room) {
      room.presence.set(socket.id, presenceData);
      socket.to(currentRoom).emit('presence-update', {
        userId: socket.id,
        presence: presenceData
      });
    }
  });

  // Sync shape (create/update)
  socket.on('sync-shape', (shapeData) => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (room) {
      const { objectId, ...shape } = shapeData;
      room.canvasObjects.set(objectId, shape);

      console.log(`Shape synced: ${objectId} in room ${currentRoom}`);

      // Add to history for undo/redo
      room.history.push({
        type: 'shape-added',
        objectId,
        shape,
        timestamp: Date.now()
      });

      // Broadcast to ALL clients including sender
      io.to(currentRoom).emit('shape-synced', { objectId, shape });
    }
  });

  // Delete shape
  socket.on('delete-shape', (objectId) => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (room) {
      const shape = room.canvasObjects.get(objectId);
      room.canvasObjects.delete(objectId);

      // Add to history
      room.history.push({
        type: 'shape-deleted',
        objectId,
        shape,
        timestamp: Date.now()
      });

      socket.to(currentRoom).emit('shape-deleted', objectId);
    }
  });

  // Delete all shapes
  socket.on('delete-all-shapes', () => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (room) {
      const previousObjects = new Map(room.canvasObjects);
      room.canvasObjects.clear();

      // Add to history
      room.history.push({
        type: 'all-shapes-deleted',
        shapes: Object.fromEntries(previousObjects),
        timestamp: Date.now()
      });

      socket.to(currentRoom).emit('all-shapes-deleted');
    }
  });

  // Update shape hierarchy
  socket.on('update-shape-hierarchy', (data) => {
    console.log('[Server] Received update-shape-hierarchy event:', data);

    if (!currentRoom) {
      console.log('[Server] No current room!');
      return;
    }

    const { childId, parentId } = data;
    console.log('[Server] childId:', childId, 'parentId:', parentId);

    const room = rooms.get(currentRoom);
    if (room) {
      const childShape = room.canvasObjects.get(childId);
      console.log('[Server] Found childShape:', !!childShape);

      if (childShape) {
        // Update the child's parentId
        childShape.parentId = parentId;
        room.canvasObjects.set(childId, childShape);

        console.log(`[Server] Shape hierarchy updated: ${childId} -> parent: ${parentId}`);

        // Broadcast to ALL clients including sender
        io.to(currentRoom).emit('shape-synced', { objectId: childId, shape: childShape });
      } else {
        console.log('[Server] Child shape not found in room!');
      }
    } else {
      console.log('[Server] Room not found!');
    }
  });

  // Broadcast event (reactions)
  socket.on('broadcast-event', (eventData) => {
    if (!currentRoom) return;

    socket.to(currentRoom).emit('event-received', {
      userId: socket.id,
      event: eventData
    });
  });

  // Undo
  socket.on('undo', () => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (room && room.history.length > 0) {
      const lastAction = room.history.pop();

      // Reverse the action
      if (lastAction.type === 'shape-added') {
        room.canvasObjects.delete(lastAction.objectId);
        io.to(currentRoom).emit('shape-deleted', lastAction.objectId);
      } else if (lastAction.type === 'shape-deleted') {
        room.canvasObjects.set(lastAction.objectId, lastAction.shape);
        io.to(currentRoom).emit('shape-synced', {
          objectId: lastAction.objectId,
          shape: lastAction.shape
        });
      } else if (lastAction.type === 'all-shapes-deleted') {
        const objects = new Map(Object.entries(lastAction.shapes));
        room.canvasObjects = objects;
        io.to(currentRoom).emit('canvas-restored', Object.fromEntries(objects));
      }
    }
  });

  // Create thread
  socket.on('create-thread', (threadData) => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (room) {
      const threadId = threadData.id || `thread-${Date.now()}-${Math.random()}`;
      const thread = {
        id: threadId,
        ...threadData,
        comments: [],
        createdAt: Date.now()
      };

      room.comments.set(threadId, thread);
      io.to(currentRoom).emit('thread-created', thread);
    }
  });

  // Add comment to thread
  socket.on('add-comment', ({ threadId, comment }) => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (room && room.comments.has(threadId)) {
      const thread = room.comments.get(threadId);
      const newComment = {
        id: `comment-${Date.now()}-${Math.random()}`,
        ...comment,
        userId: socket.id,
        createdAt: Date.now()
      };

      thread.comments.push(newComment);
      io.to(currentRoom).emit('comment-added', { threadId, comment: newComment });
    }
  });

  // Update thread metadata
  socket.on('update-thread-metadata', ({ threadId, metadata }) => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (room && room.comments.has(threadId)) {
      const thread = room.comments.get(threadId);
      thread.metadata = { ...thread.metadata, ...metadata };
      io.to(currentRoom).emit('thread-metadata-updated', { threadId, metadata: thread.metadata });
    }
  });

  // Delete comment
  socket.on('delete-comment', ({ threadId, commentId }) => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (room && room.comments.has(threadId)) {
      const thread = room.comments.get(threadId);
      thread.comments = thread.comments.filter(c => c.id !== commentId);
      io.to(currentRoom).emit('comment-deleted', { threadId, commentId });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.users.delete(socket.id);
        room.presence.delete(socket.id);

        // Notify others
        socket.to(currentRoom).emit('user-left', socket.id);

        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(currentRoom);
          console.log(`Room ${currentRoom} deleted (empty)`);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
