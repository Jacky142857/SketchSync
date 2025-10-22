#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting SketchSync Development Environment${NC}\n"

# Check if server dependencies are installed
if [ ! -d "server/node_modules" ]; then
    echo -e "${BLUE}Installing server dependencies...${NC}"
    cd server && npm install && cd ..
fi

# Check if client dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing client dependencies...${NC}"
    npm install
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${BLUE}Creating .env.local file...${NC}"
    echo "NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3001" > .env.local
fi

echo -e "${GREEN}Starting WebSocket Server and Next.js App...${NC}\n"
echo -e "${BLUE}WebSocket Server: http://localhost:3001${NC}"
echo -e "${BLUE}Next.js App: http://localhost:3000${NC}\n"

# Start both server and client
(cd server && npm run dev) & (npm run dev)
