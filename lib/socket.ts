import { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setIOInstance(io: SocketIOServer) {
  ioInstance = io;
}

export function getIOInstance() {
  return ioInstance;
}

export function emitEvent(event: string, data: any) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  } else {
    console.warn(`[Socket.io] No IO instance, cannot emit event: ${event}`);
  }
}
