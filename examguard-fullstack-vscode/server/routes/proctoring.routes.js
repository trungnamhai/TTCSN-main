const express = require('express');
const router = express.Router();
const proctoringController = require('../controllers/proctoring.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.post('/verify-face', verifyToken, proctoringController.verifyFaceAndLog);
router.post('/report-violation', verifyToken, proctoringController.reportClientViolation);

module.exports = router;
