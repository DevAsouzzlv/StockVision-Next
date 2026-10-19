const Product = require('../models/Product');
const ReverseLogistics = require('../models/ReverseLogistics');

/**
 * ⚠️ REGISTRAR AVARIA / DEFEITO MANUALMENTE
 */
exports.reportDamageOrDefect = async (req, res) => {
    try {
        const companyName = req.user.company;
        const { productId, quantity, issueType, lote, observations } = req.body;

        if (issueType === 'Vencido') {
            return res.status(400).json({ message: 'Para produtos vencidos, utilize a varredura automática de lote.' });
        }

        const product = await Product.findOne({ _id: productId, company: companyName });
        if (!product) {
            return res.status(404).json({ message: 'Produto não localizado no inventário.' });
        }

        if (product.quantityInStock < quantity) {
            return res.status(400).json({ message: `Estoque insuficiente para baixa. Quantidade atual: ${product.quantityInStock} un.` });
        }

        product.quantityInStock -= quantity;
        await product.save();

        const reverseItem = await ReverseLogistics.create({
            company: companyName,
            product: product._id,
            productName: product.name,
            sku: product.sku,
            lote,
            quantity,
            issueType,
            observations
        });

        return res.status(201).json({
            message: `Sucesso! ${quantity} unidades movidas para a Logística Reversa por motivo de: ${issueType}.`,
            data: reverseItem
        });
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao registrar avaria/defeito.', error: error.message });
    }
};

/**
 * 🔮 MOTOR DE RASTREAMENTO: PRODUTOS PRÓXIMOS AO VENCIMENTO (REGRA DOS 6 MESES)
 */
exports.getExpirationAlerts = async (req, res) => {
    try {
        const companyName = req.user.company;
        const hoje = new Date();
        const limiteSeisMeses = new Date();
        limiteSeisMeses.setDate(hoje.getDate() + 180);

        const criticalProducts = await Product.find({
            company: companyName,
            isIndeterminateExpiration: false,
            expirationDate: { $gte: hoje, $lte: limiteSeisMeses }
        });

        const alertsReport = criticalProducts.map(p => {
            const diferencaTempo = p.expirationDate.getTime() - hoje.getTime();
            const diasRestantes = Math.ceil(diferencaTempo / (1000 * 60 * 60 * 24));

            return {
                productId: p._id,
                productName: p.name,
                sku: p.sku,
                quantity: p.quantityInStock,
                expirationDate: p.expirationDate,
                diasRestantes: diasRestantes,
                estadoUrgencia: diasRestantes <= 30 ? 'CRÍTICO' : 'ATENÇÃO'
            };
        });

        return res.status(200).json({ alerts: alertsReport });
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao processar alertas de vencimento.', error: error.message });
    }
};

/**
 * 🌱 MOTOR HISTÓRICO E METRICAS ESG: TAXA DE DESPERDÍCIO E ÍNDICES DE DESTINAÇÃO
 * Processa os volumes acumulados e gera insights inteligentes baseados em regras de toxicidade.
 */
