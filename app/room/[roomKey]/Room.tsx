"use client";

import { ReactNode, useEffect, useState } from "react";
import { WebSocketProvider, useWebSocket } from "@/lib/useWebSocket";
import Loader from "@/components/Loader";

function RoomContent({ children, roomKey }: { children: ReactNode; roomKey: string }) {
  const { joinRoom, isConnected } = useWebSocket();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isConnected) {
      // Join the room with the provided roomKey
      joinRoom(roomKey, {
        id: `user-${Math.random().toString(36).substr(2, 9)}`,
        name: "User",
        avatar: `https://liveblocks.io/avatars/avatar-${Math.floor(Math.random() * 30)}.png`,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`
      });
      setIsReady(true);
    }
  }, [isConnected, joinRoom, roomKey]);

  if (!isReady) {
    return <Loader />;
  }

  return <>{children}</>;
}

export function Room({ children, roomKey }: { children: ReactNode; roomKey: string }) {
  return (
    <WebSocketProvider serverUrl={process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3001"}>
      <RoomContent roomKey={roomKey}>{children}</RoomContent>
    </WebSocketProvider>
  );
}
