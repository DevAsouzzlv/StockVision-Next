const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const inventoryController = require('../controllers/inventoryController');

// Importa o middleware de segurança e governança corporativa
const { protect } = require('../middlewares/authMiddleware');

// --- ROTAS DO CORE LOGÍSTICO (PROTEGIDAS POR TOKEN JWT) ---

router.post('/', protect, stockController.createProduct);
router.get('/', protect, stockController.listProducts);
router.get('/metrics', protect, stockController.getDashboardMetrics);

/**
 * @route   PUT /api/stock/:id
 * @desc    Atualizar parâmetros comerciais e reendereçamento WMS do material (com validações de min/max e preço)
 */
router.put('/:id', protect, stockController.updateProduct);

/**
 * @route   DELETE /api/stock/:id
 * @desc    Remover permanentemente um lote ou insumo do inventário NoSQL
 */
router.delete('/:id', protect, stockController.deleteProduct);

// --- ⚖️ ROTAS DE AUDITORIA, INVENTÁRIO ROTATIVO E INGESTÃO DE NOTAS ---
router.get('/inventory/rotative', protect, inventoryController.getRotativeInventorySheet);
router.post('/inventory/general', protect, inventoryController.processGeneralInventory);
router.post('/invoice/xml', protect, stockController.importInvoiceXml);

module.exports = router;