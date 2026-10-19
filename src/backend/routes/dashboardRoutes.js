const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middlewares/authMiddleware');

/**
 * 📊 ROTAS DO DASHBOARD EXECUTIVO & ANALYTICS
 */

// GET /api/dashboard/analytics - Métricas completas, ranking de giro, dead stock e ESG
router.get('/analytics', protect, dashboardController.getDashboardAnalytics);

module.exports = router;
