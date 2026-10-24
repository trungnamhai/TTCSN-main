module.exports = function setupProctoringSocket(io) {
  io.on('connection', (socket) => {
    socket.on('join_session', ({ sessionCode, studentCode, role }) => {
      const room = `SESSION_${sessionCode || 'EXAM88'}`;
      socket.join(room);
      io.to(room).emit('proctoring:participant_joined', {
        socketId: socket.id,
        studentCode,
        role,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('student:camera_heartbeat', (payload) => {
      io.emit('proctoring:live_heartbeat', {
        ...payload,
        timestamp: new Date().toISOString()
      });
    });
  });
};
