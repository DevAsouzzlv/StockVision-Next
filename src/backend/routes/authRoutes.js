const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Importa os Middlewares de Validação Corporativa
const { protect, admin } = require('../middlewares/authMiddleware');

// --- ROTAS PÚBLICAS ---
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// --- ROTAS PROTEGIDAS DO USUÁRIO LOGADO ---
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);

// --- ROTAS PROTEGIDAS APENAS PARA ADMINISTRADORES (ADM) ---
// O middleware 'protect' garante login ativo e o 'admin' garante o nível de crachá corporativo.

// POST -> /api/auth/employees (Registrar um funcionário atrelando-o à empresa do ADM)
router.post('/employees', protect, admin, authController.registerEmployee);

// GET -> /api/auth/employees (Listar apenas os funcionários da empresa do ADM logado)
router.get('/employees', protect, admin, authController.listEmployees);

// PUT -> /api/auth/employees/:employeeId (Permite ao ADM alterar a senha ou ativar/desativar a conta do funcionário)
router.put('/employees/:employeeId', protect, admin, authController.updateEmployeeCredentials);

module.exports = router;