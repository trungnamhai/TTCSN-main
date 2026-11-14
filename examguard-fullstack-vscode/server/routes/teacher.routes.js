const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacher.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

router.use(verifyToken, requireRole(['TEACHER']));
router.get('/dashboard', teacherController.getDashboardOverview);

// Quản lý môn học & chủ đề
router.get('/subjects', teacherController.getSubjects);
router.post('/subjects', teacherController.createSubject);
router.put('/subjects/:id', teacherController.updateSubject);
router.delete('/subjects/:id', teacherController.deleteSubject);

// Quản lý bộ đề thi gốc & ma trận trộn đề
router.get('/exams', teacherController.getExams);
router.post('/exams', teacherController.createExam);
router.put('/exams/:id', teacherController.updateExam);
router.delete('/exams/:id', teacherController.deleteExam);

// Quản lý ca thi phân công & phòng thi trực tuyến
router.get('/sessions', teacherController.getAssignedSessions);
router.post('/sessions', teacherController.createSession);
router.put('/sessions/:id', teacherController.updateSession);
router.patch('/sessions/:id/status', teacherController.updateSessionStatus);
router.delete('/sessions/:id', teacherController.deleteSession);

// Quản lý ngân hàng câu hỏi
router.get('/questions', teacherController.getQuestions);
router.post('/questions', teacherController.createQuestion);
router.put('/questions/:id', teacherController.updateQuestion);
router.delete('/questions/:id', teacherController.deleteQuestion);

// Quản lý danh sách thí sinh
router.get('/students', teacherController.getStudents);
router.post('/students', teacherController.createStudent);
router.put('/students/:id', teacherController.updateStudent);
router.delete('/students/:id', teacherController.deleteStudent);
router.patch('/students/:id/toggle-status', teacherController.toggleStudentStatus);

// Duyệt yêu cầu check-in thí sinh vào phòng thi
router.get('/checkin-requests', teacherController.getCheckinRequests);
router.post('/checkin-requests/approve-all', teacherController.approveAllCheckinRequests);
router.post('/checkin-requests/:id/decision', teacherController.decideCheckinRequest);

// Quản lý yêu cầu hỗ trợ kỹ thuật / xin vào lại phòng thi
router.get('/support-requests', teacherController.getSupportRequests);
router.post('/support-requests/:id/decision', teacherController.decideSupportRequest);

// Duyệt cho phép tiếp tục thi lại khi thí sinh gặp sự cố mạng
router.post('/students/:studentCode/allow-resume', teacherController.allowResumeExam);

// Xác nhận thu bài hoặc cưỡng chế nộp bài khi vi phạm nặng
router.post('/students/:studentCode/force-submit', teacherController.forceSubmitExam);

module.exports = router;
