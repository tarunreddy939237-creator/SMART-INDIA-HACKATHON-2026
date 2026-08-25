/**
 * Custom Next.js server with Socket.IO for meeting signaling.
 *
 * Run with: node server.js (instead of npx next dev)
 * This enables WebSocket connections for real-time meeting features.
 */
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Socket.IO for meeting signaling
  const io = new SocketIOServer(httpServer, {
    path: '/meeting-socket',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Meeting rooms: Map<meetingUuid, Map<socketId, { userId, userName, role }>>
  const meetingRooms = new Map();

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    /**
     * Join a meeting room.
     * Data: { meetingUuid, userId, userName, role }
     */
    socket.on('join-meeting', (data) => {
      const { meetingUuid, userId, userName, role } = data;
      if (!meetingUuid || !userId) return;

      socket.join(meetingUuid);

      if (!meetingRooms.has(meetingUuid)) {
        meetingRooms.set(meetingUuid, new Map());
      }
      meetingRooms.get(meetingUuid).set(socket.id, {
        userId,
        userName,
        role,
        joinedAt: new Date().toISOString(),
      });

      // Notify existing participants
      const participants = Array.from(meetingRooms.get(meetingUuid).entries()).map(([id, info]) => ({
        socketId: id,
        ...info,
      }));

      io.to(meetingUuid).emit('participants-update', {
        participants,
        newParticipant: { socketId: socket.id, userId, userName, role },
      });

      console.log(`[Socket] ${userName} (${role}) joined meeting ${meetingUuid}`);
    });

    /**
     * WebRTC signaling: offer, answer, ice-candidate
     */
    socket.on('webrtc-offer', (data) => {
      const { targetSocketId, offer } = data;
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc-offer', {
          fromSocketId: socket.id,
          offer,
        });
      }
    });

    socket.on('webrtc-answer', (data) => {
      const { targetSocketId, answer } = data;
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc-answer', {
          fromSocketId: socket.id,
          answer,
        });
      }
    });

    socket.on('webrtc-ice-candidate', (data) => {
      const { targetSocketId, candidate } = data;
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc-ice-candidate', {
          fromSocketId: socket.id,
          candidate,
        });
      }
    });

    /**
     * Meeting chat message.
     */
    socket.on('chat-message', (data) => {
      const { meetingUuid, message, senderName, senderRole } = data;
      if (!meetingUuid || !message) return;

      io.to(meetingUuid).emit('chat-message', {
        id: `msg-${Date.now()}-${socket.id}`,
        senderId: socket.id,
        senderName: senderName || 'Anonymous',
        senderRole: senderRole || 'student',
        message,
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * Host controls: mute participant, remove participant.
     */
    socket.on('host-mute', (data) => {
      const { meetingUuid, targetSocketId } = data;
      io.to(targetSocketId).emit('force-mute');
    });

    socket.on('host-remove', (data) => {
      const { meetingUuid, targetSocketId } = data;
      io.to(targetSocketId).emit('removed-from-meeting');
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(meetingUuid);
        if (meetingRooms.has(meetingUuid)) {
          meetingRooms.get(meetingUuid).delete(targetSocketId);
        }
        const participants = meetingRooms.has(meetingUuid)
          ? Array.from(meetingRooms.get(meetingUuid).entries()).map(([id, info]) => ({ socketId: id, ...info }))
          : [];
        io.to(meetingUuid).emit('participants-update', { participants });
      }
    });

    /**
     * Screen share events.
     */
    socket.on('screen-share-started', (data) => {
      const { meetingUuid } = data;
      socket.to(meetingUuid).emit('screen-share-started', { socketId: socket.id });
    });

    socket.on('screen-share-stopped', (data) => {
      const { meetingUuid } = data;
      socket.to(meetingUuid).emit('screen-share-stopped', { socketId: socket.id });
    });

    /**
     * Disconnect — clean up.
     */
    socket.on('disconnect', () => {
      // Find and remove from all meeting rooms
      for (const [meetingUuid, room] of meetingRooms.entries()) {
        if (room.has(socket.id)) {
          const participant = room.get(socket.id);
          room.delete(socket.id);

          // Notify remaining participants
          const participants = Array.from(room.entries()).map(([id, info]) => ({
            socketId: id,
            ...info,
          }));

          io.to(meetingUuid).emit('participants-update', {
            participants,
            leftParticipant: { socketId: socket.id, ...participant },
          });

          io.to(meetingUuid).emit('peer-disconnected', { socketId: socket.id });

          // Clean up empty rooms
          if (room.size === 0) {
            meetingRooms.delete(meetingUuid);
          }

          console.log(`[Socket] ${participant?.userName || socket.id} left meeting ${meetingUuid}`);
          break;
        }
      }
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`\n🚀 Ready on http://${hostname}:${port}`);
    console.log(`📡 Socket.IO signaling available at /meeting-socket\n`);
  });
});
