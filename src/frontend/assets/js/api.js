/**
 * STOCKVISION - CENTRAL DE COMUNICAÇÃO COM A API (fetch)
 * Este arquivo centraliza todas as chamadas HTTP para o servidor Node.js.
 */

// const BASE_URL = 'http://localhost:3000/api';
const FALLBACK_BASE_URL = 'http://localhost:3000/api';
const BASE_URL = window.location.protocol === 'file:' ? FALLBACK_BASE_URL : `${window.location.origin}/api`;

// const BASE_URL = 'http://localhost:3000/api';

const safeJsonResponse = async (response) => {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
};

/**
 * 💾 GERENCIADOR DE SESSÃO LOCAL (LocalStorage)
 */
const TokenManager = {
    saveToken: (token) => localStorage.setItem('sv_token', token),
    getToken: () => localStorage.getItem('sv_token'),
    clearToken: () => localStorage.removeItem('sv_token'),
    saveUser: (user) => localStorage.setItem('sv_user', JSON.stringify(user)),
    getUser: () => JSON.parse(localStorage.getItem('sv_user')),
    clearAll: () => {
        localStorage.removeItem('sv_token');
        localStorage.removeItem('sv_user');
    }
};

/**
 * 🛡️ MÓDULO DE AUTENTICAÇÃO E GOVERNANÇA CORPORATIVA
 */
const AuthAPI = {
    registerCompany: async (fullname, email, company, password) => {
        try {
            const response = await fetch(`${BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullname, email, company, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Falha ao registrar empresa/usuário.');
            if (data.token) {
                TokenManager.saveToken(data.token);
                TokenManager.saveUser(data.user);
            }
            return data;
        } catch (error) { throw error; }
    },

    login: async (email, password) => {
        try {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Falha na autenticação.');
            TokenManager.saveToken(data.token);
            TokenManager.saveUser(data.user);
            return data;
        } catch (error) { throw error; }
    },

    registerEmployee: async (fullname, email, password) => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/auth/employees`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ fullname, email, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao registrar funcionário.');
            return data;
        } catch (error) { throw error; }
    },

    forgotPassword: async (email) => {
        try {
            const response = await fetch(`${BASE_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Falha ao solicitar recuperação de senha.');
            return data;
        } catch (error) { throw error; }
    },

    resetPassword: async (token, password) => {
        try {
            const response = await fetch(`${BASE_URL}/auth/reset-password/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Falha ao redefinir senha.');
            return data;
        } catch (error) { throw error; }
    },

    getProfile: async () => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/auth/profile`, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao obter dados do perfil.');
            return data;
        } catch (error) { throw error; }
    },

    updateProfile: async (profileData) => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/auth/profile`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(profileData)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao atualizar dados do perfil.');
            if (data.user) {
                // Atualiza o cache do usuário localmente
                TokenManager.saveUser(data.user);
            }
            return data;
        } catch (error) { throw error; }
    },

    logout: () => {
        TokenManager.clearAll();
        const baseFolder = window.location.pathname.includes('/views/') ? '' : 'views/';
        window.location.replace(`${baseFolder}login.html`);
    }
};

/**
 * 📦 MÓDULO DE OPERAÇÃO DE ESTOQUE, HISTÓRICO, ESG, PREVISÃO DE IA E XML
 */
