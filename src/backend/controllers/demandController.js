const Product = require('../models/Product');
const { predictDemandWithGemini } = require('../services/geminiService');

/**
 * 🔮 MOTOR DE PREVISÃO DE DEMANDA COM IA & HISTÓRICO
 * GET -> /api/demand/forecast
 */
exports.getDemandForecast = async (req, res) => {
    try {
        const products = await Product.find({ company: req.user.company });
        
        const forecastReport = products.map(p => {
            const history = Array.isArray(p.salesHistory) && p.salesHistory.length > 0 ? p.salesHistory : [0, 0, 0];
            
            // Algoritmo de Média Móvel Ponderada (Pesos 1, 2, 3)
            const weight1 = history[0] || 0;
            const weight2 = history[1] || 0;
            const weight3 = history[2] || 0;
            const totalWeights = 1 + 2 + 3;
            const predictedDemandNextMonth = Math.ceil(((weight1 * 1) + (weight2 * 2) + (weight3 * 3)) / totalWeights);

            // Consumo Diário Previsto
            const dailyConsumptionPrevisto = predictedDemandNextMonth / 30;

            // Ponto de Pedido (PP = Consumo Diário * Lead Time + Estoque Mínimo)
            const leadTime = p.leadTimeDays || 7;
            const pontoDePedido = Math.ceil((dailyConsumptionPrevisto * leadTime) + (p.minimumStock || 0));

            // Giro de Estoque Estimado
            const estoqueMedio = ((p.maximumStock || 0) + (p.minimumStock || 0)) / 2 || 1;
            const giroEstoque = parseFloat((predictedDemandNextMonth / estoqueMedio).toFixed(2));

            // Decisão Preditiva de Compra
            const statusCritico = p.quantityInStock <= pontoDePedido;
            let sugestaoCompraQtd = 0;
            let acaoRecomendada = "Estoque Equilibrado";

            if (statusCritico) {
                sugestaoCompraQtd = Math.max(0, (p.maximumStock || 0) - p.quantityInStock);
                acaoRecomendada = "🚨 Emitir Ordem de Compra Urgente";
            } else if (p.quantityInStock < pontoDePedido * 1.25) {
                acaoRecomendada = "⚠️ Atenção: Monitorar Próxima Semana";
            }

            const investimentoEstimado = sugestaoCompraQtd * (p.acquisitionCost || 0);

            return {
                _id: p._id,
                name: p.name,
                sku: p.sku || 'N/A',
                category: p.category || 'Geral',
                supplier: p.supplier || 'Não Mapeado',
                quantityInStock: p.quantityInStock,
                minimumStock: p.minimumStock,
                maximumStock: p.maximumStock,
                acquisitionCost: p.acquisitionCost,
                pontoDePedido: pontoDePedido,
                giroEstoque: giroEstoque,
                predictedDemand: predictedDemandNextMonth,
                sugestaoCompra: sugestaoCompraQtd,
                investimentoEstimado: investimentoEstimado,
                investimentoEstimated: investimentoEstimado,
                leadTimeDays: leadTime,
                salesHistory: history,
                acao: acaoRecomendada,
                criticidade: statusCritico ? "danger" : (p.quantityInStock < pontoDePedido * 1.25 ? "warning" : "success")
            };
        });

        return res.status(200).json(forecastReport);
    } catch (error) {
        console.error('[Controller Demand - Forecast Error]:', error.message);
        return res.status(500).json({ message: 'Erro ao processar modelo preditivo.', error: error.message });
    }
};

/**
 * 🤖 GERAÇÃO DE INSIGHT COM GOOGLE GEMINI EM TEMPO REAL
 * POST -> /api/demand/gemini-insight/:id
 */
exports.generateGeminiProductInsight = async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, company: req.user.company });
        if (!product) {
            return res.status(404).json({ message: 'Insumo não localizado no inventário.' });
        }

        const insight = await predictDemandWithGemini({
            productName: product.name,
            sku: product.sku,
            category: product.category,
            salesHistory: product.salesHistory,
            currentStock: product.quantityInStock,
            leadTimeDays: product.leadTimeDays || 7
        });

        return res.status(200).json({
            message: 'Análise de inteligência artificial concluída com sucesso!',
            product: {
                id: product._id,
                name: product.name,
                sku: product.sku
            },
            geminiInsight: insight
        });
    } catch (error) {
        console.error('[Gemini Insight Error]:', error);
        return res.status(500).json({ message: 'Erro ao gerar análise preditiva com Gemini.', error: error.message });
    }
};

/**
 * 🛠️ INJETAR DADOS DE SUCESSO (STUB DE SIMULAÇÃO DIDÁTICA)
 * POST -> /api/demand/mock-history/:id
 */
exports.injectMockHistory = async (req, res) => {
    try {
        const { salesHistory, leadTimeDays } = req.body;
        const updated = await Product.findOneAndUpdate(
            { _id: req.params.id, company: req.user.company },
            { $set: { salesHistory, leadTimeDays } },
            { new: true }
        );
        if (!updated) return res.status(404).json({ message: 'Produto não encontrado.' });
        return res.status(200).json({ message: 'Dados de IA injetados com sucesso para o produto!', product: updated });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};