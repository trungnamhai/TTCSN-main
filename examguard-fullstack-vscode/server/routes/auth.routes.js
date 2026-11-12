const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.post('/login-exam', authController.loginExam);
router.post('/login-teacher', authController.loginTeacher);
router.post('/change-password', verifyToken, authController.changePassword);

module.exports = router;
