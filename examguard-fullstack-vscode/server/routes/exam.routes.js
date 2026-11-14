const express = require('express');
const router = express.Router();
const examController = require('../controllers/exam.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.get('/sessions', verifyToken, examController.getStudentSessions);
router.get('/attempts', verifyToken, examController.getStudentAttempts);
router.get('/attempts/:id', verifyToken, examController.getAttemptDetail);
router.post('/check-in', verifyToken, examController.submitCheckin);
router.get('/check-in/status', verifyToken, examController.getCheckinStatus);
router.post('/start', verifyToken, examController.startExamAttempt);
router.post('/save-answer', verifyToken, examController.saveAnswer);
router.post('/submit', verifyToken, examController.submitExam);
router.post('/support-request', verifyToken, examController.submitSupportRequest);
router.get('/support-requests', verifyToken, examController.getStudentSupportRequests);

module.exports = router;
