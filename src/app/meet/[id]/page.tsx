'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {
  ArrowLeft, Video, VideoOff, Mic, MicOff, Monitor, MonitorOff,
  Phone, PhoneOff, Users, MessageSquare, Settings, Loader2,
  CheckCircle, XCircle, Clock, Calendar, AlertCircle, Send,
  ChevronDown, ChevronUp, BarChart3, Download, Eye, Play,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Meeting {
  _id: string;
  meetingUuid: string;
  title: string;
  description: string;
  agenda: string;
  hostId: string;
  hostName: string;
  scheduledDate: string;
  scheduledStartTime: string;
  expectedDuration: number;
  status: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  totalInvited: number;
  totalJoined: number;
  presentCount: number;
  partialCount: number;
  absentCount: number;
  attendancePercentage: number;
  branch: string;
  year: string;
  section: string;
  allowStudentScreenShare?: boolean;
}

interface Participant {
  socketId: string;
  userId: string;
  userName: string;
  role: string;
  joinedAt: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  timestamp: string;
}

interface AttendanceRecord {
  userId: string;
  userName: string;
  userRollNumber: string;
  firstJoinTime: string;
  lastLeaveTime: string;
  totalDuration: number;
  attendancePercentage: number;
  attendanceStatus: string;
}

// ─── WebRTC Hook ──────────────────────────────────────────────────────────────
function useWebRTC(socket: Socket | null, meetingUuid: string, mySocketId: string | null) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const STUN_CONFIG: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  const getMediaStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('Failed to get media:', err);
      // Try audio only
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsCameraOff(true);
        return stream;
      } catch (err2) {
        console.error('Failed to get audio:', err2);
        return null;
      }
    }
  }, []);

  const createPeerConnection = useCallback((targetSocketId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection(STUN_CONFIG);
    peerConnections.current.set(targetSocketId, pc);

    // Add local tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(targetSocketId, remoteStream);
        return next;
      });
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          meetingUuid,
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(targetSocketId);
          return next;
        });
      }
    };

    return pc;
  }, [socket, meetingUuid]);

  // Initialize media and handle signaling
  useEffect(() => {
    if (!socket || !mySocketId) return;

    let mounted = true;

    (async () => {
      const stream = await getMediaStream();
      if (!mounted || !stream) return;

      // Handle new participants joining
      socket.on('participants-update', async (data: { participants: Participant[]; newParticipant?: Participant }) => {
        if (!data.newParticipant || data.newParticipant.socketId === mySocketId) return;

        const targetSocketId = data.newParticipant.socketId;
        const existingPc = peerConnections.current.get(targetSocketId);
        if (existingPc) return;

        const pc = createPeerConnection(targetSocketId, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('webrtc-offer', {
          meetingUuid,
          targetSocketId,
          offer,
        });
      });

      // Handle offers
      socket.on('webrtc-offer', async (data: { fromSocketId: string; offer: RTCSessionDescriptionInit }) => {
        const pc = createPeerConnection(data.fromSocketId, stream);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc-answer', {
          meetingUuid,
          targetSocketId: data.fromSocketId,
          answer,
        });
      });

      // Handle answers
      socket.on('webrtc-answer', async (data: { fromSocketId: string; answer: RTCSessionDescriptionInit }) => {
        const pc = peerConnections.current.get(data.fromSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      });

      // Handle ICE candidates
      socket.on('webrtc-ice-candidate', async (data: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
        const pc = peerConnections.current.get(data.fromSocketId);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      });

      // Handle peer disconnect
      socket.on('peer-disconnected', (data: { socketId: string }) => {
        const pc = peerConnections.current.get(data.socketId);
        if (pc) {
          pc.close();
          peerConnections.current.delete(data.socketId);
        }
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(data.socketId);
          return next;
        });
      });

      // Handle forced mute from host
      socket.on('force-mute', () => {
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = false; });
        }
        setIsMuted(true);
      });

      // Handle removed from meeting
      socket.on('removed-from-meeting', () => {
        cleanup();
        alert('You have been removed from the meeting.');
        window.location.href = '/meet';
      });
    })();

    function cleanup() {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
    }

    return () => {
      mounted = false;
      cleanup();
    };
  }, [socket, mySocketId, meetingUuid, getMediaStream, createPeerConnection]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(t => { t.enabled = isMuted; });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(t => { t.enabled = isCameraOff; });
      setIsCameraOff(!isCameraOff);
    }
  }, [isCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop screen share, restore camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const screenTrack = localStreamRef.current?.getVideoTracks()[0];
      if (screenTrack) {
        const cameraTrack = stream.getVideoTracks()[0];
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(cameraTrack);
        });
        screenTrack.stop();
        localStreamRef.current?.removeTrack(screenTrack);
        localStreamRef.current?.addTrack(cameraTrack);
      }
      setIsScreenSharing(false);
      socket?.emit('screen-share-stopped', { meetingUuid });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(screenTrack);
        });
        const currentVideoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (currentVideoTrack) {
          currentVideoTrack.stop();
          localStreamRef.current?.removeTrack(currentVideoTrack);
        }
        localStreamRef.current?.addTrack(screenTrack);
        setIsScreenSharing(true);
        socket?.emit('screen-share-started', { meetingUuid });

        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (err) {
        console.error('Screen share failed:', err);
      }
    }
  }, [isScreenSharing, socket, meetingUuid]);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    setRemoteStreams(new Map());
    setLocalStream(null);
  }, []);

  return {
    localStream, remoteStreams, isMuted, isCameraOff, isScreenSharing,
    toggleMute, toggleCamera, toggleScreenShare, cleanup,
  };
}

