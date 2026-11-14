const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middlewares/auth.middleware');
const studentPresence = require('../services/student-presence');

module.exports = function setupProctoringSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Cần đăng nhập để kết nối.'));
    }

    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch (error) {
      return next(new Error('Phiên đăng nhập không hợp lệ.'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    if (user.role_name === 'TEACHER') {
      socket.join('TEACHERS');
    }

    if (user.role_name === 'STUDENT') {
      const becameOnline = studentPresence.addSocket(socket.id, user);
      if (becameOnline) {
        io.to('TEACHERS').emit('teacher:student_presence', {
          username: user.username,
          isOnline: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    socket.on('join_session', ({ sessionCode } = {}) => {
      if (user.role_name !== 'STUDENT') return;
      const room = `SESSION_${sessionCode || 'EXAM88'}`;
      socket.join(room);
      io.to(room).emit('proctoring:participant_joined', {
        socketId: socket.id,
        studentCode: user.username,
        role: user.role_name,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('student:camera_heartbeat', (payload) => {
      io.emit('proctoring:live_heartbeat', {
        ...payload,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('student:send_support_request', (payload) => {
      io.emit('teacher:new_support_request', {
        ...payload,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('teacher:reply_support_request', (payload) => {
      io.emit('student:support_decision', {
        ...payload,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('teacher:force_submit_student', (payload) => {
      io.emit('student:force_submitted', {
        ...payload,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('teacher:allow_resume_student', (payload) => {
      io.emit('student:resume_exam_permission', {
        ...payload,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('disconnect', () => {
      const wentOffline = studentPresence.removeSocket(socket.id);
      if (wentOffline) {
        io.to('TEACHERS').emit('teacher:student_presence', {
          username: wentOffline.username,
          isOnline: false,
          timestamp: new Date().toISOString()
        });
      }
    });
  });
};
