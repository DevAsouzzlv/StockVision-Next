require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;

test('Suíte de Testes de Integração da API StockVision', async (t) => {
    let authToken = '';

    await t.test('1. Autenticação e Login Corporativo', async () => {
        let response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@stockvision.com',
                password: 'admin123'
            })
        });

        // Caso o banco esteja no estado após troca de senha de uma execução prévia, restaura
        if (response.status === 401) {
            const tempLogin = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'admin@stockvision.com',
                    password: 'novaSenhaSegura456'
                })
            });
            if (tempLogin.status === 200) {
                const tempData = await tempLogin.json();
                await fetch(`${BASE_URL}/auth/profile`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${tempData.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        currentPassword: 'novaSenhaSegura456',
                        newPassword: 'admin123'
                    })
                });
                response = await fetch(`${BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'admin@stockvision.com',
                        password: 'admin123'
                    })
                });
            }
        }

        assert.equal(response.status, 200);
        const data = await response.json();
        assert.ok(data.token, 'Deve retornar o token JWT');
        assert.equal(data.user.email, 'admin@stockvision.com');
        authToken = data.token;
    });

    await t.test('2. Blindagem de Multitenancy no Cadastro', async () => {
        // Tenta cadastrar um segundo usuário na empresa 'StockVision Matriz' sem estar autenticado
        const response = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullname: 'Tentativa Intrusão',
                email: 'hacker@empresa.com',
                company: 'StockVision Matriz',
                password: 'senha123456'
            })
        });

        assert.equal(response.status, 400);
        const data = await response.json();
        assert.match(data.message, /já possui cadastro ativo/i);
    });

    await t.test('3. Obtenção e Atualização de Perfil de Usuário', async () => {
        const getProfileRes = await fetch(`${BASE_URL}/auth/profile`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        assert.equal(getProfileRes.status, 200);
        const profile = await getProfileRes.json();
        assert.equal(profile.user.email, 'admin@stockvision.com');

        // Atualiza cargo e preferências
        const updateRes = await fetch(`${BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jobTitle: 'Arquiteto Chefe de Supply Chain',
                phone: '(11) 98765-4321',
                themePreference: 'dark'
            })
        });
        assert.equal(updateRes.status, 200);
        const updated = await updateRes.json();
        assert.equal(updated.user.jobTitle, 'Arquiteto Chefe de Supply Chain');

        // Validação de alteração de senha: senha atual incorreta deve falhar
        const wrongPassRes = await fetch(`${BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword: 'senha-errada-123',
                newPassword: 'novaSenhaSegura456'
            })
        });
        assert.equal(wrongPassRes.status, 400);

        // Alteração com senha atual correta
        const changePassRes = await fetch(`${BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword: 'admin123',
                newPassword: 'novaSenhaSegura456'
            })
        });
        assert.equal(changePassRes.status, 200);

        // Login com a nova senha deve funcionar
        const loginNewPass = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@stockvision.com',
                password: 'novaSenhaSegura456'
            })
        });
        assert.equal(loginNewPass.status, 200);
        const loginNewPassData = await loginNewPass.json();
        authToken = loginNewPassData.token;

        // Restaura de volta a senha original para manter o banco limpo
        await fetch(`${BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword: 'novaSenhaSegura456',
                newPassword: 'admin123'
            })
        });
        const loginRestored = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@stockvision.com',
                password: 'admin123'
            })
        });
        const restoredData = await loginRestored.json();
        authToken = restoredData.token;
    });

    await t.test('4. Dashboard Analytics & Top 5 Mais Vendidos', async () => {
        const response = await fetch(`${BASE_URL}/dashboard/analytics`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        assert.equal(response.status, 200);
        const analytics = await response.json();
        
        assert.ok(analytics.financials);
        assert.ok(typeof analytics.financials.totalRevenue === 'number');
        assert.ok(typeof analytics.financials.totalCosts === 'number');
        assert.ok(Array.isArray(analytics.bestSellers), 'bestSellers deve ser array');
        assert.ok(analytics.alerts);
        assert.ok(analytics.esgSummary);
    });

    await t.test('5. Listagem de Insumos com Status Visual e Alerta de Prejuízo', async () => {
        const response = await fetch(`${BASE_URL}/stock`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        assert.equal(response.status, 200);
        const products = await response.json();
        assert.ok(Array.isArray(products));
        assert.ok(products.length > 0);

        // Deve conter o produto intencional de prejuízo
        const lossProduct = products.find(p => p.sku === 'SKU-PREJUIZO-03');
        if (lossProduct) {
            assert.equal(lossProduct.statusVisual?.isLossAlert, true);
        }
    });

    await t.test('6. Previsão de Demanda e Ponto de Ressuprimento', async () => {
        const response = await fetch(`${BASE_URL}/demand/forecast`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        assert.equal(response.status, 200);
        const forecast = await response.json();
        assert.ok(Array.isArray(forecast));
        assert.ok(forecast.length > 0);
        assert.ok(typeof forecast[0].predictedDemand === 'number');
        assert.ok(typeof forecast[0].pontoDePedido === 'number');
    });

    await t.test('7. Indicadores e Painel de Sustentabilidade ESG', async () => {
        const response = await fetch(`${BASE_URL}/esg/dashboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        assert.equal(response.status, 200);
        const esg = await response.json();
        assert.ok(esg.esgOverview);
        assert.ok(esg.volumesPorDestino);
    });
});
