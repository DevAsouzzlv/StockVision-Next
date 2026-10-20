const mongoose = require('mongoose');

/**
 * SEEDER INICIAL DE DESENVOLVIMENTO & TESTES
 * Popula usuário administrador padrão e produtos exemplo caso o banco esteja vazio
 */
const seedInitialData = async () => {
    try {
        const User = require('../models/User');
        const Product = require('../models/Product');

        const userCount = await User.countDocuments();
        if (userCount === 0) {
            await User.create({
                fullname: 'Arthur Souza',
                email: 'admin@stockvision.com',
                password: 'admin123',
                company: 'StockVision Matriz',
                isAdmin: true,
                phone: '(11) 98765-4321',
                jobTitle: 'Administrador Lead',
                preferences: {
                    theme: 'system',
                    soundAlerts: true,
                    tableDensity: 'comfortable',
                    emailNotifications: true
                },
                companyDetails: {
                    cnpj: '12.345.678/0001-90',
                    segment: 'Logística e Armazenagem',
                    address: 'Av. Industrial, 500 - CD Central'
                }
            });
            console.log('[Seed] Usuário Administrador inicial criado:');
            console.log('       E-mail: admin@stockvision.com');
            console.log('       Senha:  admin123');
        }

        const productCount = await Product.countDocuments();
        if (productCount === 0) {
            await Product.create([
                {
                    company: 'StockVision Matriz',
                    sku: 'SKU-PALLET-01',
                    name: 'Pallet de Madeira Tratada PBR',
                    category: 'Embalagens e Suporte',
                    acquisitionCost: 45.00,
                    sellingPrice: 75.00,
                    quantityInStock: 250,
                    minimumStock: 50,
                    maximumStock: 500,
                    isIndeterminateExpiration: true,
                    salesHistory: [80, 95, 110],
                    leadTimeDays: 5,
                    supplier: 'Madeireira Nacional',
                    location: { sector: 'ARMAZENAGEM', row: 'RUA-01', building: 'PREDIO-A', floor: 'NIVEL-1', apartment: 'VAO-01' }
                },
                {
                    company: 'StockVision Matriz',
                    sku: 'SKU-LUB-02',
                    name: 'Óleo Lubrificante Industrial Sintético 20L',
                    category: 'Insumos Industriais',
                    acquisitionCost: 120.00,
                    sellingPrice: 190.00,
                    quantityInStock: 25,
                    minimumStock: 40,
                    maximumStock: 150,
                    isIndeterminateExpiration: false,
                    expirationDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // Vence em 60 dias
                    salesHistory: [30, 45, 50],
                    leadTimeDays: 7,
                    supplier: 'PetroTech Insumos',
                    location: { sector: 'RECEBIMENTO', row: 'RUA-02', building: 'DOCA-01', floor: 'NIVEL-0', apartment: 'PALLET-05' }
                },
                {
                    company: 'StockVision Matriz',
                    sku: 'SKU-PREJUIZO-03',
                    name: 'Fita de Empacotamento Reforçada (Lote Ponta de Estoque)',
                    category: 'Embalagens e Suporte',
                    acquisitionCost: 18.00,
                    sellingPrice: 12.00, // Preço menor que o custo: Prejuízo unitário intencional para testar Alertas!
                    quantityInStock: 400,
                    minimumStock: 50,
                    maximumStock: 300,
                    isIndeterminateExpiration: true,
                    salesHistory: [10, 15, 12],
                    leadTimeDays: 3,
                    supplier: 'Fitas & Cia',
                    location: { sector: 'EXPEDICAO', row: 'RUA-04', building: 'PREDIO-B', floor: 'NIVEL-2', apartment: 'VAO-12' }
                }
            ]);
            console.log('[Seed] Produtos e insumos de teste populados no inventário NoSQL.');
        }
    } catch (err) {
        console.warn('[Seed Warning]:', err.message);
    }
};

/**
 * CONECTOR MONGODB HÍBRIDO (LOCAL / ATLAS / IN-MEMORY AUTO-START)
 */
const connectDB = async () => {
    const configuredUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    const isCustomRemote = configuredUri && !configuredUri.includes('127.0.0.1') && !configuredUri.includes('localhost');

    // 1. Tenta conectar em banco remoto (Atlas), se configurado
    if (isCustomRemote) {
        try {
            const conn = await mongoose.connect(configuredUri, { serverSelectionTimeoutMS: 3000 });
            console.log(`[MongoDB] Conectado ao cluster remoto: ${conn.connection.host}`);
            await seedInitialData();
            return;
        } catch (error) {
            console.warn(`[MongoDB] Falha ao conectar no cluster remoto: ${error.message}`);
        }
    }

    // 2. Tenta conectar no MongoDB local se estiver rodando
    try {
        const localUri = configuredUri || 'mongodb://127.0.0.1:27017/stockvision';
        const conn = await mongoose.connect(localUri, { serverSelectionTimeoutMS: 1500 });
        console.log(`[MongoDB] Base de dados local conectada: ${conn.connection.host}`);
        await seedInitialData();
        return;
    } catch (error) {
        console.warn(`[MongoDB Local Indisponível] ${error.message}`);
    }

    // 3. Fallback Automático: Inicia MongoDB em memória para testes imediatos sem instalação
    try {
        console.log('[MongoDB Auto-Starter] Iniciando instância NoSQL em memória para testes locais...');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create({ instance: { dbName: 'stockvision' } });
        const memoryUri = mongod.getUri();

        const conn = await mongoose.connect(memoryUri);
        console.log(`[MongoDB Auto-Starter] ✅ Conectado com sucesso ao banco NoSQL em memória!`);
        console.log(`                        URI: ${memoryUri}`);
        await seedInitialData();
    } catch (err) {
        console.error(`[Erro Crítico MongoDB]: ${err.message}`);
    }
};

module.exports = connectDB;