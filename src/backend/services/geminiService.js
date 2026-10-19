const { GoogleGenAI } = require('@google/genai');

/**
 * 🤖 STOCKVISION - SERVIÇO DE INTELIGÊNCIA ARTIFICIAL GOOGLE GEMINI
 * Modelo Recomendado: gemini-3.8-flash
 * Fornece previsões preditivas de demanda e análise ecológica para Logística Reversa / ESG.
 */

let geminiClient = null;

const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return null;
    }
    if (!geminiClient) {
        geminiClient = new GoogleGenAI({ apiKey });
    }
    return geminiClient;
};

/**
 * 📈 1. PREVISÃO PREDITIVA DE DEMANDA E REABASTECIMENTO INTELIGENTE
 */
exports.predictDemandWithGemini = async ({ productName, sku, category, salesHistory, currentStock, leadTimeDays }) => {
    const client = getGeminiClient();
    const historyStr = Array.isArray(salesHistory) ? salesHistory.join(', ') : '0, 0, 0';
    const sumSales = Array.isArray(salesHistory) ? salesHistory.reduce((a, b) => a + b, 0) : 0;
    const avgSales = Math.round(sumSales / 3) || 10;

    // Se a chave não estiver configurada, usa o motor analítico heurístico avançado
    if (!client) {
        const trend = (salesHistory[2] || 0) > (salesHistory[0] || 0) ? 1.15 : 0.95;
        const predictedDemand = Math.round(avgSales * trend);
        const safetyStock = Math.round((leadTimeDays / 7) * (avgSales * 0.4));
        const suggestedPurchase = Math.max(0, (predictedDemand + safetyStock) - currentStock);

        return {
            source: 'Heurística Estatística (Configure GEMINI_API_KEY para ativação de IA generativa)',
            predictedDemand,
            safetyStock,
            suggestedPurchase,
            confidence: 88,
            analysisText: `Baseado no histórico de saídas [${historyStr}], a média móvel trimestral é de ${avgSales} un/mês com lead time de ${leadTimeDays} dias. Recomenda-se reposição de ${suggestedPurchase} unidades para mitigar risco de ruptura.`
        };
    }

    try {
        const prompt = `Você é um Engenheiro de Logística e Supply Chain especialista em WMS.
Analise os seguintes dados do produto para prever a demanda do próximo mês:
- Produto: "${productName}" (SKU: ${sku}, Categoria: ${category})
- Histórico de vendas dos últimos 3 meses: [${historyStr}]
- Saldo atual em estoque: ${currentStock} unidades
- Lead time do fornecedor: ${leadTimeDays} dias

Responda ESTRITAMENTE em formato JSON puro, sem marcações markdown adicionais, com o seguinte formato:
{
  "predictedDemand": number,
  "safetyStock": number,
  "suggestedPurchase": number,
  "confidence": number,
  "analysisText": "string com justificativa concisa e técnica de supply chain"
}`;

        const response = await client.interactions.create({
            model: 'gemini-3.8-flash',
            input: prompt
        });

        const rawText = (response.output_text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(rawText);

        return {
            source: 'Google Gemini (gemini-3.8-flash)',
            predictedDemand: Number(parsed.predictedDemand) || avgSales,
            safetyStock: Number(parsed.safetyStock) || Math.round(avgSales * 0.3),
            suggestedPurchase: Number(parsed.suggestedPurchase) || Math.max(0, avgSales - currentStock),
            confidence: Number(parsed.confidence) || 94,
            analysisText: parsed.analysisText || 'Previsão gerada com sucesso pelo Google Gemini.'
        };
    } catch (error) {
        console.warn('[Gemini API Warning]:', error.message, '- Utilizando fallback preditivo.');
        return {
            source: 'Fallback Preditivo Local (Erro na chamada Gemini)',
            predictedDemand: avgSales,
            safetyStock: Math.round(avgSales * 0.25),
            suggestedPurchase: Math.max(0, (avgSales * 1.2) - currentStock),
            confidence: 80,
            analysisText: `Média móvel calculada localmente em virtude de oscilação na API externa: ${error.message}`
        };
    }
};

/**
 * ♻️ 2. ANÁLISE ECOLÓGICA E TRIAGEM INTELIGENTE ESG (LOGÍSTICA REVERSA)
 */
exports.analyzeEsgTriageWithGemini = async ({ productName, sku, issueType, observations, quantity }) => {
    const client = getGeminiClient();

    if (!client) {
        let suggestedDestination = 'Reaproveitamento';
        let rationale = 'Item apto para recondicionamento ou doação com baixo impacto ecológico.';

        const obsLower = (observations || '').toLowerCase();
        if (issueType === 'Defeituoso' || obsLower.includes('eletrônico') || obsLower.includes('metal')) {
            suggestedDestination = 'Reciclagem';
            rationale = 'Contém componentes desmontáveis e matérias-primas nobres passíveis de reciclagem industrial.';
        } else if (issueType === 'Vencido' || obsLower.includes('tóxico') || obsLower.includes('químico')) {
            suggestedDestination = 'Descarte Sustentável';
            rationale = 'Resíduo perigoso ou com prazo legal expirado. Exige coprocessamento ou incineração ecológica licenciada.';
        }

        return {
            source: 'Heurística Especialista ESG (Configure GEMINI_API_KEY)',
            suggestedDestination,
            carbonReductionKg: (quantity * 1.45).toFixed(2),
            rationale
        };
    }

    try {
        const prompt = `Você é um Consultor Especialista em Sustentabilidade Corporativa (ESG), Economia Circular e Resíduos Sólidos (PNRS).
Analise o material descartado / avariado na logística reversa:
- Produto: "${productName}" (SKU: ${sku})
- Quantidade: ${quantity} unidades
- Tipo de Ocorrência: "${issueType}"
- Observações do Operador: "${observations || 'Nenhuma'}"

Determine o destino ecológico mais adequado dentre as opções:
1. "Reciclagem"
2. "Reaproveitamento"
3. "Descarte Sustentável"

Responda ESTRITAMENTE em formato JSON puro, sem blocos markdown:
{
  "suggestedDestination": "Reciclagem | Reaproveitamento | Descarte Sustentável",
  "carbonReductionKg": number,
  "rationale": "Justificativa ambiental concisa baseada em normas ESG e economia circular"
}`;

        const response = await client.interactions.create({
            model: 'gemini-3.8-flash',
            input: prompt
        });

        const rawText = (response.output_text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(rawText);

        return {
            source: 'Google Gemini (gemini-3.8-flash)',
            suggestedDestination: parsed.suggestedDestination || 'Reciclagem',
            carbonReductionKg: Number(parsed.carbonReductionKg) || (quantity * 1.2),
            rationale: parsed.rationale || 'Destinação ecológica recomendada via Google Gemini.'
        };
    } catch (error) {
        console.warn('[Gemini ESG Warning]:', error.message);
        return {
            source: 'Fallback Heurístico ESG',
            suggestedDestination: 'Reciclagem',
            carbonReductionKg: (quantity * 1.2).toFixed(2),
            rationale: 'Classificado automaticamente para triagem ecológica e reciclagem de materiais.'
        };
    }
};
