const Product = require('../models/Product');

/**
 * 📊 MOTOR DE CÁLCULO LOGÍSTICO & FINANCEIRO
 * Centraliza as regras de criticidade física (WMS) e de saúde financeira (Alerta de Prejuízo).
 */
const calculateVisualStatus = (quantity, min, max, cost = 0, price = 0) => {
    // 1. Diagnóstico de Saúde Financeira (Alerta de Prejuízo)
    const hasFinancialLoss = price > 0 && cost > 0 && price <= cost;
    const unitMargin = price > 0 ? parseFloat((((price - cost) / price) * 100).toFixed(1)) : 0;
    const unitProfit = parseFloat((price - cost).toFixed(2));

    // 2. Diagnóstico de Capacidade Física no Armazém
    let alertColor = 'green';
    let statusTag = 'Normal';

    if (quantity <= 0) {
        alertColor = 'red';
        statusTag = 'Ruptura';
    } else if (quantity < min) {
        alertColor = 'red';
        statusTag = 'Estoque Baixo';
    } else if (quantity > max) {
        alertColor = 'orange';
        statusTag = 'Excesso';
    }

    return {
        alertColor,
        statusTag,
        isLossAlert: hasFinancialLoss,
        lossReason: hasFinancialLoss 
            ? `Prejuízo Operacional: Preço de venda (R$ ${price.toFixed(2)}) abaixo ou igual ao custo de aquisição (R$ ${cost.toFixed(2)}) [Margem: ${unitMargin}%]`
            : null,
        unitMargin,
        unitProfit
    };
};

/**
 * 📦 LISTAR PRODUTOS (GET -> /api/stock)
 */
exports.listProducts = async (req, res) => {
    try {
        // Aplica o isolamento corporativo (Multitenancy)
        const products = await Product.find({ company: req.user.company });
        
        // Mapeia os produtos injetando o status visual e financeiro calibrado em tempo de execução
        const mappedProducts = products.map(p => {
            const prodObj = p.toObject();
            prodObj.statusVisual = calculateVisualStatus(
                prodObj.quantityInStock,
                prodObj.minimumStock,
                prodObj.maximumStock,
                prodObj.acquisitionCost,
                prodObj.sellingPrice
            );
            return prodObj;
        });

        return res.status(200).json(mappedProducts);
    } catch (error) {
        console.error('[Controller Stock - List Error]:', error.message);
        return res.status(500).json({ message: 'Erro interno ao listar inventário.', error: error.message });
    }
};

/**
 * 📥 CADASTRAR PRODUTO (POST -> /api/stock)
 */
exports.createProduct = async (req, res) => {
    try {
        const { name, category, acquisitionCost, sellingPrice, quantityInStock, minimumStock, maximumStock, isIndeterminateExpiration, expirationDate, location, barcode } = req.body;

        const costNum = parseFloat(acquisitionCost) || 0;
        const priceNum = parseFloat(sellingPrice) || 0;
        const minNum = parseInt(minimumStock, 10) || 0;
        const maxNum = parseInt(maximumStock, 10) || 0;
        const qtyNum = parseInt(quantityInStock, 10) || 0;

        if (minNum > maxNum) {
            return res.status(400).json({ message: 'Validação inválida: O estoque mínimo não pode ser superior ao estoque máximo.' });
        }

        if (costNum < 0 || priceNum < 0 || qtyNum < 0) {
            return res.status(400).json({ message: 'Valores de custo, preço e estoque não podem ser negativos.' });
        }

        // Geração de SKU incremental baseado em Timestamp para simulação de código de barras
        const generatedSku = `SKU-${Date.now()}`;

        const newProduct = new Product({
            company: req.user.company, // Vincula à empresa do token logado
            sku: generatedSku,
            barcode: barcode || generatedSku,
            name,
            category,
            acquisitionCost: costNum,
            sellingPrice: priceNum,
            quantityInStock: qtyNum,
            minimumStock: minNum,
            maximumStock: maxNum,
            isIndeterminateExpiration,
            expirationDate: isIndeterminateExpiration ? null : expirationDate,
            location
        });

        await newProduct.save();

        const prodObj = newProduct.toObject();
        prodObj.statusVisual = calculateVisualStatus(prodObj.quantityInStock, prodObj.minimumStock, prodObj.maximumStock, prodObj.acquisitionCost, prodObj.sellingPrice);

        return res.status(201).json({ message: 'Insumo lançado e endereçado com sucesso no armazém!', product: prodObj });
    } catch (error) {
        console.error('[Controller Stock - Create Error]:', error.message);
        return res.status(400).json({ message: 'Falha ao processar lançamento.', error: error.message });
    }
};

/**
 * 🔄 ATUALIZAR PRODUTO (PUT -> /api/stock/:id)
 * Valida consistência de mínimos, máximos e preços, protegendo multitenancy
 */
