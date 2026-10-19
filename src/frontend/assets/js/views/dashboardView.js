/**
 * STOCKVISION - CONTROLADOR DO DASHBOARD EXECUTIVO & ANALYTICS (TAILWIND CSS)
 * Integra indicadores dinâmicos, ranking de giro, alertas de baixo giro/dead stock,
 * painel executivo ESG e gráficos Chart.js com suporte a Dark Mode.
 */

document.addEventListener('DOMContentLoaded', () => {
    let financialChartInstance = null;
    let stockChartInstance = null;
    let cachedAnalytics = null;
    let activeFilter = 'all';

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    // =========================================================================
    // 1. CARREGAMENTO INICIAL DO PERFIL E METRICAS DO SERVIDOR
    // =========================================================================
    const loadDashboard = async () => {
        try {
            const activeUser = TokenManager.getUser();
            if (activeUser) {
                const userNameEl = document.getElementById('user-name-display');
                const userCompanyEl = document.getElementById('user-company-display');
                if (userNameEl) userNameEl.innerText = `Olá, ${activeUser.fullname || 'Gestor'}`;
                if (userCompanyEl) userCompanyEl.innerText = activeUser.company || 'StockVision WMS';
            }

            const data = await DashboardAPI.getAnalytics();
            cachedAnalytics = data;

            renderKpiCards(data.financials);
            renderCharts(data.historyTimeline);
            renderBestSellers(data.bestSellers);
            renderEsgWidget(data.esgSummary);
            renderAlerts(data.alerts);

        } catch (error) {
            console.error('[Dashboard Error]:', error);
            if (typeof uiFeedback !== 'undefined') {
                uiFeedback.toast(`Falha ao sincronizar métricas: ${error.message}`, 'error');
            }
        }
    };

    // =========================================================================
    // 2. RENDERIZAÇÃO DOS CARDS DE KPI FINANCEIRO E VOLUME
    // =========================================================================
    const renderKpiCards = (financials) => {
        if (!financials) return;

        const revEl = document.getElementById('kpi-revenue');
        const costEl = document.getElementById('kpi-cost');
        const profitEl = document.getElementById('kpi-profit');
        const profitMarginEl = document.getElementById('kpi-profit-margin');
        const volumeEl = document.getElementById('kpi-volume');
        const skusCountEl = document.getElementById('kpi-skus-count');

        if (revEl) revEl.innerText = formatCurrency(financials.totalRevenue);
        if (costEl) costEl.innerText = formatCurrency(financials.totalCosts);
        if (volumeEl) volumeEl.innerText = `${(financials.totalItemsVolume || 0).toLocaleString('pt-BR')} un`;
        if (skusCountEl) skusCountEl.innerText = `${financials.totalProductsCount || 0} SKUs cadastrados`;

        if (profitEl) {
            profitEl.innerText = formatCurrency(financials.estimatedProfit);
            if (financials.estimatedProfit < 0) {
                profitEl.className = 'text-xl md:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400';
            } else {
                profitEl.className = 'text-xl md:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400';
            }
        }

        if (profitMarginEl) {
            const margin = parseFloat(financials.grossMarginPercent || 0);
            profitMarginEl.innerText = `Margem Bruta: ${margin}%`;
            if (margin < 0) {
                profitMarginEl.className = 'text-[11px] font-semibold text-rose-500';
            } else {
                profitMarginEl.className = 'text-[11px] font-semibold text-emerald-500';
            }
        }
    };

    // =========================================================================
    // 3. GRÁFICOS CHART.JS (LINHA E BARRA COM SUPORTE A TEMA CLARO/ESCURO)
    // =========================================================================
    const renderCharts = (timeline) => {
        if (!timeline || typeof Chart === 'undefined') return;

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)';

        if (financialChartInstance) financialChartInstance.destroy();
        if (stockChartInstance) stockChartInstance.destroy();

        // 3.1. Gráfico de Evolução Financeira (Linhas)
        const ctxFinancial = document.getElementById('financialChart');
        if (ctxFinancial) {
            financialChartInstance = new Chart(ctxFinancial, {
                type: 'line',
                data: {
                    labels: timeline.months,
                    datasets: [
                        {
                            label: 'Receitas Projetadas (R$)',
                            data: timeline.revenue,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.08)',
                            borderWidth: 2.5,
                            tension: 0.35,
                            fill: true,
                            pointBackgroundColor: '#3b82f6',
                            pointRadius: 3
                        },
                        {
                            label: 'Custos Operacionais (R$)',
                            data: timeline.costs,
                            borderColor: '#f43f5e',
                            backgroundColor: 'rgba(244, 63, 94, 0.05)',
                            borderWidth: 2,
                            tension: 0.35,
                            fill: true,
                            pointBackgroundColor: '#f43f5e',
                            pointRadius: 3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: textColor, boxWidth: 12, font: { size: 11, weight: '600' } }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
                            }
                        }
                    },
                    scales: {
                        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
                        y: {
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                font: { size: 11 },
                                callback: (v) => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)
                            }
                        }
                    }
                }
            });
        }

        // 3.2. Gráfico de Flutuação de Estoque (Barras)
        const ctxStock = document.getElementById('stockChart');
        if (ctxStock) {
            stockChartInstance = new Chart(ctxStock, {
                type: 'bar',
                data: {
                    labels: timeline.months,
                    datasets: [{
                        label: 'Volume Físico Armazenado (un)',
                        data: timeline.stockLevels,
                        backgroundColor: '#06b6d4',
                        hoverBackgroundColor: '#0891b2',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: textColor, boxWidth: 12, font: { size: 11, weight: '600' } }
                        }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
                        y: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 11 } }
                        }
                    }
                }
            });
        }
    };

    // =========================================================================
    // 4. RENDERIZAÇÃO: TOP 5 PRODUTOS MAIS VENDIDOS (RANKING DE GIRO)
    // =========================================================================
    const renderBestSellers = (bestSellers) => {
        const container = document.getElementById('bestsellers-list');
        if (!container) return;

        container.innerHTML = '';

        if (!bestSellers || bestSellers.length === 0) {
            container.innerHTML = `
                <div class="p-6 text-center text-xs text-slate-400">
                    <i class="bi bi-bar-chart text-2xl block mb-1"></i>
                    Nenhum dado de giro registrado ainda no inventário.
                </div>
            `;
            return;
        }

        const maxSold = Math.max(...bestSellers.map(b => b.totalSold), 1);

        bestSellers.forEach((item, idx) => {
            const percent = Math.min(100, Math.round((item.totalSold / maxSold) * 100));
            
            let rankBadge = '';
            if (idx === 0) rankBadge = '<span class="w-6 h-6 rounded-full bg-amber-400 text-slate-900 font-extrabold flex items-center justify-center text-[11px] shadow-sm">1º</span>';
            else if (idx === 1) rankBadge = '<span class="w-6 h-6 rounded-full bg-slate-300 text-slate-900 font-extrabold flex items-center justify-center text-[11px] shadow-sm">2º</span>';
            else if (idx === 2) rankBadge = '<span class="w-6 h-6 rounded-full bg-amber-700 text-white font-extrabold flex items-center justify-center text-[11px] shadow-sm">3º</span>';
            else rankBadge = `<span class="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold flex items-center justify-center text-[11px]">${idx + 1}º</span>`;

            const row = document.createElement('div');
            row.className = 'p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-primary-400/50 transition';

            row.innerHTML = `
                <div class="flex items-center gap-3 min-w-0">
                    ${rankBadge}
                    <div class="min-w-0">
                        <strong class="text-slate-800 dark:text-slate-100 font-bold block truncate">${item.name}</strong>
                        <span class="text-[11px] text-slate-400 font-mono">SKU: ${item.sku} • ${item.category}</span>
                    </div>
                </div>

                <div class="flex items-center gap-4 shrink-0 sm:text-right">
                    <div class="w-24 sm:w-28 hidden md:block">
                        <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div class="bg-primary-500 h-1.5 rounded-full" style="width: ${percent}%"></div>
                        </div>
                        <span class="text-[10px] text-slate-400 mt-0.5 block">${item.totalSold} un vendidas</span>
                    </div>
                    <div>
                        <span class="font-bold text-slate-900 dark:text-white block">${formatCurrency(item.revenueGenerated)}</span>
                        <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Margem: ${item.unitMargin}%</span>
                    </div>
                </div>
            `;
            container.appendChild(row);
        });
    };

    // =========================================================================
    // 5. RENDERIZAÇÃO DO WIDGET EXECUTIVO ESG & SUSTENTABILIDADE
    // =========================================================================
    const renderEsgWidget = (esg) => {
        if (!esg) return;

        const recyclingEl = document.getElementById('esg-recycling-rate');
        const wasteEl = document.getElementById('esg-waste-rate');
        const nearExpEl = document.getElementById('esg-near-exp');
        const recoveredEl = document.getElementById('esg-recovered-qty');

        if (recyclingEl) recyclingEl.innerText = esg.recyclingRate || '0.0%';
        if (wasteEl) wasteEl.innerText = esg.wasteRate || '0.0%';
        if (nearExpEl) nearExpEl.innerText = `${esg.nearExpirationCount || 0} itens`;
        if (recoveredEl) recoveredEl.innerText = `${(esg.recycledQty || 0).toLocaleString('pt-BR')} un`;
    };

    // =========================================================================
    // 6. RENDERIZAÇÃO DA TABELA DE ALERTAS CRÍTICOS E ESTOQUE PARADO
    // =========================================================================
    const renderAlerts = (alertsData) => {
        const tbody = document.getElementById('alerts-table-body');
        const totalBadge = document.getElementById('alerts-total-count');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!alertsData || !alertsData.allAlerts || alertsData.allAlerts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                        <i class="bi bi-shield-check text-2xl text-emerald-500 block mb-1"></i>
                        Nenhum alerta crítico ativo. Todas as métricas de estoque estão dentro dos parâmetros.
                    </td>
                </tr>
            `;
            if (totalBadge) totalBadge.innerText = '0 Alertas';
            return;
        }

        if (totalBadge) {
            totalBadge.innerText = `${alertsData.allAlerts.length} Alertas`;
        }

        // Filtro ativo
        let filteredList = alertsData.allAlerts;
        if (activeFilter === 'loss') filteredList = alertsData.lossAlerts || [];
        else if (activeFilter === 'rupture_low') filteredList = [...(alertsData.rupture || []), ...(alertsData.lowStock || [])];
        else if (activeFilter === 'excess') filteredList = alertsData.excessStock || [];
        else if (activeFilter === 'dead') filteredList = alertsData.deadStock || [];

        if (filteredList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
                        Nenhum alerta encontrado para o filtro selecionado.
                    </td>
                </tr>
            `;
            return;
        }

        filteredList.forEach(alert => {
            const row = document.createElement('tr');
            
            let badgeClass = '';
            let pulse = '';
            if (alert.badgeColor === 'rose') {
                badgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800';
                pulse = 'animate-pulse';
            } else if (alert.badgeColor === 'red') {
                badgeClass = 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800';
            } else if (alert.badgeColor === 'amber') {
                badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800';
            } else if (alert.badgeColor === 'orange') {
                badgeClass = 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-800';
            } else {
                badgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
            }

            row.className = 'border-b border-slate-100 dark:border-slate-800 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition';

            row.innerHTML = `
                <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    ${alert.name}
                </td>
                <td class="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                    ${alert.sku}
                </td>
                <td class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                    ${alert.quantity.toLocaleString('pt-BR')} un
                </td>
                <td class="py-3 px-4">
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeClass} ${pulse}">
                        ${alert.type}
                    </span>
                </td>
                <td class="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                    ${alert.reason}
                </td>
            `;
            tbody.appendChild(row);
        });
    };

    // =========================================================================
    // 7. EVENTOS DE FILTRO DE ABAS DE ALERTAS
    // =========================================================================
    document.querySelectorAll('[data-alert-filter]').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('[data-alert-filter]').forEach(b => {
                b.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition';
            });

            button.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-50 dark:bg-primary-950/70 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 transition';
            activeFilter = button.getAttribute('data-alert-filter');
            if (cachedAnalytics) {
                renderAlerts(cachedAnalytics.alerts);
            }
        });
    });

    // Re-renderiza gráficos ao alternar tema (modo claro / escuro)
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            setTimeout(() => {
                if (cachedAnalytics && cachedAnalytics.historyTimeline) {
                    renderCharts(cachedAnalytics.historyTimeline);
                }
            }, 50);
        });
    }

    // Inicialização
    loadDashboard();
});
