const express = require('express');
const router = express.Router();
const demandController = require('../controllers/demandController');
const { protect } = require('../middlewares/authMiddleware');

// Rota que roda o algoritmo preditivo cruzando MMP e Giro
router.get('/forecast', protect, demandController.getDemandForecast);

// Rota de IA Generativa Google Gemini para análise de demanda de um insumo
router.post('/gemini-insight/:id', protect, demandController.generateGeminiProductInsight);

// Rota auxiliar didática para os alunos popularem histórico de vendas para testes
router.post('/mock-history/:id', protect, demandController.injectMockHistory);

module.exports = router;