exports.updateProduct = async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, company: req.user.company });
        if (!product) {
            return res.status(404).json({ message: 'Material não localizado ou acesso não autorizado.' });
        }

        const updates = req.body;
        const newMin = typeof updates.minimumStock !== 'undefined' ? parseInt(updates.minimumStock, 10) : product.minimumStock;
        const newMax = typeof updates.maximumStock !== 'undefined' ? parseInt(updates.maximumStock, 10) : product.maximumStock;
        const newCost = typeof updates.acquisitionCost !== 'undefined' ? parseFloat(updates.acquisitionCost) : product.acquisitionCost;
        const newPrice = typeof updates.sellingPrice !== 'undefined' ? parseFloat(updates.sellingPrice) : product.sellingPrice;

        if (newMin > newMax) {
            return res.status(400).json({ message: 'Validação inválida: O estoque mínimo não pode ser superior ao estoque máximo.' });
        }

        if (newCost < 0 || newPrice < 0) {
            return res.status(400).json({ message: 'Custo de aquisição e preço de venda não podem ser negativos.' });
        }

        Object.assign(product, updates);
        await product.save();

        const prodObj = product.toObject();
        prodObj.statusVisual = calculateVisualStatus(prodObj.quantityInStock, prodObj.minimumStock, prodObj.maximumStock, prodObj.acquisitionCost, prodObj.sellingPrice);

        return res.status(200).json({
            message: 'Parâmetros logísticos consolidados com sucesso!',
            product: prodObj
        });
    } catch (error) {
        console.error('[Controller Stock - Update Error]:', error.message);
        return res.status(400).json({ message: 'Erro ao atualizar material.', error: error.message });
    }
};

/**
 * 🗑️ REMOVER PRODUTO (DELETE -> /api/stock/:id)
 */
exports.deleteProduct = async (req, res) => {
    try {
        const deletedProduct = await Product.findOneAndDelete({ _id: req.params.id, company: req.user.company });
        if (!deletedProduct) {
            return res.status(404).json({ message: 'Produto não localizado para exclusão.' });
        }
        return res.status(200).json({ message: 'Material removido permanentemente do inventário!' });
    } catch (error) {
        console.error('[Controller Stock - Delete Error]:', error.message);
        return res.status(500).json({ message: 'Erro interno ao remover material.', error: error.message });
    }
};

/**
 * 📈 INDICADORES DO DASHBOARD (GET -> /api/stock/metrics)
 */
const buildDashboardTimeline = (totalRevenue, totalCosts, totalItemsVolume) => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    const revenueBase = Math.max(totalRevenue, 1000);
    const costBase = Math.max(totalCosts, 600);

    return {
        months,
        revenue: months.map((_, index) => Math.round(revenueBase * (0.7 + index * 0.08))),
        costs: months.map((_, index) => Math.round(costBase * (0.6 + index * 0.06))),
        stockLevels: months.map((_, index) => Math.max(30, totalItemsVolume + index * 8))
    };
};

exports.buildDashboardTimeline = buildDashboardTimeline;

exports.getDashboardMetrics = async (req, res) => {
    try {
        const products = await Product.find({ company: req.user.company });

        let totalRevenue = 0;
        let totalCosts = 0;
        let totalItemsVolume = 0;

        products.forEach(p => {
            totalRevenue += (p.sellingPrice * p.quantityInStock);
            totalCosts += (p.acquisitionCost * p.quantityInStock);
            totalItemsVolume += p.quantityInStock;
        });

        const estimatedProfit = totalRevenue - totalCosts;

        return res.status(200).json({
            financials: {
                totalRevenue,
                totalCosts,
                estimatedProfit
            },
            indicators: {
                stockLevel: totalItemsVolume
            },
            historyTimeline: buildDashboardTimeline(totalRevenue, totalCosts, totalItemsVolume)
        });
    } catch (error) {
        console.error('[Controller Stock - Metrics Error]:', error.message);
        return res.status(500).json({ message: 'Erro ao consolidar indicadores logísticos.', error: error.message });
    }
};

/**
 * ♻️ ALERTAS ESG VENCIMENTOS (GET -> /api/esg/expiration-alerts)
 */
exports.getExpirationAlerts = async (req, res) => {
    try {
        // Busca apenas produtos com validade estrita da empresa logada
        const products = await Product.find({ 
            company: req.user.company, 
            isIndeterminateExpiration: false,
            expirationDate: { $ne: null }
        });

        const activeAlerts = [];
        const today = new Date();

        products.forEach(p => {
            const expDate = new Date(p.expirationDate);
            const timeDiff = expDate.getTime() - today.getTime();
            const diasRestantes = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

            // Filtro ecológico: Janela crítica de risco de descarte (vence em até 6 meses / 180 dias)
            if (diasRestantes <= 180 && diasRestantes > 0) {
                activeAlerts.push({
                    productId: p._id,
                    productName: p.name,
                    sku: p.sku,
                    quantity: p.quantityInStock,
                    diasRestantes: diasRestantes
                });
            }
        });

        // Ordena do mais urgente para o menos urgente
        activeAlerts.sort((a, b) => a.diasRestantes - b.diasRestantes);

        return res.status(200).json({ alerts: activeAlerts });
    } catch (error) {
        console.error('[Controller ESG - Alerts Error]:', error.message);
        return res.status(500).json({ message: 'Erro ao processar análise preditiva ESG.', error: error.message });
    }
};

