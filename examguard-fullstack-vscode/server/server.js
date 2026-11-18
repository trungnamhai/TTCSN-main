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
app.use(express.json({ limit: '20mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', service: 'ExamGuard Node.js Backend' });
});

// Proxy endpoint phân tích hình ảnh giám sát phòng thi bằng YOLOv8 AI Service
app.post('/api/ai/analyze-frame', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ status: 'ERROR', message: 'Thiếu hình ảnh' });
    }
    const aiResponse = await fetch('http://localhost:5001/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image })
    });
    if (!aiResponse.ok) {
      throw new Error(`AI Service HTTP ${aiResponse.status}`);
    }
    const data = await aiResponse.json();
    return res.json(data);
  } catch (err) {
    return res.json({
      status: 'FALLBACK',
      message: 'YOLOv8 Service offline, sử dụng Vision fallback',
      error: err.message
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/proctoring', proctoringRoutes);
app.use('/api/teacher', teacherRoutes);

// Bắt và xử lý lỗi kết nối / hủy request (request aborted) an toàn
app.use((err, req, res, next) => {
  if (err && (err.type === 'request.aborted' || err.code === 'ECONNABORTED' || err.message?.includes('aborted'))) {
    return;
  }
  console.error('[Backend Error]', err.message || err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({ error: err.message || 'Lỗi xử lý yêu cầu' });
  }
});

process.on('uncaughtException', (err) => {
  if (err && (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' || err.message?.includes('aborted'))) {
    return;
  }
  console.error('[Backend Uncaught Exception]', err.message || err);
});

const fs = require('fs');
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const os = require('os');

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const lanIps = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIps.push(net.address);
      }
    }
  }

  console.log(`[ExamGuard Backend] Server đang lắng nghe trên cổng ${PORT}:`);
  console.log(`  - Local:   http://localhost:${PORT}`);
  lanIps.forEach(ip => {
    console.log(`  - Mạng LAN: http://${ip}:${PORT}`);
  });
});
