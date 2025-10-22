"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

// Types
export type Presence = {
  cursor: { x: number; y: number } | null;
  message: string | null;
};

export type User = {
  id: string;
  connectionId: string;
  name: string;
  avatar: string;
  color?: string;
};

export type CanvasObject = {
  [key: string]: any;
};

export type Thread = {
  id: string;
  metadata: {
    x: number;
    y: number;
    resolved: boolean;
    zIndex: number;
  };
  comments: Comment[];
  createdAt: number;
};

export type Comment = {
  id: string;
  userId: string;
  body: string;
  createdAt: number;
};

export type ReactionEvent = {
  x: number;
  y: number;
  value: string;
};

type RoomState = {
  users: User[];
  presence: Record<string, Presence>;
  canvasObjects: Record<string, CanvasObject>;
  comments: Record<string, Thread>;
};

// Context types
type WebSocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
  roomState: RoomState;
  joinRoom: (roomId: string, user: Omit<User, 'connectionId'>) => void;
  updatePresence: (presence: Partial<Presence>) => void;
  syncShape: (objectId: string, shape: CanvasObject) => void;
  deleteShape: (objectId: string) => void;
  deleteAllShapes: () => void;
  updateShapeHierarchy: (childId: string, parentId: string) => void;
  broadcastEvent: (event: ReactionEvent) => void;
  createThread: (thread: Omit<Thread, 'id' | 'comments' | 'createdAt'>) => void;
  addComment: (threadId: string, comment: Omit<Comment, 'id' | 'userId' | 'createdAt'>) => void;
  updateThreadMetadata: (threadId: string, metadata: Partial<Thread['metadata']>) => void;
  deleteComment: (threadId: string, commentId: string) => void;
  undo: () => void;
  // Event listeners
  onPresenceUpdate: (callback: (userId: string, presence: Presence) => void) => void;
  onShapeSynced: (callback: (objectId: string, shape: CanvasObject) => void) => void;
  onShapeDeleted: (callback: (objectId: string) => void) => void;
  onAllShapesDeleted: (callback: () => void) => void;
  onEventReceived: (callback: (userId: string, event: ReactionEvent) => void) => void;
  onUserJoined: (callback: (user: User) => void) => void;
  onUserLeft: (callback: (userId: string) => void) => void;
  onThreadCreated: (callback: (thread: Thread) => void) => void;
  onCommentAdded: (callback: (threadId: string, comment: Comment) => void) => void;
  onThreadMetadataUpdated: (callback: (threadId: string, metadata: Thread['metadata']) => void) => void;
  onCommentDeleted: (callback: (threadId: string, commentId: string) => void) => void;
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider: React.FC<{
  children: React.ReactNode;
  serverUrl?: string;
}> = ({ children, serverUrl = 'http://localhost:3001' }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomState>({
    users: [],
    presence: {},
    canvasObjects: {},
    comments: {}
  });

  const eventCallbacksRef = useRef<{
    presenceUpdate: ((userId: string, presence: Presence) => void)[];
    shapeSynced: ((objectId: string, shape: CanvasObject) => void)[];
    shapeDeleted: ((objectId: string) => void)[];
    allShapesDeleted: (() => void)[];
    eventReceived: ((userId: string, event: ReactionEvent) => void)[];
    userJoined: ((user: User) => void)[];
    userLeft: ((userId: string) => void)[];
    threadCreated: ((thread: Thread) => void)[];
    commentAdded: ((threadId: string, comment: Comment) => void)[];
    threadMetadataUpdated: ((threadId: string, metadata: Thread['metadata']) => void)[];
    commentDeleted: ((threadId: string, commentId: string) => void)[];
  }>({
    presenceUpdate: [],
    shapeSynced: [],
    shapeDeleted: [],
    allShapesDeleted: [],
    eventReceived: [],
    userJoined: [],
    userLeft: [],
    threadCreated: [],
    commentAdded: [],
    threadMetadataUpdated: [],
    commentDeleted: []
  });

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(serverUrl);

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
    });

    // Room state
    newSocket.on('room-state', (state: RoomState) => {
      setRoomState(state);
    });

    // Presence updates
    newSocket.on('presence-update', ({ userId, presence }: { userId: string; presence: Presence }) => {
      setRoomState(prev => ({
        ...prev,
        presence: { ...prev.presence, [userId]: presence }
      }));
      eventCallbacksRef.current.presenceUpdate.forEach(cb => cb(userId, presence));
    });

    // Shape synced
    newSocket.on('shape-synced', ({ objectId, shape }: { objectId: string; shape: CanvasObject }) => {
      setRoomState(prev => ({
        ...prev,
        canvasObjects: { ...prev.canvasObjects, [objectId]: shape }
      }));
      eventCallbacksRef.current.shapeSynced.forEach(cb => cb(objectId, shape));
    });

    // Shape deleted
    newSocket.on('shape-deleted', (objectId: string) => {
      setRoomState(prev => {
        const newObjects = { ...prev.canvasObjects };
        delete newObjects[objectId];
        return { ...prev, canvasObjects: newObjects };
      });
      eventCallbacksRef.current.shapeDeleted.forEach(cb => cb(objectId));
    });

    // All shapes deleted
    newSocket.on('all-shapes-deleted', () => {
      setRoomState(prev => ({ ...prev, canvasObjects: {} }));
      eventCallbacksRef.current.allShapesDeleted.forEach(cb => cb());
    });

    // Canvas restored (for undo)
    newSocket.on('canvas-restored', (objects: Record<string, CanvasObject>) => {
      setRoomState(prev => ({ ...prev, canvasObjects: objects }));
      // Trigger re-render
      eventCallbacksRef.current.shapeSynced.forEach(cb => {
        Object.entries(objects).forEach(([objectId, shape]) => cb(objectId, shape));
      });
    });

    // Events (reactions)
    newSocket.on('event-received', ({ userId, event }: { userId: string; event: ReactionEvent }) => {
      eventCallbacksRef.current.eventReceived.forEach(cb => cb(userId, event));
    });

    // User joined
    newSocket.on('user-joined', (user: User) => {
      setRoomState(prev => ({
        ...prev,
        users: [...prev.users, user],
        presence: { ...prev.presence, [user.connectionId]: { cursor: null, message: null } }
      }));
      eventCallbacksRef.current.userJoined.forEach(cb => cb(user));
    });

    // User left
    newSocket.on('user-left', (userId: string) => {
      setRoomState(prev => {
        const newPresence = { ...prev.presence };
        delete newPresence[userId];
        return {
          ...prev,
          users: prev.users.filter(u => u.connectionId !== userId),
          presence: newPresence
        };
      });
      eventCallbacksRef.current.userLeft.forEach(cb => cb(userId));
    });

    // Thread created
    newSocket.on('thread-created', (thread: Thread) => {
      setRoomState(prev => ({
        ...prev,
        comments: { ...prev.comments, [thread.id]: thread }
      }));
      eventCallbacksRef.current.threadCreated.forEach(cb => cb(thread));
    });

    // Comment added
    newSocket.on('comment-added', ({ threadId, comment }: { threadId: string; comment: Comment }) => {
      setRoomState(prev => {
        const thread = prev.comments[threadId];
        if (!thread) return prev;
        return {
          ...prev,
          comments: {
            ...prev.comments,
            [threadId]: {
              ...thread,
              comments: [...thread.comments, comment]
            }
          }
        };
      });
      eventCallbacksRef.current.commentAdded.forEach(cb => cb(threadId, comment));
    });

    // Thread metadata updated
    newSocket.on('thread-metadata-updated', ({ threadId, metadata }: { threadId: string; metadata: Thread['metadata'] }) => {
      setRoomState(prev => {
        const thread = prev.comments[threadId];
        if (!thread) return prev;
        return {
          ...prev,
          comments: {
            ...prev.comments,
            [threadId]: { ...thread, metadata }
          }
        };
      });
      eventCallbacksRef.current.threadMetadataUpdated.forEach(cb => cb(threadId, metadata));
    });

    // Comment deleted
    newSocket.on('comment-deleted', ({ threadId, commentId }: { threadId: string; commentId: string }) => {
      setRoomState(prev => {
        const thread = prev.comments[threadId];
        if (!thread) return prev;
        return {
          ...prev,
          comments: {
            ...prev.comments,
            [threadId]: {
              ...thread,
              comments: thread.comments.filter(c => c.id !== commentId)
            }
          }
        };
      });
      eventCallbacksRef.current.commentDeleted.forEach(cb => cb(threadId, commentId));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [serverUrl]);

  const joinRoom = useCallback((roomId: string, user: Omit<User, 'connectionId'>) => {
    if (socket) {
      socket.emit('join-room', { roomId, user });
    }
  }, [socket]);

  const updatePresence = useCallback((presence: Partial<Presence>) => {
    if (socket) {
      socket.emit('update-presence', presence);
    }
  }, [socket]);

  const syncShape = useCallback((objectId: string, shape: CanvasObject) => {
    if (socket) {
      // NO optimistic update - only update from server response
      // This prevents the canvas from re-rendering while you're dragging
      socket.emit('sync-shape', { objectId, ...shape });
    }
  }, [socket]);

  const deleteShape = useCallback((objectId: string) => {
    if (socket) {
      // Optimistic update
      setRoomState(prev => {
        const newObjects = { ...prev.canvasObjects };
        delete newObjects[objectId];
        return { ...prev, canvasObjects: newObjects };
      });

      socket.emit('delete-shape', objectId);
    }
  }, [socket]);

  const deleteAllShapes = useCallback(() => {
    if (socket) {
      // Optimistic update
      setRoomState(prev => ({ ...prev, canvasObjects: {} }));

      socket.emit('delete-all-shapes');
    }
  }, [socket]);

  const updateShapeHierarchy = useCallback((childId: string, parentId: string) => {
    console.log('[useWebSocket] updateShapeHierarchy called:', { childId, parentId });
    console.log('[useWebSocket] socket exists?', !!socket);
    if (socket) {
      console.log('[useWebSocket] Emitting update-shape-hierarchy event');
      socket.emit('update-shape-hierarchy', { childId, parentId });
    }
  }, [socket]);

  const broadcastEvent = useCallback((event: ReactionEvent) => {
    if (socket) {
      socket.emit('broadcast-event', event);
    }
  }, [socket]);

  const createThread = useCallback((thread: Omit<Thread, 'id' | 'comments' | 'createdAt'>) => {
    if (socket) {
      socket.emit('create-thread', thread);
    }
  }, [socket]);

  const addComment = useCallback((threadId: string, comment: Omit<Comment, 'id' | 'userId' | 'createdAt'>) => {
    if (socket) {
      socket.emit('add-comment', { threadId, comment });
    }
  }, [socket]);

  const updateThreadMetadata = useCallback((threadId: string, metadata: Partial<Thread['metadata']>) => {
    if (socket) {
      socket.emit('update-thread-metadata', { threadId, metadata });
    }
  }, [socket]);

  const deleteComment = useCallback((threadId: string, commentId: string) => {
    if (socket) {
      socket.emit('delete-comment', { threadId, commentId });
    }
  }, [socket]);

  const undo = useCallback(() => {
    if (socket) {
      socket.emit('undo');
    }
  }, [socket]);

  // Event listener registration
  const onPresenceUpdate = useCallback((callback: (userId: string, presence: Presence) => void) => {
    eventCallbacksRef.current.presenceUpdate.push(callback);
  }, []);

  const onShapeSynced = useCallback((callback: (objectId: string, shape: CanvasObject) => void) => {
    eventCallbacksRef.current.shapeSynced.push(callback);
  }, []);

  const onShapeDeleted = useCallback((callback: (objectId: string) => void) => {
    eventCallbacksRef.current.shapeDeleted.push(callback);
  }, []);

  const onAllShapesDeleted = useCallback((callback: () => void) => {
    eventCallbacksRef.current.allShapesDeleted.push(callback);
  }, []);

  const onEventReceived = useCallback((callback: (userId: string, event: ReactionEvent) => void) => {
    eventCallbacksRef.current.eventReceived.push(callback);
  }, []);

  const onUserJoined = useCallback((callback: (user: User) => void) => {
    eventCallbacksRef.current.userJoined.push(callback);
  }, []);

  const onUserLeft = useCallback((callback: (userId: string) => void) => {
    eventCallbacksRef.current.userLeft.push(callback);
  }, []);

  const onThreadCreated = useCallback((callback: (thread: Thread) => void) => {
    eventCallbacksRef.current.threadCreated.push(callback);
  }, []);

  const onCommentAdded = useCallback((callback: (threadId: string, comment: Comment) => void) => {
    eventCallbacksRef.current.commentAdded.push(callback);
  }, []);

  const onThreadMetadataUpdated = useCallback((callback: (threadId: string, metadata: Thread['metadata']) => void) => {
    eventCallbacksRef.current.threadMetadataUpdated.push(callback);
  }, []);

  const onCommentDeleted = useCallback((callback: (threadId: string, commentId: string) => void) => {
    eventCallbacksRef.current.commentDeleted.push(callback);
  }, []);

  const value: WebSocketContextType = {
    socket,
    isConnected,
    roomState,
    joinRoom,
    updatePresence,
    syncShape,
    deleteShape,
    deleteAllShapes,
    updateShapeHierarchy,
    broadcastEvent,
    createThread,
    addComment,
    updateThreadMetadata,
    deleteComment,
    undo,
    onPresenceUpdate,
    onShapeSynced,
    onShapeDeleted,
    onAllShapesDeleted,
    onEventReceived,
    onUserJoined,
    onUserLeft,
    onThreadCreated,
    onCommentAdded,
    onThreadMetadataUpdated,
    onCommentDeleted
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

// Custom hooks to mimic Liveblocks API
export const useMyPresence = (): [Presence, (presence: Partial<Presence>) => void] => {
  const { socket, roomState, updatePresence } = useWebSocket();
  const myPresence = socket ? roomState.presence[socket.id] || { cursor: null, message: null } : { cursor: null, message: null };
  return [myPresence, updatePresence];
};

export const useUpdateMyPresence = () => {
  const { updatePresence } = useWebSocket();
  return updatePresence;
};

export const useOthers = () => {
  const { socket, roomState } = useWebSocket();
  const others = Object.entries(roomState.presence)
    .filter(([userId]) => userId !== socket?.id)
    .map(([userId, presence]) => ({
      connectionId: userId,
      presence,
      id: userId
    }));
  return others;
};

export const useSelf = () => {
  const { socket, roomState } = useWebSocket();
  if (!socket) return null;

  const user = roomState.users.find(u => u.connectionId === socket.id);
  const presence = roomState.presence[socket.id] || { cursor: null, message: null };

  return user ? {
    connectionId: socket.id,
    id: user.id,
    info: user,
    presence
  } : null;
};

export const useStorage = <T,>(selector: (root: { canvasObjects: Map<string, CanvasObject> }) => T): T => {
  const { roomState } = useWebSocket();
  const canvasObjects = useMemo(() => {
    console.log('[useStorage] roomState.canvasObjects:', roomState.canvasObjects);
    const map = new Map(Object.entries(roomState.canvasObjects));
    console.log('[useStorage] Created Map with size:', map.size);
    return map;
  }, [roomState.canvasObjects]);

  const result = useMemo(() => {
    const res = selector({ canvasObjects });
    console.log('[useStorage] Selector result:', res);
    return res;
  }, [canvasObjects]);

  return result;
};

export const useMutation = <T extends (...args: any[]) => void>(mutationFn: T): T => {
  const { syncShape, deleteShape, deleteAllShapes } = useWebSocket();

  return mutationFn as T;
};

export const useBroadcastEvent = () => {
  const { broadcastEvent } = useWebSocket();
  return broadcastEvent;
};

export const useEventListener = (callback: (event: { user: { connectionId: string }, event: ReactionEvent }) => void) => {
  const { onEventReceived } = useWebSocket();

  useEffect(() => {
    onEventReceived((userId, event) => {
      callback({ user: { connectionId: userId }, event });
    });
  }, [callback, onEventReceived]);
};

export const useUndo = () => {
  const { undo } = useWebSocket();
  return undo;
};

export const useRedo = () => {
  // For simplicity, redo can be implemented similarly to undo
  // This would require maintaining a redo stack on the server
  return () => console.log('Redo not implemented yet');
};

export const useThreads = () => {
  const { roomState } = useWebSocket();
  return { threads: Object.values(roomState.comments) };
};

export const useCreateThread = () => {
  const { createThread } = useWebSocket();
  return createThread;
};

export const useEditThreadMetadata = () => {
  const { updateThreadMetadata } = useWebSocket();
  return (threadId: string, metadata: Partial<Thread['metadata']>) => {
    updateThreadMetadata(threadId, metadata);
  };
};

export const useUser = (userId: string) => {
  const { roomState } = useWebSocket();
  const user = roomState.users.find(u => u.connectionId === userId);
  return { user, isLoading: false };
};

export const useCreateComment = () => {
  const { addComment } = useWebSocket();
  return addComment;
};

export const useDeleteComment = () => {
  const { deleteComment } = useWebSocket();
  return deleteComment;
};
