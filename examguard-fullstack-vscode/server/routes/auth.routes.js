const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/login-exam', authController.loginExam);
// router.post('/login-teacher', authController.loginTeacher); // tạm tắt cho tới khi có hàm này

module.exports = router;