exports.getEsgMetricsAndInsights = async (req, res) => {
    try {
        const companyName = req.user.company;

        // 1. Coleta dados do estoque comercial e da logística reversa
        const commercialProducts = await Product.find({ company: companyName });
        const reverseItems = await ReverseLogistics.find({ company: companyName });

        let totalCommercialQty = commercialProducts.reduce((acc, p) => acc + p.quantityInStock, 0);
        let totalLossQty = reverseItems.reduce((acc, item) => acc + item.quantity, 0);
        
        // FÓRMULA SUSTENTÁVEL: Total de produtos operados pelo armazém
        let totalVolumeArray = totalCommercialQty + totalLossQty;

        // Cálculo da Taxa de Desperdício Geral
        const wasteRate = totalVolumeArray > 0 ? (totalLossQty / totalVolumeArray) * 100 : 0;

        // 2. Agrupamento por tipo de destinação para cálculo dos índices
        let distributedCounters = { Pendente: 0, Reaproveitamento: 0, DescarteSustentavel: 0, Reciclagem: 0 };
        
        // Lista detalhada com as sugestões automáticas baseadas em regras de negócio de triagem ecológica
        const itemsWithAiInsights = reverseItems.map(item => {
            let aiSuggestion = '';
            let rationale = '';
            let targetCategory = item.observations.toLowerCase();

            // Regras especialistas de toxicidade, estado físico e potencial de reuso (Simulação do motor de IA)
            if (item.issueType === 'Defeituoso') {
                aiSuggestion = 'Encaminhar para Reciclagem / Logística Reversa de Eletrônicos (E-waste).';
                rationale = 'Componentes eletrônicos possuem metais valiosos recicláveis e não devem sofrer descarte comum.';
            } else if (item.issueType === 'Avariado' && !targetCategory.includes('tóxico') && !targetCategory.includes('perigoso')) {
                aiSuggestion = 'Reaproveitamento Interno ou Recondicionamento.';
                rationale = 'Dano restrito à embalagem comercial; o item mantém sua integridade estrutural interna segura.';
            } else if (item.issueType === 'Vencido' || targetCategory.includes('tóxico') || targetCategory.includes('perigoso')) {
                aiSuggestion = 'Descarte Sustentável Especializado.';
                rationale = 'Produto químico, tóxico ou fora do prazo de validade legal. Exige incineração ecológica ou coprocessamento.';
            } else {
                aiSuggestion = 'Triagem Manual Complementar.';
                rationale = 'Dados de descrição insuficientes para classificação preditiva.';
            }

            return {
                ...item._doc,
                aiEvaluation: {
                    sugestaoDestino: aiSuggestion,
                    justificativaMecanica: rationale
                }
            };
        });

        // Contabiliza volumes para o índice consolidado de destinação
        reverseItems.forEach(item => {
            if (item.destinationStatus === 'Reaproveitamento') distributedCounters.Reaproveitamento += item.quantity;
            if (item.destinationStatus === 'Reciclagem') distributedCounters.Reciclagem += item.quantity;
            if (item.destinationStatus === 'Descarte Sustentável') distributedCounters.DescarteSustentavel += item.quantity;
            if (item.destinationStatus === 'Pendente') distributedCounters.Pendente += item.quantity;
        });

        // FÓRMULA SUSTENTÁVEL: Índice de Reciclagem (%) = (Material Reciclado / Resíduo Total) * 100
        const recyclingIndex = totalLossQty > 0 ? (distributedCounters.Reciclagem / totalLossQty) * 100 : 0;

        return res.status(200).json({
            esgOverview: {
                totalEstoqueComercial: totalCommercialQty,
                totalEstoquePerdas: totalLossQty,
                taxaDesperdicioGeral: parseFloat(wasteRate.toFixed(2)) + '%',
                indiceReciclagemAtual: parseFloat(recyclingIndex.toFixed(2)) + '%'
            },
            volumesPorDestino: distributedCounters,
            painelEspecialistaIA: itemsWithAiInsights
        });

    } catch (error) {
        return res.status(500).json({ message: 'Erro ao gerar painel ecológico ESG.', error: error.message });
    }
};

/**
 * 🤖 TRIAGEM ECOLÓGICA EM TEMPO REAL VIA GOOGLE GEMINI
 * POST -> /api/esg/gemini-triage/:id
 */
exports.generateGeminiEsgTriage = async (req, res) => {
    try {
        const item = await ReverseLogistics.findOne({ _id: req.params.id, company: req.user.company });
        if (!item) {
            return res.status(404).json({ message: 'Item de logística reversa não localizado.' });
        }

        const { analyzeEsgTriageWithGemini } = require('../services/geminiService');
        const triageResult = await analyzeEsgTriageWithGemini({
            productName: item.productName,
            sku: item.sku,
            issueType: item.issueType,
            observations: item.observations,
            quantity: item.quantity
        });

        return res.status(200).json({
            message: 'Avaliação ecológica via Google Gemini concluída com sucesso!',
            item: {
                id: item._id,
                productName: item.productName,
                sku: item.sku
            },
            geminiTriage: triageResult
        });
    } catch (error) {
        console.error('[Gemini ESG Triage Error]:', error);
        return res.status(500).json({ message: 'Falha ao processar triagem com IA.', error: error.message });
    }
};