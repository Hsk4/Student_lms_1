import { Server as HTTPServer } from 'http';
import { Socket as NetSocket } from 'net';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiRequest, NextApiResponse } from 'next';
import { setIOInstance } from '@/lib/socket';

interface SocketRequest extends NextApiRequest {
  socket: NetSocket & {
    server: HTTPServer & {
      io?: SocketIOServer;
    };
  };
}

/**
 * Socket.io server for real-time updates.
 * Emits 'user:deleted' when webhooks delete users from Clerk.
 */
export default function handler(req: SocketRequest, res: NextApiResponse) {
  if (!res.socket.server.io) {
    console.log('[Socket.io] Initializing Socket.io server');
    const io = new SocketIOServer(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
    });

    io.on('connection', (socket) => {
      console.log(`[Socket.io] Client connected: ${socket.id}`);

      socket.on('disconnect', () => {
        console.log(`[Socket.io] Client disconnected: ${socket.id}`);
      });
    });

    res.socket.server.io = io;
    setIOInstance(io);
  }

  res.end();
}
