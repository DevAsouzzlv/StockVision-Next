/**
 * STOCKVISION - CONTROLADOR DE PREVISÃO DE DEMANDA & IA GEMINI (TAILWIND CSS)
 */

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('forecast-table-body');
    const totalOrdersSug = document.getElementById('total-orders-sug');
    const totalInvestmentSug = document.getElementById('total-investment-sug');
    const geminiModal = document.getElementById('gemini-insight-modal');
    const btnCloseGeminiModal = document.getElementById('btn-close-gemini-modal');
    const btnCloseGeminiFooter = document.getElementById('btn-close-gemini-footer');

    const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    const activeUser = TokenManager.getUser();
    if (activeUser) {
        const companyEl = document.getElementById('company-name-display');
        if (companyEl) companyEl.innerText = `Centro Logístico: ${activeUser.company}`;
    }

    const openGeminiModal = (title, insight) => {
        if (!geminiModal) return;
        document.getElementById('gemini-modal-title').innerText = title;
        document.getElementById('gemini-modal-source').innerText = insight.source || 'Google Gemini';
        document.getElementById('gemini-modal-demand').innerText = `${insight.predictedDemand || 0} un/mês`;
        document.getElementById('gemini-modal-safety').innerText = `${insight.safetyStock || 0} un`;
        document.getElementById('gemini-modal-purchase').innerText = `${insight.suggestedPurchase || 0} un`;
        document.getElementById('gemini-modal-confidence').innerText = `${insight.confidence || 90}%`;
        document.getElementById('gemini-modal-analysis').innerText = insight.analysisText || 'Análise preditiva concluída.';
        geminiModal.classList.remove('hidden');
    };

    const closeGeminiModal = () => {
        if (geminiModal) geminiModal.classList.add('hidden');
    };

    btnCloseGeminiModal?.addEventListener('click', closeGeminiModal);
    btnCloseGeminiFooter?.addEventListener('click', closeGeminiModal);

    window.consultGeminiForProduct = async (productId, productName) => {
        try {
            uiFeedback.toast(`Consultando IA Google Gemini para ${productName}...`, 'info');
            const result = await StockAPI.getGeminiDemandInsight(productId);
            if (result && result.geminiInsight) {
                openGeminiModal(`Previsão IA Gemini: ${productName}`, result.geminiInsight);
            }
        } catch (error) {
            uiFeedback.toast(`Erro na análise Gemini: ${error.message}`, 'error');
        }
    };

    try {
        const report = await StockAPI.getDemandForecast();
        if (!tableBody) return;
        tableBody.innerHTML = '';

        let orderCount = 0;
        let investmentSum = 0;

        if (!report || report.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                        <i class="bi bi-inbox text-3xl block mb-2"></i>
                        Nenhum insumo localizado para cálculo preditivo.
                    </td>
                </tr>
            `;
            return;
        }

        report.forEach((item) => {
            const row = document.createElement('tr');
            row.className = 'border-b border-slate-100 dark:border-slate-800 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition';

            const needPurchase = item.sugestaoCompra > 0;
            if (needPurchase) {
                orderCount++;
                investmentSum += (item.investimentoEstimated || item.investimentoEstimado || 0);
            }

            let badgeStatus = '';
            if (item.criticidade === 'danger') {
                badgeStatus = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse"><i class="bi bi-exclamation-octagon"></i> ' + item.acao + '</span>';
            } else if (item.criticidade === 'warning') {
                badgeStatus = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><i class="bi bi-exclamation-triangle"></i> ' + item.acao + '</span>';
            } else {
                badgeStatus = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><i class="bi bi-check-circle"></i> ' + item.acao + '</span>';
            }

            row.innerHTML = `
                <td class="py-3 px-4">
                    <strong class="text-slate-900 dark:text-white block font-bold">${item.name}</strong>
                    <span class="text-[11px] text-slate-400 font-mono">SKU: ${item.sku}</span>
                </td>
                <td class="py-3 px-4 text-slate-600 dark:text-slate-300">
                    ${item.supplier || 'Não Mapeado'}
                </td>
                <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    ${(item.quantityInStock || 0).toLocaleString('pt-BR')} un
                </td>
                <td class="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">
                    ${item.pontoDePedido || 0} un
                </td>
                <td class="py-3 px-4 text-slate-800 dark:text-slate-200 font-semibold">
                    ${item.predictedDemand || 0} un/mês
                </td>
                <td class="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                    ${item.giroEstoque}x
                </td>
                <td class="py-3 px-4 font-bold ${needPurchase ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}">
                    ${needPurchase ? `+${item.sugestaoCompra} un` : '0 un'}
                </td>
                <td class="py-3 px-4">
                    <div class="flex items-center gap-2">
                        ${badgeStatus}
                        <button onclick="consultGeminiForProduct('${item._id}', '${item.name.replace(/'/g, "\\'")}')" class="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition" title="Consultar Inteligência Artificial Google Gemini">
                            <i class="bi bi-robot text-sm"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });

        if (totalOrdersSug) totalOrdersSug.innerText = orderCount;
        if (totalInvestmentSug) totalInvestmentSug.innerText = formatCurrency(investmentSum);

    } catch (error) {
        console.error('[Demand View Error]:', error);
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-6 text-rose-500 text-xs">
                        Falha ao calcular projeção preditiva com o servidor.
                    </td>
                </tr>
            `;
        }
    }
});
