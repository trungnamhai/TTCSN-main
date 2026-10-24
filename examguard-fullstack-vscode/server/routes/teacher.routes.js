const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacher.controller');

router.get('/dashboard', teacherController.getDashboardOverview);
router.post('/questions', teacherController.createQuestion);

module.exports = router;
