const test = require('node:test');
const assert = require('node:assert/strict');
const { predictDemandWithGemini, analyzeEsgTriageWithGemini } = require('../src/backend/services/geminiService');

test('Serviço de Inteligência Artificial Google Gemini', async (t) => {

    await t.test('predictDemandWithGemini deve retornar estrutura válida com projeção e justificativa', async () => {
        const result = await predictDemandWithGemini({
            productName: 'Cimento CP II 50kg',
            sku: 'CIM-01',
            category: 'Construção',
            salesHistory: [50, 60, 70],
            currentStock: 30,
            leadTimeDays: 7
        });

        assert.ok(result);
        assert.ok(typeof result.predictedDemand === 'number');
        assert.ok(typeof result.safetyStock === 'number');
        assert.ok(typeof result.suggestedPurchase === 'number');
        assert.ok(typeof result.confidence === 'number');
        assert.ok(typeof result.analysisText === 'string');
        assert.ok(result.analysisText.length > 10);
    });

    await t.test('analyzeEsgTriageWithGemini deve classificar destinação ecológica corretamente', async () => {
        const triageDefective = await analyzeEsgTriageWithGemini({
            productName: 'Placa Controladora Inversora',
            sku: 'ELE-09',
            issueType: 'Defeituoso',
            observations: 'Componente eletrônico com falha de circuito',
            quantity: 5
        });

        assert.ok(triageDefective);
        assert.equal(triageDefective.suggestedDestination, 'Reciclagem');
        assert.ok(triageDefective.carbonReductionKg > 0);
        assert.ok(typeof triageDefective.rationale === 'string');

        const triageExpired = await analyzeEsgTriageWithGemini({
            productName: 'Solvente Químico Industrial',
            sku: 'QUI-02',
            issueType: 'Vencido',
            observations: 'Item químico tóxico vencido',
            quantity: 10
        });

        assert.ok(triageExpired);
        assert.equal(triageExpired.suggestedDestination, 'Descarte Sustentável');
    });
});