/**
 * 📥 IMPORTAÇÃO AUTOMÁTICA EM LOTE VIA XML DE NOTA FISCAL (NF-e)
 * POST -> /api/stock/invoice/xml
 */
exports.importInvoiceXml = async (req, res) => {
    try {
        const { xmlData } = req.body;

        if (!xmlData || xmlData.trim() === '') {
            return res.status(400).json({ message: 'Conteúdo XML inválido ou vazio.' });
        }

        // Extração do Nome do Fornecedor (Tag <xNome> interna ao bloco <emit>)
        const emitNomeMatch = xmlData.match(/<emit>[\s\S]*?<xNome>([\s\S]*?)<\/xNome>/);
        const supplierName = emitNomeMatch ? emitNomeMatch[1].trim() : "Fornecedor XML";

        // Auto-cadastro do Fornecedor caso não exista no banco
        const Partner = require('../models/Partner');
        const cnpjMatch = xmlData.match(/<emit>[\s\S]*?<CNPJ>([\s\S]*?)<\/CNPJ>/);
        const cnpj = cnpjMatch ? cnpjMatch[1].trim() : '';
        const foneMatch = xmlData.match(/<emit>[\s\S]*?<fone>([\s\S]*?)<\/fone>/);
        const phone = foneMatch ? foneMatch[1].trim() : '(11) 99999-9999';
        const emailMatch = xmlData.match(/<emit>[\s\S]*?<email>([\s\S]*?)<\/email>/) || xmlData.match(/<email>([\s\S]*?)<\/email>/);
        const email = emailMatch ? emailMatch[1].trim() : `contato@${supplierName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'fornecedor'}.com.br`;

        let partner = await Partner.findOne({ companyName: supplierName, company: req.user.company });
        let supplierRegistered = false;

        if (!partner) {
            partner = new Partner({
                company: req.user.company,
                companyName: supplierName,
                phone: phone,
                email: email,
                paymentCondition: 'Boleto',
                deliveryDays: 7,
                priceTier: 'Médio',
                categorySupplied: 'Importado via NF-e'
            });
            await partner.save();
            supplierRegistered = true;
        }

        // Isolamento de todos os blocos de produtos detalhados (<det>)
        const productBlocks = xmlData.match(/<det nItem=".*?">[\s\S]*?<\/det>/g);

        if (!productBlocks || productBlocks.length === 0) {
            return res.status(400).json({ message: 'Nenhum produto estruturado no padrão NF-e (<det>) foi localizado no XML.' });
        }

        const processedItems = [];

        for (const block of productBlocks) {
            const nameMatch = block.match(/<xProd>([\s\S]*?)<\/xProd>/);
            const qtyMatch = block.match(/<qCom>([\s\S]*?)<\/qCom>/);
            const priceMatch = block.match(/<vUnCom>([\s\S]*?)<\/vUnCom>/);

            if (nameMatch && qtyMatch && priceMatch) {
                const name = nameMatch[1].trim();
                const quantity = Math.ceil(parseFloat(qtyMatch[1]));
                const costPrice = parseFloat(priceMatch[1]);
                const sellingPrice = parseFloat((costPrice * 1.5).toFixed(2)); // Sugestão didática: 50% de markup

                let product = await Product.findOne({ name: name, company: req.user.company });

                if (product) {
                    // Se o item já existir: soma o estoque e atualiza parâmetros mercantis
                    product.quantityInStock += quantity;
                    product.acquisitionCost = costPrice;
                    product.sellingPrice = sellingPrice;
                    product.supplier = supplierName;
                    await product.save();
                    processedItems.push({ name, action: `Estoque Incrementado (+${quantity} un)` });
                } else {
                    // Se for novo: instancia e aloca na Doca de conferência padrão WMS
                    const generatedSku = `SKU-XML-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    product = new Product({
                        company: req.user.company,
                        sku: generatedSku,
                        name: name,
                        category: "Importado via NF-e",
                        acquisitionCost: costPrice,
                        sellingPrice: sellingPrice,
                        quantityInStock: quantity,
                        minimumStock: Math.ceil(quantity * 0.3), // Margem padrão didática de 30%
                        maximumStock: Math.ceil(quantity * 2),
                        supplier: supplierName,
                        isIndeterminateExpiration: true,
                        location: {
                            sector: "RECEBIMENTO",
                            row: "DOCA 01",
                            building: "CONFERENCIA",
                            floor: "NIVEL 0",
                            apartment: "PALLET-TRIAGEM"
                        }
                    });
                    await product.save();
                    processedItems.push({ name, action: `Novo Produto Cadastrado e Endereçado (${quantity} un)` });
                }
            }
        }

        return res.status(200).json({
            message: `Nota Fiscal do fornecedor "${supplierName}" processada com sucesso!`,
            summary: processedItems,
            supplierName,
            supplierRegistered
        });

    } catch (error) {
        console.error('[Controller Stock - XML Import Error]:', error.message);
        return res.status(500).json({ message: 'Erro crítico ao realizar o parse estrutural da NF-e.', error: error.message });
    }
};