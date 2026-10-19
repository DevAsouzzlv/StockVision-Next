const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateVisualStatus } = require('../src/backend/controllers/stockController');

test('Cálculo de Status Logístico e Alertas de Prejuízo', async (t) => {
    
    await t.test('Deve retornar status Normal quando saldo estiver entre mínimo e máximo com lucro', () => {
        const status = calculateVisualStatus(50, 10, 100, 20.00, 35.00);
        assert.equal(status.statusTag, 'Normal');
        assert.equal(status.alertColor, 'green');
        assert.equal(status.isLossAlert, false);
        assert.equal(status.lossReason, null);
        assert.equal(status.unitProfit, 15.00);
        assert.equal(status.unitMargin, 42.9);
    });

    await t.test('Deve detectar Alerta de Prejuízo quando preço de venda for menor que custo', () => {
        const status = calculateVisualStatus(50, 10, 100, 50.00, 30.00);
        assert.equal(status.isLossAlert, true);
        assert.match(status.lossReason, /Prejuízo Operacional/);
        assert.equal(status.unitProfit, -20.00);
        assert.ok(status.unitMargin < 0);
    });

    await t.test('Deve detectar Alerta de Prejuízo quando preço de venda for igual ao custo (margem 0%)', () => {
        const status = calculateVisualStatus(50, 10, 100, 45.00, 45.00);
        assert.equal(status.isLossAlert, true);
        assert.equal(status.unitProfit, 0.00);
        assert.equal(status.unitMargin, 0.0);
    });

    await t.test('Deve acusar Ruptura quando saldo for zero ou negativo', () => {
        const status = calculateVisualStatus(0, 10, 100, 10.00, 20.00);
        assert.equal(status.statusTag, 'Ruptura');
        assert.equal(status.alertColor, 'red');
    });

    await t.test('Deve acusar Estoque Baixo quando saldo for menor que o mínimo', () => {
        const status = calculateVisualStatus(5, 10, 100, 10.00, 20.00);
        assert.equal(status.statusTag, 'Estoque Baixo');
        assert.equal(status.alertColor, 'red');
    });

    await t.test('Deve acusar Excesso quando saldo for maior que o estoque máximo', () => {
        const status = calculateVisualStatus(150, 10, 100, 10.00, 20.00);
        assert.equal(status.statusTag, 'Excesso');
        assert.equal(status.alertColor, 'orange');
    });
});
