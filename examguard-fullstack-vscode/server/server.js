const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const examRoutes = require('./routes/exam.routes');
const proctoringRoutes = require('./routes/proctoring.routes');
const teacherRoutes = require('./routes/teacher.routes');
const setupProctoringSocket = require('./sockets/proctoring.socket');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);
setupProctoringSocket(io);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', service: 'ExamGuard Node.js Backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/proctoring', proctoringRoutes);
app.use('/api/teacher', teacherRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[ExamGuard Backend] Server đang chạy tại http://localhost:${PORT}`);
});
