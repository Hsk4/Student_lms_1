'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Hook to connect to Socket.io server and listen for real-time events.
 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (socketRef.current) return;

    const socket = io(undefined, {
      path: '/api/socket',
      addTrailingSlash: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('[Socket.io] Connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io] Disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket.io] Connection error:', error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return socketRef.current;
}