// ─── Video Grid Component ────────────────────────────────────────────────────
function VideoGrid({ localStream, remoteStreams, participants }: {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: Participant[];
}) {
  const totalVideos = 1 + remoteStreams.size;
  const cols = totalVideos <= 2 ? 2 : totalVideos <= 4 ? 2 : 3;

  return (
    <div
      className="grid gap-2 p-2 h-full"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridAutoRows: 'minmax(150px, 1fr)',
      }}
    >
      {/* Local video */}
      <VideoTile
        stream={localStream}
        name="You"
        isLocal={true}
      />

      {/* Remote videos */}
      {Array.from(remoteStreams.entries()).map(([socketId, stream]) => {
        const participant = participants.find(p => p.socketId === socketId);
        return (
          <VideoTile
            key={socketId}
            stream={stream}
            name={participant?.userName || 'Participant'}
          />
        );
      })}

      {/* Show participant names even without video */}
      {Array.from(remoteStreams.entries()).length === 0 && participants.length > 0 && (
        <div className={`col-span-${cols} flex items-center justify-center text-gray-500`}>
          <div className="text-center">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Waiting for participants to connect...</p>
            <p className="text-sm mt-1">{participants.length} participant(s) in meeting</p>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoTile({ stream, name, isLocal }: { stream: MediaStream | null; name: string; isLocal?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream?.getVideoTracks().some(t => t.enabled);

  return (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden border border-gray-700/50">
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/40 to-purple-900/40">
          <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <span className="text-2xl font-bold text-indigo-300">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white">
        {name} {isLocal && '(You)'}
      </div>
    </div>
  );
}

// ─── Main Meeting Page ────────────────────────────────────────────────────────
export default function MeetingDetailPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const meetingId = params?.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inMeeting, setInMeeting] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const socketRef = useRef<Socket | null>(null);
  const [mySocketId, setMySocketId] = useState<string | null>(null);

  const userRole = (session?.user as any)?.role || 'student';
  const userId = (session?.user as any)?.id || '';
  const userName = (session?.user as any)?.name || 'User';
  const isHost = meeting?.hostId === userId;

  // Fetch meeting details
  useEffect(() => {
    if (!meetingId) return;
    (async () => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}`);
        if (res.ok) {
          const data = await res.json();
          setMeeting(data.meeting);
          setAttendance(data.attendance || []);
        } else {
          setError('Meeting not found or access denied');
        }
      } catch {
        setError('Failed to load meeting');
      } finally {
        setLoading(false);
      }
    })();
  }, [meetingId]);

  // Socket.IO connection for live meetings
  useEffect(() => {
    if (!meeting || (meeting.status !== 'live' && meeting.status !== 'waiting')) return;

    const socketUrl = typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : 'http://localhost:3000';

    const socket = io(socketUrl, {
      path: '/meeting-socket',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setMySocketId(socket.id || null);
    });

    socket.on('participants-update', (data: { participants: Participant[] }) => {
      setParticipants(data.participants);
    });

    socket.on('chat-message', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [meeting?.status, meeting?.meetingUuid]);

  // WebRTC hook
  const {
    localStream, remoteStreams, isMuted, isCameraOff, isScreenSharing,
    toggleMute, toggleCamera, toggleScreenShare, cleanup,
  } = useWebRTC(socketRef.current, meeting?.meetingUuid || '', mySocketId);

  // Join meeting
  const handleJoin = async () => {
    if (!meeting) return;
    try {
      const res = await fetch(`/api/meetings/${meeting.meetingUuid}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: mySocketId }),
      });
      if (res.ok) {
        setInMeeting(true);
        // Emit join to socket
        socketRef.current?.emit('join-meeting', {
          meetingUuid: meeting.meetingUuid,
          userId,
          userName,
          role: userRole,
        });
      }
    } catch {
      alert('Failed to join meeting');
    }
  };

  // Leave meeting
  const handleLeave = async () => {
    if (!meeting) return;
    try {
      await fetch(`/api/meetings/${meeting.meetingUuid}/leave`, { method: 'POST' });
      cleanup();
      setInMeeting(false);
      socketRef.current?.disconnect();
    } catch {
      // Leave anyway
      cleanup();
      setInMeeting(false);
    }
  };

  // End meeting (host)
  const handleEnd = async () => {
    if (!meeting || !confirm('End this meeting for all participants?')) return;
    try {
      const res = await fetch(`/api/meetings/${meeting.meetingUuid}/end`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        cleanup();
        setInMeeting(false);
        socketRef.current?.disconnect();
        // Refresh meeting data
        setMeeting(m => m ? { ...m, status: 'completed', actualEndTime: new Date().toISOString() } : m);
      }
    } catch {
      alert('Failed to end meeting');
    }
  };

  // Send chat
  const handleSendChat = () => {
    if (!chatInput.trim() || !socketRef.current || !meeting) return;
    socketRef.current.emit('chat-message', {
      meetingUuid: meeting.meetingUuid,
      message: chatInput.trim(),
      senderName: userName,
      senderRole: userRole,
    });
    setChatInput('');
  };

  // Fetch attendance for completed meetings
  useEffect(() => {
    if (meeting?.status === 'completed' && meetingId) {
      fetch(`/api/meetings/${meetingId}/attendance`)
        .then(r => r.json())
        .then(data => {
          if (data.allAttendance) setAttendance(data.allAttendance);
          if (data.summary) setSummary(data.summary);
        })
        .catch(() => {});
    }
  }, [meeting?.status, meetingId]);

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-800/60 border border-red-500/30 rounded-2xl p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Meeting Not Found</h2>
          <p className="text-gray-400">{error || 'This meeting does not exist or you do not have access.'}</p>
          <button onClick={() => router.push('/meet')} className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl">
            Back to Meetings
          </button>
        </div>
      </div>
    );
  }

  const meetingDate = new Date(meeting.scheduledDate);
  const isLive = meeting.status === 'live';
  const isCompleted = meeting.status === 'completed';
  const isScheduled = meeting.status === 'scheduled';

  // ─── LIVE MEETING ROOM ─────────────────────────────────────────────────────
  if (inMeeting && isLive) {
    return (
      <div className="h-screen bg-gray-950 flex flex-col">
        {/* Meeting header bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-white font-medium">{meeting.title}</span>
            <span className="text-gray-500 text-sm">· {participants.length} participant(s)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowParticipants(!showParticipants)}
              className={`p-2 rounded-lg ${showParticipants ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              <Users className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-2 rounded-lg ${showChat ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Video grid */}
          <div className="flex-1">
            <VideoGrid localStream={localStream} remoteStreams={remoteStreams} participants={participants} />
          </div>

          {/* Side panels */}
          {(showChat || showParticipants) && (
            <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
              {showParticipants && (
                <div className="flex-1 overflow-y-auto p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Participants ({participants.length})
                  </h3>
                  {participants.map(p => (
                    <div key={p.socketId} className="flex items-center gap-3 py-2 border-b border-gray-800/50">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                        <span className="text-sm font-medium text-indigo-300">
                          {p.userName?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm">{p.userName}</p>
                        <p className="text-gray-500 text-xs">{p.role}</p>
                      </div>
                      {isHost && p.role !== 'faculty' && (
                        <div className="flex gap-1">
                          <button className="p-1 text-gray-500 hover:text-yellow-400" title="Mute">
                            <MicOff className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1 text-gray-500 hover:text-red-400"
                            title="Remove"
                            onClick={() => {
                              socketRef.current?.emit('host-remove', {
                                meetingUuid: meeting.meetingUuid,
                                targetSocketId: p.socketId,
                              });
                            }}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {showChat && (
                <div className="flex-1 flex flex-col border-t border-gray-800">
                  <h3 className="text-white font-semibold p-4 pb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    Chat
                  </h3>
                  <div className="flex-1 overflow-y-auto px-4 space-y-3">
                    {chatMessages.map(msg => (
                      <div key={msg.id} className={`${msg.senderId === mySocketId ? 'text-right' : ''}`}>
                        <p className="text-xs text-gray-500">{msg.senderName}</p>
                        <p className={`text-sm inline-block px-3 py-1.5 rounded-xl ${
                          msg.senderId === mySocketId
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-gray-800 text-gray-200 rounded-bl-none'
                        }`}>
                          {msg.message}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-gray-800">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                        placeholder="Type a message..."
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:border-indigo-500 outline-none"
                      />
                      <button
                        onClick={handleSendChat}
                        className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="flex items-center justify-center gap-4 px-4 py-4 bg-gray-900/80 border-t border-gray-800">
          <button
            onClick={toggleMute}
            className={`p-3 rounded-full transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleCamera}
            className={`p-3 rounded-full transition-all ${isCameraOff ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
          >
            {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
          {(userRole === 'faculty' || (userRole === 'student' && meeting.allowStudentScreenShare)) && (
            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-full transition-all ${isScreenSharing ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
            >
              {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            </button>
          )}

          <div className="w-px h-8 bg-gray-700 mx-2" />

          <button
            onClick={handleLeave}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-medium transition-all"
          >
            <PhoneOff className="w-5 h-5" />
            Leave
          </button>

          {isHost && (
            <button
              onClick={handleEnd}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-medium transition-all"
            >
              <PhoneOff className="w-5 h-5" />
              End Meeting
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── POST-MEETING SUMMARY ──────────────────────────────────────────────────
  if (isCompleted || summary) {
    const s = summary || {};
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push('/meet')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Meetings
          </button>

          {/* Meeting header */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <h1 className="text-2xl font-bold text-white">{meeting.title}</h1>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-500 text-sm">Host</p>
                <p className="text-white">{meeting.hostName}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Date</p>
                <p className="text-white">{meetingDate.toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Duration</p>
                <p className="text-white">{s.totalDuration || meeting.expectedDuration} min</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Attendance Rate</p>
                <p className="text-white text-xl font-bold text-indigo-400">
                  {s.attendanceRate || meeting.attendancePercentage || 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Attendance summary */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Attendance Summary
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-900/60 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-white">{s.totalInvited || meeting.totalInvited || 0}</p>
                <p className="text-sm text-gray-400">Invited</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-400">{s.presentCount || meeting.presentCount || 0}</p>
                <p className="text-sm text-gray-400">Present</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-yellow-400">{s.partialCount || meeting.partialCount || 0}</p>
                <p className="text-sm text-gray-400">Partial</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-red-400">{s.absentCount || meeting.absentCount || 0}</p>
                <p className="text-sm text-gray-400">Absent</p>
              </div>
            </div>

            {/* Attendance table */}
            {attendance.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-700/50">
                      <th className="text-left py-3 px-4">Student</th>
                      <th className="text-left py-3 px-4">Roll No.</th>
                      <th className="text-left py-3 px-4">Joined</th>
                      <th className="text-left py-3 px-4">Duration</th>
                      <th className="text-left py-3 px-4">Attendance</th>
                      <th className="text-left py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((a, i) => (
                      <tr key={a.userId || i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-3 px-4 text-white">{a.userName}</td>
                        <td className="py-3 px-4 text-gray-400">{a.userRollNumber || '—'}</td>
                        <td className="py-3 px-4 text-gray-400">
                          {a.firstJoinTime ? new Date(a.firstJoinTime).toLocaleTimeString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {a.totalDuration ? `${Math.round(a.totalDuration / 60)}m` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="w-24 bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                a.attendancePercentage >= 75 ? 'bg-green-500' :
                                a.attendancePercentage >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(a.attendancePercentage || 0, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{a.attendancePercentage || 0}%</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            a.attendanceStatus === 'present' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            a.attendanceStatus === 'partial' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {a.attendanceStatus === 'present' ? <CheckCircle className="w-3 h-3" /> :
                             a.attendanceStatus === 'partial' ? <Clock className="w-3 h-3" /> :
                             <XCircle className="w-3 h-3" />}
                            {a.attendanceStatus?.charAt(0)?.toUpperCase() + (a.attendanceStatus?.slice(1) || '')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── LOBBY / DETAIL VIEW ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/meet')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Meetings
        </button>

        {/* Meeting info card */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl overflow-hidden">
          {/* Header banner */}
          <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 p-6 border-b border-gray-700/50">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                    isLive ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                    isScheduled ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    isCompleted ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                    'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {isLive && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
                    {meeting.status === 'scheduled' && <Calendar className="w-3 h-3" />}
                    {isCompleted && <CheckCircle className="w-3 h-3" />}
                    {meeting.status === 'cancelled' && <XCircle className="w-3 h-3" />}
                    {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">{meeting.title}</h1>
                {meeting.description && (
                  <p className="text-gray-400 mt-2">{meeting.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <div>
                <p className="text-gray-500 text-sm mb-1">Host</p>
                <p className="text-white font-medium">{meeting.hostName}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Date</p>
                <p className="text-white font-medium">{meetingDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Time</p>
                <p className="text-white font-medium">{meeting.scheduledStartTime}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Duration</p>
                <p className="text-white font-medium">{meeting.expectedDuration} minutes</p>
              </div>
            </div>

            {meeting.branch && (
              <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
                {meeting.branch && <span>Branch: {meeting.branch}</span>}
                {meeting.year && <span>Year: {meeting.year}</span>}
                {meeting.section && <span>Section: {meeting.section}</span>}
              </div>
            )}

            {meeting.agenda && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Agenda</h3>
                <p className="text-white bg-gray-900/60 rounded-xl p-4 whitespace-pre-wrap">{meeting.agenda}</p>
              </div>
            )}

            {/* Meeting stats for completed */}
            {isCompleted && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-400">{meeting.presentCount || 0}</p>
                  <p className="text-xs text-gray-400">Present</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-400">{meeting.partialCount || 0}</p>
                  <p className="text-xs text-gray-400">Partial</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-red-400">{meeting.absentCount || 0}</p>
                  <p className="text-xs text-gray-400">Absent</p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-700/50">
              {isScheduled && !isHost && (
                <button className="flex items-center gap-2 bg-gray-700 text-gray-400 px-6 py-3 rounded-xl cursor-not-allowed">
                  <Clock className="w-5 h-5" />
                  Waiting for host to start
                </button>
              )}

              {isScheduled && isHost && (
                <button
                  onClick={async () => {
                    await fetch(`/api/meetings/${meeting.meetingUuid}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'live', actualStartTime: new Date().toISOString() }),
                    });
                    setMeeting(m => m ? { ...m, status: 'live', actualStartTime: new Date().toISOString() } : m);
                  }}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-green-500/20"
                >
                  <Play className="w-5 h-5" />
                  Start Meeting
                </button>
              )}

              {(isLive || meeting.status === 'waiting') && (
                <button
                  onClick={handleJoin}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-green-500/20"
                >
                  <Video className="w-5 h-5" />
                  Join Meeting
                </button>
              )}

              {isCompleted && (isHost || userRole === 'admin') && (
                <button
                  onClick={() => router.push(`/meet/${meeting.meetingUuid}`)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-all"
                >
                  <Eye className="w-5 h-5" />
                  View Attendance
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
