/**
 * STOCKVISION - CONTROLADOR DO MÓDULO DE ESTOQUE (TAILWIND CSS)
 * Gerencia renderização, alertas de criticidade, drawer acessível de detalhes WMS,
 * cadastro e edição de insumos, ingestão de NF-e (XML) e leitor de código de barras.
 */

document.addEventListener('DOMContentLoaded', () => {
    let localProductsCache = [];
    let quickLossFilterActive = false;
    let loadedNfeXmlData = null;

    // Elementos DOM Principais
    const inventoryTableBody = document.getElementById('inventory-table-body');
    const cardsContainer = document.getElementById('inventory-cards-container');
    const filteredCountBadge = document.getElementById('filtered-items-count');

    // Filtros e Busca
    const searchNameInput = document.getElementById('search-name');
    const searchCategoryInput = document.getElementById('search-category');
    const searchStatusInput = document.getElementById('search-status');
    const searchMaxPriceInput = document.getElementById('search-max-price');

    // Drawer de Detalhes
    const detailsDrawer = document.getElementById('details-drawer');

    // Modais Tailwind
    const createModal = document.getElementById('create-modal');
    const editModal = document.getElementById('edit-modal');
    const barcodeModal = document.getElementById('barcode-scanner-modal');
    const nfeModal = document.getElementById('nfe-modal');

    // Funções utilitárias
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const toggleModal = (modalEl, show) => {
        if (!modalEl) return;
        if (show) {
            modalEl.classList.remove('hidden');
        } else {
            modalEl.classList.add('hidden');
        }
    };

    window.openCreateModal = () => toggleModal(createModal, true);
    window.closeCreateModal = () => toggleModal(createModal, false);

    window.openEditModalWindow = () => toggleModal(editModal, true);
    window.closeEditModal = () => toggleModal(editModal, false);

    window.openNfeModal = () => toggleModal(nfeModal, true);
    window.closeNfeModal = () => {
        toggleModal(nfeModal, false);
        loadedNfeXmlData = null;
    };

    window.openBarcodeModal = () => {
        toggleModal(barcodeModal, true);
        const scannerDeviceInput = document.getElementById('scanner-device-input');
        setTimeout(() => scannerDeviceInput?.focus(), 150);
    };

    window.closeBarcodeModal = () => {
        toggleModal(barcodeModal, false);
        if (typeof Quagga !== 'undefined') {
            try { Quagga.stop(); } catch(e){}
        }
    };

    // =========================================================================
    // 1. CONEXÃO DE EVENT LISTENERS DOS BOTÕES DE ABERTURA E FECHAMENTO
    // =========================================================================
    document.getElementById('open-create-btn')?.addEventListener('click', () => window.openCreateModal());
    document.getElementById('open-nfe-modal-btn')?.addEventListener('click', () => window.openNfeModal());
    document.getElementById('open-barcode-btn')?.addEventListener('click', () => window.openBarcodeModal());

    document.getElementById('btn-close-create-modal')?.addEventListener('click', () => window.closeCreateModal());
    document.getElementById('btn-cancel-create-modal')?.addEventListener('click', () => window.closeCreateModal());

    document.getElementById('btn-close-edit-modal')?.addEventListener('click', () => window.closeEditModal());
    document.getElementById('btn-cancel-edit-modal')?.addEventListener('click', () => window.closeEditModal());

    document.getElementById('btn-close-nfe-modal')?.addEventListener('click', () => window.closeNfeModal());
    document.getElementById('btn-cancel-nfe-modal')?.addEventListener('click', () => window.closeNfeModal());

    document.getElementById('btn-close-barcode-modal')?.addEventListener('click', () => window.closeBarcodeModal());
    document.getElementById('btn-close-barcode-modal-footer')?.addEventListener('click', () => window.closeBarcodeModal());

    document.getElementById('btn-close-drawer')?.addEventListener('click', () => window.closeProductDetails());

    // Fechar ao teclar ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.closeProductDetails();
            window.closeCreateModal();
            window.closeEditModal();
            window.closeNfeModal();
            window.closeBarcodeModal();
        }
    });

    // =========================================================================
    // 2. ATUALIZAÇÃO DOS CARDS DE CRITICIDADE (ALERTAS EM TEMPO REAL)
    // =========================================================================
    const updateCriticalityKPIs = (products) => {
        const ruptureEl = document.getElementById('stat-rupture-count');
        const lossEl = document.getElementById('stat-loss-count');
        const lowEl = document.getElementById('stat-low-count');
        const normalEl = document.getElementById('stat-normal-count');

        if (!ruptureEl) return;

        let ruptureCount = 0;
        let lossCount = 0;
        let lowCount = 0;
        let normalCount = 0;

        products.forEach(p => {
            if (p.statusVisual?.isLossAlert) lossCount++;
            if (p.statusVisual?.statusTag === 'Ruptura' || (p.quantityInStock || 0) <= 0) ruptureCount++;
            else if (p.statusVisual?.statusTag === 'Estoque Baixo') lowCount++;
            else if (p.statusVisual?.statusTag === 'Normal') normalCount++;
        });

        ruptureEl.innerText = ruptureCount;
        lossEl.innerText = lossCount;
        lowEl.innerText = lowCount;
        normalEl.innerText = normalCount;
    };

    // =========================================================================
    // 3. RENDERIZAÇÃO DA TABELA E DOS CARDS MÓVEIS COM SINALIZAÇÃO DESTACADA
    // =========================================================================
    const renderTableRows = (products) => {
        if (filteredCountBadge) {
            filteredCountBadge.innerText = `${products ? products.length : 0} materiais`;
        }

        if (inventoryTableBody) inventoryTableBody.innerHTML = '';
        if (cardsContainer) cardsContainer.innerHTML = '';

        if (!products || products.length === 0) {
            const emptyHtml = `
                <div class="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    <i class="bi bi-inbox text-3xl block mb-2"></i>
                    Nenhum insumo ou material localizado para os filtros selecionados.
                </div>
            `;
            if (inventoryTableBody) {
                inventoryTableBody.innerHTML = `<tr><td colspan="6">${emptyHtml}</td></tr>`;
            }
            if (cardsContainer) {
                cardsContainer.innerHTML = emptyHtml;
            }
            return;
        }

        products.forEach(p => {
            const isLoss = Boolean(p.statusVisual?.isLossAlert);
            const isRupture = p.statusVisual?.statusTag === 'Ruptura' || (p.quantityInStock || 0) <= 0;
            const isLow = p.statusVisual?.statusTag === 'Estoque Baixo';

            const loc = p.location || {};
            const locationStr = loc.sector 
                ? `${loc.sector} / ${loc.row || 'R0'} / ${loc.building || 'P0'}` 
                : 'Doca / Recebimento';

            // Badges em Tailwind com destaque crítico em vermelho
            let statusBadge = '';
            if (isRupture) {
                statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-600 text-white shadow-sm critical-pulse"><i class="bi bi-x-circle-fill"></i> Ruptura Crítica</span>';
            } else if (isLow) {
                statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700"><i class="bi bi-exclamation-triangle"></i> Estoque Baixo</span>';
            } else if (p.statusVisual?.statusTag === 'Excesso') {
                statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-800"><i class="bi bi-box-arrow-up"></i> Excesso</span>';
            } else {
                statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><i class="bi bi-check-circle"></i> Normal</span>';
            }

            // Alerta de Prejuízo em Vermelho Vivo
            let financialLossBadge = '';
            if (isLoss) {
                financialLossBadge = `
                    <div class="mt-1">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-600 text-white critical-pulse shadow-sm" title="${p.statusVisual?.lossReason || 'Venda abaixo do custo'}">
                            <i class="bi bi-exclamation-octagon-fill"></i> Prejuízo Estimado (${p.statusVisual?.unitMargin || 0}%)
                        </span>
                    </div>
                `;
            }

            // 1. Linha da Tabela (Desktop/Tablet)
            if (inventoryTableBody) {
                const row = document.createElement('tr');
                let rowBg = 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border-l-4 border-l-transparent';
                if (isLoss) {
                    rowBg = 'bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 border-l-4 border-l-rose-600';
                } else if (isRupture) {
                    rowBg = 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50 dark:hover:bg-red-900/30 border-l-4 border-l-red-500';
                }

                row.className = `border-b border-slate-100 dark:border-slate-800 transition-colors text-xs ${rowBg}`;
                row.innerHTML = `
                    <td class="py-3 px-4">
                        <strong class="text-slate-900 dark:text-white block font-bold">${p.name}</strong>
                        <span class="text-[11px] text-slate-400 font-mono">SKU: ${p.sku || 'N/A'}</span>
                        ${financialLossBadge}
                    </td>
                    <td class="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        <span class="inline-flex items-center gap-1"><i class="bi bi-geo-alt text-slate-400"></i> ${locationStr}</span>
                    </td>
                    <td class="py-3 px-4 font-bold ${isRupture ? 'text-red-600 dark:text-red-400 font-black' : 'text-slate-900 dark:text-white'}">
                        ${(p.quantityInStock || 0).toLocaleString('pt-BR')} un
                    </td>
                    <td class="py-3 px-4">
                        <span class="font-bold text-slate-900 dark:text-white block">${formatCurrency(p.sellingPrice)}</span>
                        <span class="text-[10px] text-slate-400">Custo: ${formatCurrency(p.acquisitionCost)}</span>
                    </td>
                    <td class="py-3 px-4">
                        ${statusBadge}
                    </td>
                    <td class="py-3 px-4 text-center">
                        <div class="inline-flex items-center gap-1.5">
                            <button type="button" onclick="viewProductDetails('${p._id}')" title="Ver Detalhes e Métricas"
                                class="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/60 transition">
                                <i class="bi bi-eye text-base"></i>
                            </button>
                            <button type="button" onclick="openEditModal('${p._id}')" title="Editar Material"
                                class="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                                <i class="bi bi-pencil-square text-base"></i>
                            </button>
                            <button type="button" onclick="deleteProduct('${p._id}', '${p.name.replace(/'/g, "\\'")}')" title="Excluir Material"
                                class="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition">
                                <i class="bi bi-trash text-base"></i>
                            </button>
                        </div>
                    </td>
                `;
                inventoryTableBody.appendChild(row);
            }

            // 2. Card Visual para Mobile
            if (cardsContainer) {
                const card = document.createElement('div');
                let cardBorder = 'border-slate-200 dark:border-slate-700';
                if (isLoss) cardBorder = 'border-rose-400 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20';
                else if (isRupture) cardBorder = 'border-red-400 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20';

                card.className = `p-4 rounded-xl border ${cardBorder} shadow-sm space-y-2 text-xs transition`;
                card.innerHTML = `
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <strong class="text-sm font-bold text-slate-900 dark:text-white block truncate">${p.name}</strong>
                            <span class="text-[11px] text-slate-400 font-mono">SKU: ${p.sku || 'N/A'}</span>
                        </div>
                        <div class="shrink-0">${statusBadge}</div>
                    </div>
                    ${financialLossBadge}
                    <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <div>
                            <span class="text-slate-400 block font-medium">Local WMS</span>
                            <span class="font-bold text-slate-700 dark:text-slate-200"><i class="bi bi-geo-alt"></i> ${locationStr}</span>
                        </div>
                        <div>
                            <span class="text-slate-400 block font-medium">Saldo Atual</span>
                            <span class="font-bold ${isRupture ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}">${(p.quantityInStock || 0).toLocaleString('pt-BR')} un</span>
                        </div>
                        <div>
                            <span class="text-slate-400 block font-medium">Preço Venda</span>
                            <span class="font-bold text-slate-800 dark:text-slate-100">${formatCurrency(p.sellingPrice)}</span>
                        </div>
                        <div>
                            <span class="text-slate-400 block font-medium">Custo Aquis.</span>
                            <span class="text-slate-500">${formatCurrency(p.acquisitionCost)}</span>
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button type="button" onclick="viewProductDetails('${p._id}')" class="px-3 py-1.5 rounded-lg text-primary-600 bg-primary-50 dark:bg-primary-950/60 font-semibold flex items-center gap-1">
                            <i class="bi bi-eye"></i> Detalhes
                        </button>
                        <button type="button" onclick="openEditModal('${p._id}')" class="px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 font-semibold flex items-center gap-1">
                            <i class="bi bi-pencil-square"></i> Editar
                        </button>
                        <button type="button" onclick="deleteProduct('${p._id}', '${p.name.replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-lg text-rose-600 bg-rose-50 dark:bg-rose-950/60 font-semibold flex items-center gap-1">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                `;
                cardsContainer.appendChild(card);
            }
        });
    };

    const populateCategories = (products) => {
        if (!searchCategoryInput) return;
        const currentSelected = searchCategoryInput.value;
        const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
        searchCategoryInput.innerHTML = '<option value="">Todas as Categorias</option>' + 
            categories.map(c => `<option value="${c}">${c}</option>`).join('');
        if (currentSelected && categories.includes(currentSelected)) {
            searchCategoryInput.value = currentSelected;
        }
    };

    const applyFilters = () => {
        const query = (searchNameInput?.value || '').trim().toLowerCase();
        const category = (searchCategoryInput?.value || '').trim().toLowerCase();
        const status = (searchStatusInput?.value || '').trim();
        const maxPrice = parseFloat(searchMaxPriceInput?.value || '');

        const filtered = localProductsCache.filter(p => {
            const matchesQuery = !query || `${p.name} ${p.sku || ''} ${p.barcode || ''}`.toLowerCase().includes(query);
            const matchesCat = !category || (p.category || '').toLowerCase() === category;
            const matchesStatus = quickLossFilterActive 
                ? Boolean(p.statusVisual?.isLossAlert)
                : (!status || (p.statusVisual?.statusTag || '') === status);
            const matchesPrice = Number.isNaN(maxPrice) || (p.sellingPrice || 0) <= maxPrice;
            return matchesQuery && matchesCat && matchesStatus && matchesPrice;
        });

        renderTableRows(filtered);
    };

    // Conecta botões de filtro rápido nos cards de criticidade
    document.querySelectorAll('.quick-filter-card').forEach(btn => {
        btn.addEventListener('click', () => {
            const filterType = btn.getAttribute('data-status-filter');
            if (filterType === 'Prejuizo') {
                quickLossFilterActive = true;
                if (searchStatusInput) searchStatusInput.value = '';
            } else {
                quickLossFilterActive = false;
                if (searchStatusInput) searchStatusInput.value = filterType;
            }
            applyFilters();
        });
    });

    [searchNameInput, searchCategoryInput, searchStatusInput, searchMaxPriceInput].forEach(el => {
        if (!el) return;
        el.addEventListener('input', () => {
            quickLossFilterActive = false;
            applyFilters();
        });
        el.addEventListener('change', () => {
            quickLossFilterActive = false;
            applyFilters();
        });
    });

    const loadInventory = async () => {
        try {
            if (inventoryTableBody && localProductsCache.length === 0) {
                inventoryTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-slate-400 text-xs"><span class="inline-block animate-spin mr-2">⟳</span> Sincronizando inventário NoSQL...</td></tr>';
            }
            const data = await StockAPI.getInventory();
            localProductsCache = Array.isArray(data) ? data : [];
            updateCriticalityKPIs(localProductsCache);
            populateCategories(localProductsCache);
            applyFilters();
        } catch (error) {
            ui.toast('Falha ao carregar inventário: ' + error.message, 'danger');
            if (inventoryTableBody) {
                inventoryTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-rose-500 text-xs">Erro ao conectar com a API de estoque.</td></tr>';
            }
        }
    };

    // =========================================================================
    // 4. DRAWER DE DETALHES WMS E RENTABILIDADE
    // =========================================================================
    window.viewProductDetails = (id) => {
        const product = localProductsCache.find(p => p._id === id);
        if (!product || !detailsDrawer) return;

        const setFieldText = (elemId, text) => {
            const el = document.getElementById(elemId);
            if (el) el.innerText = text;
        };

        setFieldText('drawer-name', product.name);
        setFieldText('drawer-sku', product.sku || 'N/A');
        setFieldText('drawer-barcode', product.barcode || 'N/A');
        setFieldText('drawer-category', product.category || 'Geral');
        setFieldText('drawer-qty', `${(product.quantityInStock || 0).toLocaleString('pt-BR')} un`);
        setFieldText('drawer-limits', `Mín: ${product.minimumStock || 0} / Máx: ${product.maximumStock || 0}`);
        setFieldText('drawer-supplier', product.supplier || 'Não informado');

        const loc = product.location || {};
        setFieldText('drawer-location', `${loc.sector || 'S/S'}-R${loc.row || '0'}-P${loc.building || '0'}-N${loc.floor || '0'}-V${loc.apartment || '0'}`);

        const isExpIndet = product.isIndeterminateExpiration;
        setFieldText('drawer-expiration', isExpIndet 
            ? 'Imperecível' 
            : (product.expirationDate ? new Date(product.expirationDate).toLocaleDateString('pt-BR') : 'Não informada'));

        // Métricas Financeiras
        const totalTurnover = (product.sellingPrice || 0) * (product.quantityInStock || 0);
        const totalCost = (product.acquisitionCost || 0) * (product.quantityInStock || 0);
        const totalProfit = totalTurnover - totalCost;

        setFieldText('drawer-cost', formatCurrency(product.acquisitionCost));
        setFieldText('drawer-price', formatCurrency(product.sellingPrice));
        setFieldText('drawer-turnover', formatCurrency(totalTurnover));

        const marginEl = document.getElementById('drawer-margin');
        const profitEl = document.getElementById('drawer-profit');
        const marginVal = product.statusVisual?.unitMargin || 0;

        if (marginEl) marginEl.innerText = `${marginVal}%`;
        if (profitEl) profitEl.innerText = formatCurrency(totalProfit);

        const statusTagEl = document.getElementById('drawer-status-tag');
        if (statusTagEl) {
            statusTagEl.innerText = product.statusVisual?.statusTag || 'Normal';
        }

        const lossBanner = document.getElementById('drawer-loss-banner');
        if (lossBanner) {
            if (product.statusVisual?.isLossAlert) {
                if (marginEl) marginEl.className = 'font-bold text-xs text-rose-600 dark:text-rose-400 mt-0.5';
                if (profitEl) profitEl.className = 'font-bold text-xs text-rose-600 dark:text-rose-400 mt-0.5';
                lossBanner.classList.remove('hidden');
            } else {
                if (marginEl) marginEl.className = 'font-bold text-xs text-slate-800 dark:text-slate-100 mt-0.5';
                if (profitEl) profitEl.className = 'font-bold text-xs text-emerald-600 dark:text-emerald-400 mt-0.5';
                lossBanner.classList.add('hidden');
            }
        }

        detailsDrawer.classList.remove('hidden');
        detailsDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    window.closeProductDetails = () => {
        if (detailsDrawer) detailsDrawer.classList.add('hidden');
    };

    // =========================================================================
    // 5. FORMULÁRIO DE CADASTRO DE NOVO INSUMO
    // =========================================================================
    const createCostInput = document.getElementById('acquisitionCost');
    const createPriceInput = document.getElementById('sellingPrice');
    const createLossAlert = document.getElementById('create-loss-alert');

    const checkCreateMargin = () => {
        const cost = parseFloat(createCostInput?.value || 0);
        const price = parseFloat(createPriceInput?.value || 0);
        if (cost > 0 && price > 0 && price <= cost) {
            createLossAlert?.classList.remove('hidden');
            createPriceInput?.classList.add('border-rose-500', 'focus:ring-rose-500');
        } else {
            createLossAlert?.classList.add('hidden');
            createPriceInput?.classList.remove('border-rose-500', 'focus:ring-rose-500');
        }
    };

    createCostInput?.addEventListener('input', checkCreateMargin);
    createPriceInput?.addEventListener('input', checkCreateMargin);

    const isIndetCheckbox = document.getElementById('isIndeterminateExpiration');
    const expContainer = document.getElementById('expiration-container');
    const expDateInput = document.getElementById('expirationDate');

    isIndetCheckbox?.addEventListener('change', () => {
        if (isIndetCheckbox.checked) {
            expContainer?.classList.add('hidden');
            if (expDateInput) expDateInput.value = '';
        } else {
            expContainer?.classList.remove('hidden');
        }
    });

    const productForm = document.getElementById('product-form');
    productForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const cost = parseFloat(createCostInput?.value || 0);
        const price = parseFloat(createPriceInput?.value || 0);
        const minStock = parseInt(document.getElementById('minimumStock')?.value, 10) || 0;
        const maxStock = parseInt(document.getElementById('maximumStock')?.value, 10) || 0;

        if (minStock > maxStock) {
            ui.toast('Atenção: O estoque mínimo não pode ser maior que o estoque máximo!', 'warning');
            return;
        }

        const expVal = expDateInput?.value?.trim();
        const expirationDate = (isIndetCheckbox?.checked || !expVal) ? null : expVal;

        const payload = {
            name: document.getElementById('name')?.value?.trim() || '',
            category: document.getElementById('category')?.value?.trim() || 'Geral',
            barcode: document.getElementById('barcode')?.value?.trim() || '',
            supplier: document.getElementById('supplier')?.value?.trim() || 'Não Definido',
            acquisitionCost: cost,
            sellingPrice: price,
            quantityInStock: parseInt(document.getElementById('quantityInStock')?.value, 10) || 0,
            minimumStock: minStock,
            maximumStock: maxStock,
            isIndeterminateExpiration: Boolean(isIndetCheckbox?.checked),
            expirationDate: expirationDate,
            location: {
                sector: document.getElementById('sector')?.value?.trim().toUpperCase() || 'A',
                row: document.getElementById('row')?.value?.trim() || '01',
                building: document.getElementById('building')?.value?.trim() || '01',
                floor: document.getElementById('floor')?.value?.trim() || '01',
                apartment: document.getElementById('apartment')?.value?.trim() || 'A'
            }
        };

        try {
            const res = await StockAPI.createProduct(payload);
            ui.toast(res.message || 'Insumo cadastrado com sucesso!', 'success');
            window.closeCreateModal();
            productForm.reset();
            if (createLossAlert) createLossAlert.classList.add('hidden');
            await loadInventory();
        } catch (err) {
            ui.toast(err.message || 'Erro ao cadastrar material.', 'danger');
        }
    });

    // =========================================================================
    // 6. FORMULÁRIO DE EDIÇÃO DE INSUMO
    // =========================================================================
    const editCostInput = document.getElementById('edit-acquisitionCost');
    const editPriceInput = document.getElementById('edit-sellingPrice');
    const editLossAlert = document.getElementById('edit-loss-alert');

    const checkEditMargin = () => {
        const cost = parseFloat(editCostInput?.value || 0);
        const price = parseFloat(editPriceInput?.value || 0);
        if (cost > 0 && price > 0 && price <= cost) {
            editLossAlert?.classList.remove('hidden');
            editPriceInput?.classList.add('border-rose-500', 'focus:ring-rose-500');
        } else {
            editLossAlert?.classList.add('hidden');
            editPriceInput?.classList.remove('border-rose-500', 'focus:ring-rose-500');
        }
    };

    editCostInput?.addEventListener('input', checkEditMargin);
    editPriceInput?.addEventListener('input', checkEditMargin);

    const editIndetCheckbox = document.getElementById('edit-isIndeterminateExpiration');
    const editExpContainer = document.getElementById('edit-expiration-container');
    const editExpDateInput = document.getElementById('edit-expirationDate');

    editIndetCheckbox?.addEventListener('change', () => {
        if (editIndetCheckbox.checked) {
            editExpContainer?.classList.add('hidden');
            if (editExpDateInput) editExpDateInput.value = '';
        } else {
            editExpContainer?.classList.remove('hidden');
        }
    });

    window.openEditModal = (id) => {
        const prod = localProductsCache.find(p => p._id === id);
        if (!prod) return;

        const setVal = (elemId, val) => {
            const el = document.getElementById(elemId);
            if (el) el.value = val ?? '';
        };

        setVal('edit-id', prod._id);
        setVal('edit-name', prod.name);
        setVal('edit-category', prod.category || '');
        setVal('edit-acquisitionCost', prod.acquisitionCost ?? 0);
        setVal('edit-sellingPrice', prod.sellingPrice ?? 0);
        setVal('edit-quantity', prod.quantityInStock ?? 0);
        setVal('edit-minimumStock', prod.minimumStock ?? 0);
        setVal('edit-maximumStock', prod.maximumStock ?? 0);
        setVal('edit-supplier', prod.supplier || '');
        setVal('edit-barcode', prod.barcode || '');

        if (editIndetCheckbox) {
            editIndetCheckbox.checked = Boolean(prod.isIndeterminateExpiration);
            if (editIndetCheckbox.checked) {
                editExpContainer?.classList.add('hidden');
                if (editExpDateInput) editExpDateInput.value = '';
            } else {
                editExpContainer?.classList.remove('hidden');
                if (editExpDateInput) {
                    editExpDateInput.value = prod.expirationDate ? new Date(prod.expirationDate).toISOString().slice(0, 10) : '';
                }
            }
        }

        const loc = prod.location || {};
        setVal('edit-sector', loc.sector || '');
        setVal('edit-row', loc.row || '');
        setVal('edit-building', loc.building || '');
        setVal('edit-floor', loc.floor || '');
        setVal('edit-apartment', loc.apartment || '');

        checkEditMargin();
        window.openEditModalWindow();
    };

    const editForm = document.getElementById('edit-product-form');
    editForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id')?.value;
        const minStock = parseInt(document.getElementById('edit-minimumStock')?.value, 10) || 0;
        const maxStock = parseInt(document.getElementById('edit-maximumStock')?.value, 10) || 0;

        if (minStock > maxStock) {
            ui.toast('Atenção: O estoque mínimo não pode ser maior que o estoque máximo!', 'warning');
            return;
        }

        const editExpVal = editExpDateInput?.value?.trim();
        const expirationDate = (editIndetCheckbox?.checked || !editExpVal) ? null : editExpVal;

        const payload = {
            name: document.getElementById('edit-name')?.value?.trim() || '',
            category: document.getElementById('edit-category')?.value?.trim() || 'Geral',
            acquisitionCost: parseFloat(document.getElementById('edit-acquisitionCost')?.value || 0),
            sellingPrice: parseFloat(document.getElementById('edit-sellingPrice')?.value || 0),
            quantityInStock: parseInt(document.getElementById('edit-quantity')?.value, 10) || 0,
            minimumStock: minStock,
            maximumStock: maxStock,
            supplier: document.getElementById('edit-supplier')?.value?.trim() || 'Não Definido',
            barcode: document.getElementById('edit-barcode')?.value?.trim() || '',
            isIndeterminateExpiration: Boolean(editIndetCheckbox?.checked),
            expirationDate: expirationDate,
            location: {
                sector: document.getElementById('edit-sector')?.value?.trim().toUpperCase() || 'A',
                row: document.getElementById('edit-row')?.value?.trim() || '01',
                building: document.getElementById('edit-building')?.value?.trim() || '01',
                floor: document.getElementById('edit-floor')?.value?.trim() || '01',
                apartment: document.getElementById('edit-apartment')?.value?.trim() || 'A'
            }
        };

        try {
            const res = await StockAPI.updateProduct(id, payload);
            ui.toast(res.message || 'Insumo atualizado com sucesso!', 'success');
            window.closeEditModal();
            await loadInventory();
        } catch (err) {
            ui.toast(err.message || 'Erro ao atualizar insumo.', 'danger');
        }
    });

    // =========================================================================
    // 7. EXCLUSÃO SEGURA DE INSUMO
    // =========================================================================
    window.deleteProduct = async (id, name) => {
        const confirmed = await ui.confirm({
            title: 'Excluir Insumo',
            message: `Deseja realmente remover permanentemente o material "${name}" do inventário do armazém?`,
            confirmText: 'Sim, Excluir',
            cancelText: 'Cancelar',
            isDestructive: true
        });

        if (confirmed) {
            try {
                await StockAPI.deleteProduct(id);
                ui.toast(`Material "${name}" removido com sucesso.`, 'success');
                await loadInventory();
            } catch (err) {
                ui.toast(err.message || 'Falha ao remover material.', 'danger');
            }
        }
    };

    // =========================================================================
    // 8. INGESTÃO DE NF-E (XML DRAG & DROP E FILE INPUT)
    // =========================================================================
    const nfeDropzone = document.getElementById('nfe-dropzone');
    const nfeFileInput = document.getElementById('nfe-file-input');
    const nfePreviewContainer = document.getElementById('nfe-preview-table-container');
    const nfeItemsCountBadge = document.getElementById('nfe-items-count');
    const nfePreviewTbody = document.getElementById('nfe-preview-tbody');
    const btnConfirmNfe = document.getElementById('btn-confirm-nfe-import');

    const processNfeFile = (file) => {
        if (!file || !file.name.toLowerCase().endsWith('.xml')) {
            ui.toast('Por favor, selecione um arquivo XML válido da NF-e.', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const xmlText = e.target.result;
            loadedNfeXmlData = xmlText;

            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                const detElements = xmlDoc.getElementsByTagName('det');
                
                if (detElements.length === 0) {
                    ui.toast('Nenhum item localizado na estrutura do XML da NF-e.', 'warning');
                    return;
                }

                if (nfePreviewTbody) nfePreviewTbody.innerHTML = '';
                let totalItemsCount = 0;

                Array.from(detElements).forEach(det => {
                    const prod = det.getElementsByTagName('prod')[0];
                    if (!prod) return;
                    totalItemsCount++;

                    const xProd = prod.getElementsByTagName('xProd')[0]?.textContent || 'Item sem descrição';
                    const qCom = parseFloat(prod.getElementsByTagName('qCom')[0]?.textContent || '0');
                    const vUnCom = parseFloat(prod.getElementsByTagName('vUnCom')[0]?.textContent || '0');
                    const vProd = parseFloat(prod.getElementsByTagName('vProd')[0]?.textContent || '0');

                    if (nfePreviewTbody) {
                        const tr = document.createElement('tr');
                        tr.className = 'border-b border-slate-100 dark:border-slate-800 text-[11px]';
                        tr.innerHTML = `
                            <td class="p-2 font-medium text-slate-800 dark:text-slate-200">${xProd}</td>
                            <td class="p-2 font-bold">${qCom} un</td>
                            <td class="p-2">${formatCurrency(vUnCom)}</td>
                            <td class="p-2 font-bold text-emerald-600 dark:text-emerald-400">${formatCurrency(vProd)}</td>
                        `;
                        nfePreviewTbody.appendChild(tr);
                    }
                });

                if (nfeItemsCountBadge) nfeItemsCountBadge.innerText = `${totalItemsCount} itens localizados`;
                if (nfePreviewContainer) nfePreviewContainer.classList.remove('hidden');
                if (btnConfirmNfe) btnConfirmNfe.disabled = false;

                ui.toast(`XML "${file.name}" carregado com sucesso (${totalItemsCount} materiais detectados).`, 'info');
            } catch (err) {
                ui.toast('Erro ao analisar arquivo XML: ' + err.message, 'danger');
            }
        };
        reader.readAsText(file);
    };

    if (nfeDropzone && nfeFileInput) {
        nfeDropzone.addEventListener('click', () => nfeFileInput.click());

        ['dragenter', 'dragover'].forEach(evt => {
            nfeDropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                nfeDropzone.classList.add('border-primary-500', 'bg-indigo-50/80');
            });
        });

        ['dragleave', 'drop'].forEach(evt => {
            nfeDropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                nfeDropzone.classList.remove('border-primary-500', 'bg-indigo-50/80');
            });
        });

        nfeDropzone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processNfeFile(e.dataTransfer.files[0]);
            }
        });

        nfeFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                processNfeFile(e.target.files[0]);
            }
        });
    }

    btnConfirmNfe?.addEventListener('click', async () => {
        if (!loadedNfeXmlData) {
            ui.toast('Nenhum arquivo XML carregado para importação.', 'warning');
            return;
        }

        try {
            btnConfirmNfe.disabled = true;
            btnConfirmNfe.innerHTML = '<span class="inline-block animate-spin mr-2">⟳</span> Importando...';

            const res = await StockAPI.importInvoiceXml(loadedNfeXmlData);
            ui.toast(res.message || 'Lotes importados para o estoque com sucesso!', 'success');
            window.closeNfeModal();
            loadedNfeXmlData = null;
            if (nfePreviewContainer) nfePreviewContainer.classList.add('hidden');
            if (nfePreviewTbody) nfePreviewTbody.innerHTML = '';
            if (nfeFileInput) nfeFileInput.value = '';
            await loadInventory();
        } catch (err) {
            ui.toast(err.message || 'Falha ao importar insumos via NF-e.', 'danger');
        } finally {
            if (btnConfirmNfe) {
                btnConfirmNfe.disabled = false;
                btnConfirmNfe.innerHTML = 'Importar Itens para Estoque';
            }
        }
    });

    // =========================================================================
    // 9. LEITOR DE CÓDIGO DE BARRAS (WEBCAM & SCANNER FÍSICO)
    // =========================================================================
    const cameraTab = document.getElementById('camera-tab');
    const deviceTab = document.getElementById('device-tab');
    const cameraPane = document.getElementById('camera-pane');
    const devicePane = document.getElementById('device-pane');
    const cameraStatus = document.getElementById('camera-status');
    const scannerDeviceInput = document.getElementById('scanner-device-input');

    const handleScannedBarcode = (code) => {
        window.closeBarcodeModal();
        const found = localProductsCache.find(p => p.barcode === code || p.sku === code);
        if (found) {
            ui.toast(`Insumo "${found.name}" localizado pelo código de barras!`, 'success');
            window.viewProductDetails(found._id);
        } else {
            ui.toast(`Código de barras "${code}" não associado a nenhum insumo cadastrado.`, 'warning');
            if (searchNameInput) {
                searchNameInput.value = code;
                applyFilters();
            }
        }
    };

    const startCameraScanner = () => {
        if (typeof Quagga === 'undefined') {
            if (cameraStatus) cameraStatus.innerText = 'Biblioteca Quagga indisponível. Utilize a aba "Scanner Físico".';
            return;
        }

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.querySelector('#interactive')
            },
            decoder: {
                readers: ["ean_reader", "ean_8_reader", "code_128_reader"]
            }
        }, (err) => {
            if (err) {
                if (cameraStatus) cameraStatus.innerText = 'Câmera não autorizada ou indisponível. Use a aba "Scanner Físico".';
                return;
            }
            if (cameraStatus) cameraStatus.innerText = 'Câmera ativa. Aponte para o código de barras...';
            Quagga.start();
        });

        Quagga.onDetected((result) => {
            const code = result?.codeResult?.code;
            if (code) {
                Quagga.stop();
                handleScannedBarcode(code);
            }
        });
    };

    cameraTab?.addEventListener('click', () => {
        cameraTab.className = 'px-4 py-2 text-xs font-bold border-b-2 border-primary-500 text-primary-600 dark:text-primary-400 transition';
        deviceTab.className = 'px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b-2 border-transparent hover:text-slate-700 transition';
        cameraPane?.classList.remove('hidden');
        devicePane?.classList.add('hidden');
        startCameraScanner();
    });

    deviceTab?.addEventListener('click', () => {
        deviceTab.className = 'px-4 py-2 text-xs font-bold border-b-2 border-primary-500 text-primary-600 dark:text-primary-400 transition';
        cameraTab.className = 'px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b-2 border-transparent hover:text-slate-700 transition';
        devicePane?.classList.remove('hidden');
        cameraPane?.classList.add('hidden');
        if (typeof Quagga !== 'undefined') {
            try { Quagga.stop(); } catch (e) {}
        }
        setTimeout(() => scannerDeviceInput?.focus(), 100);
    });

    scannerDeviceInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const code = scannerDeviceInput.value.trim();
            if (code) {
                handleScannedBarcode(code);
                scannerDeviceInput.value = '';
            }
        }
    });

    // Inicia carregamento do inventário
    loadInventory();
});
