const Product = require('../models/Product');
const ReverseLogistics = require('../models/ReverseLogistics');

/**
 * 📊 CONTROLADOR ANALÍTICO DO DASHBOARD EXECUTIVO
 * Agrega métricas financeiras, produtos mais vendidos (giro),
 * alertas de baixo giro/dead stock e resumo de sustentabilidade ESG.
 */
exports.getDashboardAnalytics = async (req, res) => {
    try {
        const companyName = req.user.company;

        // 1. Coleta todos os produtos e itens de logística reversa da empresa logada
        const [products, reverseItems] = await Promise.all([
            Product.find({ company: companyName }),
            ReverseLogistics.find({ company: companyName })
        ]);

        // 2. Métricas Financeiras Consolidadas
        let totalRevenue = 0;
        let totalCosts = 0;
        let totalItemsVolume = 0;

        const deadStockList = [];
        const excessStockList = [];
        const lossAlertsList = [];
        const ruptureList = [];
        const lowStockList = [];

        const now = new Date();
        const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        let nearExpirationCount = 0;

        // Processa cada produto para agregação financeira e categorização de risco
        const processedProducts = products.map(p => {
            const qty = p.quantityInStock || 0;
            const price = p.sellingPrice || 0;
            const cost = p.acquisitionCost || 0;
            const min = p.minimumStock || 0;
            const max = p.maximumStock || 0;

            const productRevenue = price * qty;
            const productCost = cost * qty;
            totalRevenue += productRevenue;
            totalCosts += productCost;
            totalItemsVolume += qty;

            const unitProfit = price - cost;
            const unitMargin = cost > 0 ? ((unitProfit / cost) * 100).toFixed(1) : '100.0';
            const isLossAlert = price <= cost;

            // Histórico de vendas dos últimos 3 meses
            const salesArray = Array.isArray(p.salesHistory) && p.salesHistory.length > 0 ? p.salesHistory : [0, 0, 0];
            const totalSold = salesArray.reduce((acc, val) => acc + (val || 0), 0);
            const monthlyAvgSales = totalSold / 3;

            // Alertas Críticos Operacionais
            if (isLossAlert) {
                lossAlertsList.push({
                    id: p._id,
                    name: p.name,
                    sku: p.sku || 'N/A',
                    price,
                    cost,
                    unitMargin,
                    quantity: qty,
                    type: 'Prejuízo Operacional',
                    badgeColor: 'rose',
                    reason: `Venda (R$ ${price.toFixed(2)}) <= Custo (R$ ${cost.toFixed(2)})`
                });
            }

            if (qty === 0) {
                ruptureList.push({
                    id: p._id,
                    name: p.name,
                    sku: p.sku || 'N/A',
                    quantity: 0,
                    minimumStock: min,
                    type: 'Ruptura Total',
                    badgeColor: 'red',
                    reason: 'Estoque zerado no centro de distribuição'
                });
            } else if (qty <= min) {
                lowStockList.push({
                    id: p._id,
                    name: p.name,
                    sku: p.sku || 'N/A',
                    quantity: qty,
                    minimumStock: min,
                    type: 'Estoque Baixo',
                    badgeColor: 'amber',
                    reason: `Saldo (${qty} un) abaixo ou no limite mínimo (${min} un)`
                });
            } else if (max > 0 && qty > max) {
                excessStockList.push({
                    id: p._id,
                    name: p.name,
                    sku: p.sku || 'N/A',
                    quantity: qty,
                    maximumStock: max,
                    excessUnits: qty - max,
                    type: 'Excesso de Estoque',
                    badgeColor: 'orange',
                    reason: `Saldo (${qty} un) acima da capacidade máxima (${max} un)`
                });
            }

            // Alerta de Baixo Giro / Estoque Parado (Dead Stock)
            if (totalSold === 0 && qty > 0) {
                deadStockList.push({
                    id: p._id,
                    name: p.name,
                    sku: p.sku || 'N/A',
                    quantity: qty,
                    totalValue: productRevenue,
                    type: 'Estoque Parado (Dead Stock)',
                    badgeColor: 'slate',
                    reason: 'Nenhuma saída registrada nos últimos 3 meses'
                });
            }

            // Vencimento próximo
            if (!p.isIndeterminateExpiration && p.expirationDate) {
                const exp = new Date(p.expirationDate);
                if (exp >= now && exp <= sixtyDaysFromNow) {
                    nearExpirationCount++;
                }
            }

            return {
                id: p._id,
                name: p.name,
                sku: p.sku || 'N/A',
                category: p.category || 'Geral',
                sellingPrice: price,
                acquisitionCost: cost,
                quantityInStock: qty,
                minimumStock: min,
                maximumStock: max,
                unitMargin,
                unitProfit,
                isLossAlert,
                totalSold,
                monthlyAvgSales: Math.round(monthlyAvgSales),
                revenueGenerated: totalSold * price,
                stockTurnoverRate: qty > 0 ? (totalSold / qty).toFixed(2) : '0.00'
            };
        });

        // 3. Ranking dos Top 5 Produtos Mais Vendidos (Giro de Vendas)
        const bestSellers = [...processedProducts]
            .sort((a, b) => b.totalSold - a.totalSold || b.revenueGenerated - a.revenueGenerated)
            .slice(0, 5)
            .map((item, index) => ({
                rank: index + 1,
                id: item.id,
                name: item.name,
                sku: item.sku,
                category: item.category,
                totalSold: item.totalSold,
                monthlyAvgSales: item.monthlyAvgSales,
                revenueGenerated: item.revenueGenerated,
                unitMargin: item.unitMargin,
                quantityInStock: item.quantityInStock
            }));

        // 4. Métricas Financeiras Consolidadas
        const estimatedProfit = totalRevenue - totalCosts;
        const grossMarginPercent = totalRevenue > 0 ? ((estimatedProfit / totalRevenue) * 100).toFixed(1) : '0.0';

        // 5. Resumo ESG & Sustentabilidade
        const totalCommercialQty = totalItemsVolume;
        const totalLossQty = reverseItems.reduce((acc, item) => acc + (item.quantity || 0), 0);
        const recycledQty = reverseItems
            .filter(item => item.destinationStatus === 'Reciclagem' || item.destinationStatus === 'Reaproveitamento')
            .reduce((acc, item) => acc + (item.quantity || 0), 0);

        const totalOperatedVolume = totalCommercialQty + totalLossQty;
        const wasteRate = totalOperatedVolume > 0 ? ((totalLossQty / totalOperatedVolume) * 100).toFixed(1) : '0.0';
        const recyclingRate = totalLossQty > 0 ? ((recycledQty / totalLossQty) * 100).toFixed(1) : '0.0';

        // 6. Linha do Tempo dos Gráficos (Simulação Dinâmica Baseada em Dados Reais)
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
        const baseRev = Math.max(totalRevenue, 1000);
        const baseCost = Math.max(totalCosts, 600);

        const timeline = {
            months,
            revenue: months.map((_, i) => Math.round(baseRev * (0.65 + i * 0.07))),
            costs: months.map((_, i) => Math.round(baseCost * (0.58 + i * 0.05))),
            stockLevels: months.map((_, i) => Math.max(30, Math.round(totalItemsVolume * (0.85 + i * 0.03))))
        };

        // 7. Retorno Unificado da API
        return res.status(200).json({
            financials: {
                totalRevenue,
                totalCosts,
                estimatedProfit,
                grossMarginPercent,
                totalItemsVolume,
                totalProductsCount: products.length
            },
            bestSellers,
            alerts: {
                totalAlertsCount: deadStockList.length + excessStockList.length + lossAlertsList.length + ruptureList.length + lowStockList.length,
                lossAlerts: lossAlertsList,
                deadStock: deadStockList,
                excessStock: excessStockList,
                rupture: ruptureList,
                lowStock: lowStockList,
                allAlerts: [
                    ...lossAlertsList,
                    ...ruptureList,
                    ...lowStockList,
                    ...excessStockList,
                    ...deadStockList
                ]
            },
            esgSummary: {
                totalCommercialQty,
                totalLossQty,
                recycledQty,
                wasteRate: `${wasteRate}%`,
                recyclingRate: `${recyclingRate}%`,
                nearExpirationCount
            },
            historyTimeline: timeline
        });

    } catch (error) {
        console.error('[Dashboard Analytics Controller Error]:', error);
        return res.status(500).json({
            message: 'Erro interno ao processar indicadores executivos do dashboard.',
            error: error.message
        });
    }
};
