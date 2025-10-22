# SketchSync

A real-time collaborative drawing application built with Next.js and custom WebSocket implementation.

## Features

- **Room Key System**: Create or join rooms using unique 6-character keys (similar to Kahoot)
- **Real-time Collaboration**: Multiple users can draw together in real-time within the same room
- **Hierarchical Layers**: Organize objects in a tree structure with parent-child relationships
- **Drag & Drop**: Create parent-child relationships by dragging objects onto each other
- **Live Cursors**: See other users' cursor positions and messages
- **Canvas Synchronization**: All drawing operations sync across connected clients
- **Undo/Redo**: Full history management synchronized across clients
- **Emoji Reactions**: Send emoji reactions that fly across the canvas
- **Shape Tools**: Rectangle, Circle, Triangle, Line, Freeform, Text, and Image upload
- **Active Users**: See who's currently collaborating in your room

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. Install client dependencies:
```bash
npm install
```

2. Install server dependencies:
```bash
cd server
npm install
cd ..
```

3. Set up environment variables (already created):
```bash
# .env.local
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3001
```

### Running the Application

**Option 1: Manual (Two Terminals)**

Terminal 1 - Start WebSocket Server:
```bash
cd server
npm run dev
```

Terminal 2 - Start Next.js App:
```bash
npm run dev
```

**Option 2: Using Concurrently (Coming Soon)**

The WebSocket server will run on [http://localhost:3001](http://localhost:3001)
The Next.js app will run on [http://localhost:3000](http://localhost:3000)

Open [http://localhost:3000](http://localhost:3000) with your browser to start collaborating!

## How to Use

1. **Create a Room**: Click "Create New Room" to generate a unique 6-character room key
2. **Share the Key**: Share the room key with collaborators
3. **Join a Room**: Enter the room key to join an existing collaboration session
4. **Organize Layers**: Drag objects onto other objects in the left sidebar to create hierarchies
5. **Move Groups**: Moving a parent object automatically moves all its children

## Architecture

- **Frontend**: Next.js 14, React, Fabric.js for canvas
- **Backend**: Node.js, Express, Socket.IO for WebSocket
- **Real-time**: Custom WebSocket implementation with Socket.IO
- **Room Management**: REST API for room validation

## Project Structure

```
├── app/                           # Next.js app directory
│   ├── page.tsx                  # Landing page (room entry)
│   ├── room/[roomKey]/          # Dynamic room routes
│   │   ├── page.tsx             # Room page
│   │   └── Room.tsx             # Room provider
│   ├── App.tsx                  # Main canvas app
│   └── layout.tsx               # Root layout
├── components/                   # React components
│   ├── RoomEntry.tsx            # Room creation/join UI
│   ├── LeftSidebar.tsx          # Hierarchical layers panel
│   ├── Navbar.tsx               # Top toolbar
│   └── ...                      # Other components
├── lib/                          # Utilities and hooks
│   ├── useWebSocket.tsx         # Custom WebSocket context
│   ├── canvas.ts                # Canvas operations
│   └── ...                      # Other utilities
├── server/                       # WebSocket server
│   ├── index.js                 # Server with REST API & WebSocket
│   └── package.json             # Server dependencies
├── types/                        # TypeScript types
└── public/                       # Static assets
```

## Technology Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Fabric.js** - Canvas manipulation
- **Socket.IO** - WebSocket communication
- **Tailwind CSS** - Styling
- **Radix UI** - UI components

## Development

### Client Development
```bash
npm run dev
```

### Server Development
```bash
cd server
npm run dev
```

## Deployment

### Client (Vercel)
The Next.js app can be deployed to Vercel with environment variables configured.

### Server
Deploy the WebSocket server to any Node.js hosting platform (Railway, Render, DigitalOcean, etc.)

**Important**: Update `NEXT_PUBLIC_WEBSOCKET_URL` to point to your production WebSocket server URL.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is open source and available under the MIT License.
