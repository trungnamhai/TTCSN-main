const express = require('express');
const router = express.Router();
const examController = require('../controllers/exam.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.post('/start', verifyToken, examController.startExamAttempt);
router.post('/save-answer', verifyToken, examController.saveAnswer);
router.post('/submit', verifyToken, examController.submitExam);

module.exports = router;
