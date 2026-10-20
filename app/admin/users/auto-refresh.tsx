'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/use-socket';

/**
 * Listens for real-time user changes via Socket.io.
 * Refreshes page when users are deleted (via webhook).
 */
export function UsersAutoRefresh() {
  const router = useRouter();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleUserDeleted = () => {
      console.log('[UsersAutoRefresh] User deleted, refreshing page...');
      router.refresh();
    };

    socket.on('user:deleted', handleUserDeleted);

    return () => {
      socket.off('user:deleted', handleUserDeleted);
    };
  }, [socket, router]);

  return null;
}
