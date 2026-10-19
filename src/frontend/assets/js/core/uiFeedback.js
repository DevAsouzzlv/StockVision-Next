/**
 * STOCKVISION - MÓDULO DE FEEDBACK VISUAL & DIÁLOGOS (TAILWIND CSS)
 * Substitui integralmente window.alert() e window.confirm() por componentes modernos e acessíveis.
 */

const ui = (() => {
    // 1. Cria ou obtém o container flutuante de Toasts
    const getToastContainer = () => {
        let container = document.getElementById('sv-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'sv-toast-container';
            container.className = 'fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0';
            document.body.appendChild(container);
        }
        return container;
    };

    /**
     * Exibe um Toast moderno com auto-dismiss
     * @param {string} message - Texto da notificação
     * @param {'success'|'danger'|'warning'|'info'} type - Estilo visual
     * @param {number} duration - Tempo de exibição em ms (padrão: 4000)
     */
    const toast = (message, type = 'info', duration = 4000) => {
        const container = getToastContainer();

        const toastEl = document.createElement('div');
        toastEl.className = 'pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border text-sm transition-all duration-300 transform translate-y-2 opacity-0';

        const configs = {
            success: {
                bg: 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
                icon: '✓'
            },
            danger: {
                bg: 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200',
                icon: '✕'
            },
            warning: {
                bg: 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
                icon: '⚠'
            },
            info: {
                bg: 'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
                icon: 'ℹ'
            }
        };

        const config = configs[type] || configs.info;
        toastEl.className += ` ${config.bg}`;

        toastEl.innerHTML = `
            <div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs bg-white/60 dark:bg-black/20">
                ${config.icon}
            </div>
            <div class="flex-1 font-medium leading-relaxed">${message}</div>
            <button type="button" class="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1 text-base leading-none">&times;</button>
        `;

        const closeBtn = toastEl.querySelector('button');
        const dismiss = () => {
            toastEl.classList.remove('opacity-100', 'translate-y-0');
            toastEl.classList.add('opacity-0', '-translate-y-2');
            setTimeout(() => toastEl.remove(), 300);
        };

        closeBtn.addEventListener('click', dismiss);
        container.appendChild(toastEl);

        // Animação de entrada
        requestAnimationFrame(() => {
            toastEl.classList.remove('opacity-0', 'translate-y-2');
            toastEl.classList.add('opacity-100', 'translate-y-0');
        });

        // Auto dismiss
        if (duration > 0) {
            setTimeout(dismiss, duration);
        }
    };

    /**
     * Exibe um Modal de Confirmação assíncrono (Promise<boolean>)
     */
    const confirm = ({
        title = 'Confirmar Ação',
        message = 'Deseja realmente prosseguir com esta operação?',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        isDestructive = false
    } = {}) => {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'fixed inset-0 z-[9998] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-200 opacity-0';

            const confirmBtnClass = isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-primary-600 hover:bg-primary-700 text-white';

            backdrop.innerHTML = `
                <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 max-w-md w-full p-6 transform scale-95 transition-transform duration-200">
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">${title}</h3>
                    <p class="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">${message}</p>
                    <div class="flex items-center justify-end gap-3">
                        <button type="button" id="sv-modal-cancel" class="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                            ${cancelText}
                        </button>
                        <button type="button" id="sv-modal-confirm" class="px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${confirmBtnClass}">
                            ${confirmText}
                        </button>
                    </div>
                </div>
            `;

            const cleanup = (result) => {
                backdrop.classList.remove('opacity-100');
                backdrop.classList.add('opacity-0');
                setTimeout(() => backdrop.remove(), 200);
                document.removeEventListener('keydown', handleKey);
                resolve(result);
            };

            const handleKey = (e) => {
                if (e.key === 'Escape') cleanup(false);
            };

            backdrop.querySelector('#sv-modal-cancel').addEventListener('click', () => cleanup(false));
            backdrop.querySelector('#sv-modal-confirm').addEventListener('click', () => cleanup(true));
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) cleanup(false);
            });
            document.addEventListener('keydown', handleKey);

            document.body.appendChild(backdrop);
            requestAnimationFrame(() => {
                backdrop.classList.remove('opacity-0');
                backdrop.classList.add('opacity-100');
                backdrop.querySelector('.bg-white')?.classList.remove('scale-95');
                backdrop.querySelector('.bg-white')?.classList.add('scale-100');
            });
        });
    };

    /**
     * Disparo padronizado do fluxo de logout seguro
     */
    const handleLogout = async () => {
        const confirmed = await confirm({
            title: 'Encerrar Sessão',
            message: 'Deseja realmente sair da sua conta corporativa no StockVision?',
            confirmText: 'Sair do Sistema',
            cancelText: 'Permanecer',
            isDestructive: true
        });

        if (confirmed) {
            AuthAPI.logout();
        }
    };

    return {
        toast,
        confirm,
        handleLogout
    };
})();

// Exporta globalmente para compatibilidade
window.ui = ui;
window.handleUserLogout = ui.handleLogout;
