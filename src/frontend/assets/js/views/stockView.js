/**
 * STOCKVISION - CONTROLADOR DO MÓDULO DE ESTOQUE (TAILWIND CSS)
 * Gerencia renderização, alertas de prejuízo, drawer acessível, modais e scanner de código de barras.
 */

document.addEventListener('DOMContentLoaded', () => {
    let localProductsCache = [];

    // Elementos DOM
    const inventoryTableBody = document.getElementById('inventory-table-body');
    const searchNameInput = document.getElementById('search-name');
    const searchCategoryInput = document.getElementById('search-category');
    const searchStatusInput = document.getElementById('search-status');
    const searchMaxPriceInput = document.getElementById('search-max-price');
    const detailsDrawer = document.getElementById('details-drawer');

    // Modais Tailwind
    const createModal = document.getElementById('create-modal');
    const editModal = document.getElementById('edit-modal');
    const barcodeModal = document.getElementById('barcode-scanner-modal');
    const nfeModal = document.getElementById('nfe-modal');

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const cardsContainer = document.getElementById('inventory-cards-container');
    const filteredCountBadge = document.getElementById('filtered-items-count');
    let quickLossFilterActive = false;

    // =========================================================================
    // 1. ATUALIZAÇÃO DOS CARDS DE CRITICIDADE (ALERTAS EM TEMPO REAL)
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
    // 2. RENDERIZAÇÃO DA TABELA E DOS CARDS MÓVEIS COM SINALIZAÇÃO DESTACADA
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
                            <i class="bi bi-exclamation-octagon-fill"></i> Prejuízo Estimado (${p.statusVisual?.unitMargin}%)
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
        const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
        searchCategoryInput.innerHTML = '<option value="">Todas as Categorias</option>' + 
            categories.map(c => `<option value="${c}">${c}</option>`).join('');
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
            if (inventoryTableBody) {
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
    // 2. DRAWER DE DETALHES (COM BOTÃO FECHAR E TECLA ESC)
    // =========================================================================
    window.viewProductDetails = (id) => {
        const product = localProductsCache.find(p => p._id === id);
        if (!product || !detailsDrawer) return;

        document.getElementById('drawer-name').innerText = product.name;
        document.getElementById('drawer-sku').innerText = product.sku || 'N/A';
        document.getElementById('drawer-barcode').innerText = product.barcode || 'N/A';
        document.getElementById('drawer-category').innerText = product.category || 'Geral';
        document.getElementById('drawer-qty').innerText = `${(product.quantityInStock || 0).toLocaleString('pt-BR')} un`;
        document.getElementById('drawer-limits').innerText = `Mín: ${product.minimumStock || 0} / Máx: ${product.maximumStock || 0}`;
        document.getElementById('drawer-supplier').innerText = product.supplier || 'Não informado';

        const loc = product.location || {};
        document.getElementById('drawer-location').innerText = `${loc.sector || 'S/S'}-R${loc.row || '0'}-P${loc.building || '0'}-N${loc.floor || '0'}-V${loc.apartment || '0'}`;

        const isExpIndet = product.isIndeterminateExpiration;
        document.getElementById('drawer-expiration').innerText = isExpIndet 
            ? 'Inperecível' 
            : (product.expirationDate ? new Date(product.expirationDate).toLocaleDateString('pt-BR') : 'Não informada');

        // Métricas Financeiras
        const totalTurnover = (product.sellingPrice || 0) * (product.quantityInStock || 0);
        const totalCost = (product.acquisitionCost || 0) * (product.quantityInStock || 0);
        const totalProfit = totalTurnover - totalCost;

        document.getElementById('drawer-cost').innerText = formatCurrency(product.acquisitionCost);
        document.getElementById('drawer-price').innerText = formatCurrency(product.sellingPrice);
        document.getElementById('drawer-turnover').innerText = formatCurrency(totalTurnover);

        const marginEl = document.getElementById('drawer-margin');
        const profitEl = document.getElementById('drawer-profit');
        const marginVal = product.statusVisual?.unitMargin || 0;

        marginEl.innerText = `${marginVal}%`;
        profitEl.innerText = formatCurrency(totalProfit);

        if (product.statusVisual?.isLossAlert) {
            marginEl.className = 'text-xs font-bold text-rose-600 dark:text-rose-400';
            profitEl.className = 'text-xs font-bold text-rose-600 dark:text-rose-400';
            document.getElementById('drawer-loss-banner').classList.remove('hidden');
        } else {
            marginEl.className = 'text-xs font-bold text-emerald-600 dark:text-emerald-400';
            profitEl.className = 'text-xs font-bold text-emerald-600 dark:text-emerald-400';
            document.getElementById('drawer-loss-banner').classList.add('hidden');
        }

        detailsDrawer.classList.remove('translate-x-full');
    };

    window.closeProductDetails = () => {
        if (detailsDrawer) detailsDrawer.classList.add('translate-x-full');
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProductDetails();
            toggleModal(createModal, false);
            toggleModal(editModal, false);
            toggleModal(nfeModal, false);
            toggleModal(barcodeModal, false);
        }
    });

    // =========================================================================
    // 3. MODAIS TAILWIND (CADASTRO, EDIÇÃO, SCANNER E NF-E)
    // =========================================================================
    const toggleModal = (modalEl, show) => {
        if (!modalEl) return;
        if (show) {
            modalEl.classList.remove('hidden');
            requestAnimationFrame(() => {
                modalEl.classList.remove('opacity-0');
                modalEl.classList.add('opacity-100');
                const inner = modalEl.querySelector('.modal-content-box') || modalEl.querySelector('div');
                inner?.classList.remove('scale-95');
                inner?.classList.add('scale-100');
            });
        } else {
            modalEl.classList.remove('opacity-100');
            modalEl.classList.add('opacity-0');
            const inner = modalEl.querySelector('.modal-content-box') || modalEl.querySelector('div');
            inner?.classList.remove('scale-100');
            inner?.classList.add('scale-95');
            setTimeout(() => modalEl.classList.add('hidden'), 200);
        }
    };

    window.openCreateModal = () => toggleModal(createModal, true);
    window.closeCreateModal = () => toggleModal(createModal, false);
    window.closeEditModal = () => toggleModal(editModal, false);
    window.openNfeModal = () => toggleModal(nfeModal, true);
    window.closeNfeModal = () => toggleModal(nfeModal, false);
    window.openBarcodeModal = () => toggleModal(barcodeModal, true);
    window.closeBarcodeModal = () => {
        toggleModal(barcodeModal, false);
        if (typeof Quagga !== 'undefined') {
            try { Quagga.stop(); } catch(e){}
        }
    };

    // Validação reativa de Alerta de Prejuízo no formulário de Cadastro
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

    // Validação reativa de Alerta de Prejuízo no formulário de Edição
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

    // Toggle Validade no Cadastro
    const isIndetCheckbox = document.getElementById('isIndeterminateExpiration');
    const expContainer = document.getElementById('expiration-container');
    const expDateInput = document.getElementById('expirationDate');

    isIndetCheckbox?.addEventListener('change', () => {
        if (isIndetCheckbox.checked) {
            expContainer.classList.add('hidden');
            if (expDateInput) expDateInput.value = '';
        } else {
            expContainer.classList.remove('hidden');
        }
    });

    // Submissão do Cadastro de Produto
    const productForm = document.getElementById('product-form');
    productForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const cost = parseFloat(createCostInput.value);
        const price = parseFloat(createPriceInput.value);
        const minStock = parseInt(document.getElementById('minimumStock').value, 10);
        const maxStock = parseInt(document.getElementById('maximumStock').value, 10);

        if (minStock > maxStock) {
            ui.toast('Atenção: O estoque mínimo não pode ser maior que o estoque máximo!', 'warning');
            return;
        }

        const payload = {
            name: document.getElementById('name').value.trim(),
            category: document.getElementById('category').value.trim(),
            barcode: document.getElementById('barcode').value.trim(),
            acquisitionCost: cost,
            sellingPrice: price,
            quantityInStock: parseInt(document.getElementById('quantityInStock').value, 10),
            minimumStock: minStock,
            maximumStock: maxStock,
            isIndeterminateExpiration: isIndetCheckbox.checked,
            expirationDate: isIndetCheckbox.checked ? null : expDateInput.value,
            location: {
                sector: document.getElementById('sector').value.trim().toUpperCase(),
                row: document.getElementById('row').value.trim(),
                building: document.getElementById('building').value.trim(),
                floor: document.getElementById('floor').value.trim(),
                apartment: document.getElementById('apartment').value.trim()
            }
        };

        try {
            const res = await StockAPI.createProduct(payload);
            ui.toast(res.message || 'Insumo cadastrado com sucesso!', 'success');
            toggleModal(createModal, false);
            productForm.reset();
            loadInventory();
        } catch (err) {
            ui.toast(err.message || 'Erro ao cadastrar material.', 'danger');
        }
    });

    // Abrir Modal de Edição
    window.openEditModal = (id) => {
        const prod = localProductsCache.find(p => p._id === id);
        if (!prod) return;

        document.getElementById('edit-id').value = prod._id;
        document.getElementById('edit-name').value = prod.name;
        document.getElementById('edit-category').value = prod.category || '';
        document.getElementById('edit-acquisitionCost').value = prod.acquisitionCost ?? 0;
        document.getElementById('edit-sellingPrice').value = prod.sellingPrice ?? 0;
        document.getElementById('edit-quantity').value = prod.quantityInStock ?? 0;
        document.getElementById('edit-minimumStock').value = prod.minimumStock ?? 0;
        document.getElementById('edit-maximumStock').value = prod.maximumStock ?? 0;
        document.getElementById('edit-supplier').value = prod.supplier || '';
        document.getElementById('edit-barcode').value = prod.barcode || '';

        const editIndet = document.getElementById('edit-isIndeterminateExpiration');
        const editExpContainer = document.getElementById('edit-expiration-container');
        const editExpDate = document.getElementById('edit-expirationDate');

        editIndet.checked = Boolean(prod.isIndeterminateExpiration);
        if (editIndet.checked) {
            editExpContainer.classList.add('hidden');
            editExpDate.value = '';
        } else {
            editExpContainer.classList.remove('hidden');
            editExpDate.value = prod.expirationDate ? new Date(prod.expirationDate).toISOString().slice(0, 10) : '';
        }

        const loc = prod.location || {};
        document.getElementById('edit-sector').value = loc.sector || '';
        document.getElementById('edit-row').value = loc.row || '';
        document.getElementById('edit-building').value = loc.building || '';
        document.getElementById('edit-floor').value = loc.floor || '';
        document.getElementById('edit-apartment').value = loc.apartment || '';

        checkEditMargin();
        toggleModal(editModal, true);
    };

    // Submissão da Edição de Produto
    const editForm = document.getElementById('edit-product-form');
    editForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const minStock = parseInt(document.getElementById('edit-minimumStock').value, 10);
        const maxStock = parseInt(document.getElementById('edit-maximumStock').value, 10);

        if (minStock > maxStock) {
            ui.toast('Atenção: O estoque mínimo não pode ser maior que o estoque máximo!', 'warning');
            return;
        }

        const editIndet = document.getElementById('edit-isIndeterminateExpiration');
        const editExpDate = document.getElementById('edit-expirationDate');

        const payload = {
            name: document.getElementById('edit-name').value.trim(),
            category: document.getElementById('edit-category').value.trim(),
            acquisitionCost: parseFloat(document.getElementById('edit-acquisitionCost').value),
            sellingPrice: parseFloat(document.getElementById('edit-sellingPrice').value),
            quantityInStock: parseInt(document.getElementById('edit-quantity').value, 10),
            minimumStock: minStock,
            maximumStock: maxStock,
            supplier: document.getElementById('edit-supplier').value.trim(),
            barcode: document.getElementById('edit-barcode').value.trim(),
            isIndeterminateExpiration: editIndet.checked,
            expirationDate: editIndet.checked ? null : editExpDate.value,
            location: {
                sector: document.getElementById('edit-sector').value.trim().toUpperCase(),
                row: document.getElementById('edit-row').value.trim(),
                building: document.getElementById('edit-building').value.trim(),
                floor: document.getElementById('edit-floor').value.trim(),
                apartment: document.getElementById('edit-apartment').value.trim()
            }
        };

        try {
            const res = await StockAPI.updateProduct(id, payload);
            ui.toast(res.message || 'Insumo atualizado com sucesso!', 'success');
            toggleModal(editModal, false);
            loadInventory();
        } catch (err) {
            ui.toast(err.message || 'Erro ao atualizar insumo.', 'danger');
        }
    });

    // Exclusão Segura de Produto com Modal Moderno
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
                loadInventory();
            } catch (err) {
                ui.toast(err.message || 'Falha ao remover material.', 'danger');
            }
        }
    };

    // =========================================================================
    // 4. INGESTÃO DE NF-E (XML DRAG & DROP E FILE INPUT)
    // =========================================================================
    const xmlFileInput = document.getElementById('xml-file-input');
    const xmlDropZone = document.getElementById('xml-drop-zone');
    const xmlContentArea = document.getElementById('xml-content-area');
    const nfeForm = document.getElementById('nfe-form');

    const handleXmlFile = (file) => {
        if (!file || !file.name.endsWith('.xml')) {
            ui.toast('Por favor, selecione um arquivo válido com extensão .xml (NF-e).', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            if (xmlContentArea) {
                xmlContentArea.value = e.target.result;
                ui.toast(`Arquivo "${file.name}" carregado com sucesso (${(file.size / 1024).toFixed(1)} KB).`, 'info');
            }
        };
        reader.readAsText(file);
    };

    xmlFileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleXmlFile(e.target.files[0]);
    });

    if (xmlDropZone) {
        ['dragenter', 'dragover'].forEach(evt => {
            xmlDropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                xmlDropZone.classList.add('border-primary-500', 'bg-primary-50/50');
            });
        });
        ['dragleave', 'drop'].forEach(evt => {
            xmlDropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                xmlDropZone.classList.remove('border-primary-500', 'bg-primary-50/50');
            });
        });
        xmlDropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files.length > 0) handleXmlFile(e.dataTransfer.files[0]);
        });
    }

    nfeForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const xmlData = xmlContentArea?.value.trim();
        if (!xmlData) {
            ui.toast('O conteúdo do arquivo XML não pode estar vazio.', 'warning');
            return;
        }

        try {
            const submitBtn = document.getElementById('nfe-submit-btn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="inline-block animate-spin mr-2">⟳</span> Processando NF-e...';

            const res = await StockAPI.importInvoiceXml(xmlData);
            ui.toast(res.message || 'Nota Fiscal processada com sucesso!', 'success', 6000);
            toggleModal(nfeModal, false);
            if (xmlContentArea) xmlContentArea.value = '';
            loadInventory();
        } catch (err) {
            ui.toast(err.message || 'Falha ao processar arquivo XML da NF-e.', 'danger');
        } finally {
            const submitBtn = document.getElementById('nfe-submit-btn');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Processar Ingestão de Lotes</span>';
        }
    });

    // Inicia carregamento dos produtos
    loadInventory();
});