const StockAPI = {
    getInventory: async () => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/stock`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao carregar estoque.');
            return data;
        } catch (error) { throw error; }
    },

    getDashboardMetrics: async () => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/stock/metrics`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao processar indicadores.');
            return data;
        } catch (error) { throw error; }
    },

    getExpirationAlerts: async () => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/esg/expiration-alerts`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao buscar alertas de vencimento.');
            return data.alerts;
        } catch (error) { throw error; }
    },

    createProduct: async (productPayload) => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/stock`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(productPayload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao registrar produto no servidor.');
            return data;
        } catch (error) { throw error; }
    },

    updateProduct: async (id, updatedFields) => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/stock/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedFields)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao atualizar dados logísticos do produto.');
            return data;
        } catch (error) { throw error; }
    },

    deleteProduct: async (id) => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/stock/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao remover material.');
            return data;
        } catch (error) {
            console.error('[API Stock - Delete Error]:', error.message);
            throw error;
        }
    },

    /**
     * 🔮 CONECTOR DE INTELIGÊNCIA ARTIFICIAL: PREVISÃO DE DEMANDA (MMP + GIRO)
     * GET -> /api/demand/forecast
     */
    getDemandForecast: async () => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/demand/forecast`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao processar análise preditiva da IA.');
            return data;
        } catch (error) {
            console.error('[API Demand - Forecast Error]:', error.message);
            throw error;
        }
    },

    /**
     * 🧾 PROCESSAR INGESTÃO DE NOTA FISCAL VIA STRING XML
     * POST -> /api/stock/invoice/xml
     */
    importInvoiceXml: async (xmlData) => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/stock/invoice/xml`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ xmlData })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao processar arquivo fiscal.');
            return data;
        } catch (error) {
            console.error('[API Stock - XML Invoice Error]:', error.message);
            throw error;
        }
    },

    /**
     * 🌱 BUSCAR ANÁLISE COMPLETA E MÉTRICAS ESG DE COMPATIBILIDADE
     * GET -> /api/reverse/analytics
     */
    getReverseAnalytics: async () => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/reverse/analytics`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao ler indicadores ESG.');
            return data;
        } catch (error) { throw error; }
    },

    /**
     * 🌱 BUSCAR PAINEL E METRICAS ESG COMPLETAS
     * GET -> /api/esg/dashboard
     */
    getEsgDashboard: async () => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/esg/dashboard`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao carregar painel ESG.');
            return data;
        } catch (error) { throw error; }
    },

    /**
     * ♻️ DAR ENTRADA EM FLUXO DE DEVOLUÇÃO / LOGÍSTICA REVERSA
     * POST -> /api/reverse/return
     */
    createReverseReturn: async (payload) => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/reverse/return`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao registrar manifesto de devolução.');
            return data;
        } catch (error) { throw error; }
    },

    /**
     * 📋 BUSCAR FOLHA DE CONTAGEM CEGA PARA INVENTÁRIO ROTATIVO
     * GET -> /api/stock/inventory/rotative
     */
    getRotativeSheet: async (category = '', sector = '') => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/stock/inventory/rotative?category=${category}&sector=${sector}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao gerar folha rotativa.');
            return data;
        } catch (error) { throw error; }
    },

    /**
     * ⚖️ SUBMETER CONTAGEM FÍSICA PARA AUDITORIA GERAL E CONCILIAÇÃO
     * POST -> /api/stock/inventory/general
     */
    submitInventoryAudit: async (countedItems) => {
        try {
            const token = TokenManager.getToken();
            const response = await fetch(`${BASE_URL}/stock/inventory/general`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ countedItems })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao processar auditoria.');
            return data;
        } catch (error) { throw error; }
    }
};

const PartnerAPI = {
    getPartners: async () => {
        try {
            const token = TokenManager.getToken();
            const headers = {};
            if (token) headers.Authorization = `Bearer ${token}`;

            const response = await fetch(`${BASE_URL}/supply/partners`, {
                method: 'GET',
                headers
            });
            const data = await safeJsonResponse(response);
            if (!response.ok) throw new Error(data.message || 'Erro ao carregar fornecedores.');
            return data;
        } catch (error) {
            console.error('[API Partner - Get Partners Error]:', error.message);
            throw error;
        }
    },

    createPartner: async (partnerPayload) => {
        try {
            const token = TokenManager.getToken();
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

            const response = await fetch(`${BASE_URL}/supply/partners`, {
                method: 'POST',
                headers,
                body: JSON.stringify(partnerPayload)
            });
            const data = await safeJsonResponse(response);
            if (!response.ok) throw new Error(data.message || 'Erro ao cadastrar fornecedor.');
            return data;
        } catch (error) {
            console.error('[API Partner - Create Partner Error]:', error.message);
            throw error;
        }
    },

    updatePartner: async (id, partnerPayload) => {
        try {
            const token = TokenManager.getToken();
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

            const response = await fetch(`${BASE_URL}/supply/partners/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(partnerPayload)
            });
            const data = await safeJsonResponse(response);
            if (!response.ok) throw new Error(data.message || 'Erro ao atualizar fornecedor.');
            return data;
        } catch (error) {
            console.error('[API Partner - Update Partner Error]:', error.message);
            throw error;
        }
    },

    deletePartner: async (id) => {
        try {
            const token = TokenManager.getToken();
            const headers = {};
            if (token) headers.Authorization = `Bearer ${token}`;

            const response = await fetch(`${BASE_URL}/supply/partners/${id}`, {
                method: 'DELETE',
                headers
            });
            const data = await safeJsonResponse(response);
            if (!response.ok) throw new Error(data.message || 'Erro ao excluir fornecedor.');
            return data;
        } catch (error) {
            console.error('[API Partner - Delete Partner Error]:', error.message);
            throw error;
        }
    }
};
