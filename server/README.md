# SketchSync WebSocket Server

This is the WebSocket server for SketchSync real-time collaboration features.

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Configuration

The server runs on port 3001 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

The server accepts connections from `http://localhost:3000` by default. Update the `CLIENT_URL` environment variable to change this:

```bash
CLIENT_URL=http://localhost:3000 npm start
```

## Features

- Real-time presence (cursor positions, user messages)
- Canvas object synchronization
- Undo/redo support
- Custom events (reactions)
- Comments and threads (basic implementation)
- Automatic room cleanup when empty

## API

The server uses Socket.IO with the following events:

### Client -> Server
- `join-room`: Join a collaboration room
- `update-presence`: Update user presence (cursor, message)
- `sync-shape`: Sync a canvas object
- `delete-shape`: Delete a canvas object
- `delete-all-shapes`: Clear all canvas objects
- `broadcast-event`: Broadcast custom event (reactions)
- `undo`: Undo last action
- `create-thread`: Create comment thread
- `add-comment`: Add comment to thread
- `update-thread-metadata`: Update thread metadata
- `delete-comment`: Delete comment

### Server -> Client
- `room-state`: Initial room state on join
- `presence-update`: User presence updated
- `shape-synced`: Canvas object synced
- `shape-deleted`: Canvas object deleted
- `all-shapes-deleted`: All objects cleared
- `canvas-restored`: Canvas restored (undo)
- `event-received`: Custom event received
- `user-joined`: New user joined
- `user-left`: User disconnected
- `thread-created`: Comment thread created
- `comment-added`: Comment added
- `thread-metadata-updated`: Thread metadata updated
- `comment-deleted`: Comment deleted
