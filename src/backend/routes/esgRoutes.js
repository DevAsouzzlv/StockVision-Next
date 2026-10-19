const express = require('express');
const router = express.Router();
const esgController = require('../controllers/esgController');
const { protect } = require('../middlewares/authMiddleware');

// --- ROTAS DO MÓDULO ESG E LOGÍSTICA REVERSA ---
router.post('/damage', protect, esgController.reportDamageOrDefect);
router.get('/expiration-alerts', protect, esgController.getExpirationAlerts);

// GET -> /api/esg/dashboard (Consolida indicadores verdes e retorna as sugestões de destinação da IA)
router.get('/dashboard', protect, esgController.getEsgMetricsAndInsights);

// POST -> /api/esg/gemini-triage/:id (Análise ecológica em tempo real com Google Gemini)
router.post('/gemini-triage/:id', protect, esgController.generateGeminiEsgTriage);

module.exports = router;