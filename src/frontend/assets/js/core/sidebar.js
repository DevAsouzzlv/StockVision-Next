/**
 * STOCKVISION - COMPONENTE DE BARRA LATERAL FLUTUANTE (COLLAPSIBLE SIDEBAR)
 * Gerencia o estado Expandido / Recolhido (Mini-Sidebar), Tooltips e Sincronização de Perfil.
 */

(function () {
    const STORAGE_KEY = 'sv_sidebar_collapsed';

    const getStoredState = () => {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    };

    const setStoredState = (isCollapsed) => {
        try {
            localStorage.setItem(STORAGE_KEY, String(isCollapsed));
        } catch (e) {
            console.warn('[Sidebar] Falha ao persistir estado:', e);
        }
    };

    const applySidebarState = (sidebarEl, isCollapsed) => {
        if (!sidebarEl) return;
        const toggleIcon = document.getElementById('sidebar-toggle-icon');

        if (isCollapsed) {
            sidebarEl.classList.add('is-collapsed');
            if (toggleIcon) {
                toggleIcon.className = 'bi bi-chevron-right text-xs';
            }
        } else {
            sidebarEl.classList.remove('is-collapsed');
            if (toggleIcon) {
                toggleIcon.className = 'bi bi-chevron-left text-xs';
            }
        }
    };

    const initSidebarProfile = () => {
        let user = null;
        if (typeof TokenManager !== 'undefined' && TokenManager.getUser) {
            user = TokenManager.getUser();
        }
        if (!user) {
            try {
                user = JSON.parse(localStorage.getItem('sv_user') || 'null');
            } catch {
                user = null;
            }
        }
        if (!user) return;

        const avatarEl = document.getElementById('sidebar-user-avatar');
        const nameEl = document.getElementById('sidebar-user-name');
        const roleEl = document.getElementById('sidebar-user-role');

        const initials = (user.fullname || 'SV')
            .trim()
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

        if (avatarEl) avatarEl.innerText = initials;
        if (nameEl) nameEl.innerText = user.fullname || 'Usuário';
        if (roleEl) roleEl.innerText = user.jobTitle || (user.isAdmin ? 'ADMINISTRADOR' : 'GESTOR WMS');
    };

    const initSidebar = () => {
        const sidebarEl = document.getElementById('app-sidebar');
        if (!sidebarEl) return;

        // 1. Aplica estado persistido
        const isCollapsed = getStoredState();
        applySidebarState(sidebarEl, isCollapsed);

        // 2. Popula informações do usuário
        initSidebarProfile();

        // 3. Listener do botão de recolher/expandir
        const toggleBtn = document.getElementById('btn-toggle-sidebar');
        if (toggleBtn) {
            // Remove listeners antigos caso reinicializado
            toggleBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const nowCollapsed = !sidebarEl.classList.contains('is-collapsed');
                applySidebarState(sidebarEl, nowCollapsed);
                setStoredState(nowCollapsed);
            };
        }

        // 4. Listener do Logout Unificado
        const logoutBtn = document.getElementById('btn-sidebar-logout');
        if (logoutBtn) {
            logoutBtn.onclick = async (e) => {
                e.preventDefault();
                let confirmed = true;
                if (typeof uiFeedback !== 'undefined') {
                    confirmed = await uiFeedback.confirm({
                        title: 'Encerrar Sessão Corporativa',
                        message: 'Deseja realmente sair do StockVision? Seus dados salvos permanecem seguros.',
                        confirmText: 'Sair Agora',
                        confirmClass: 'bg-rose-600 hover:bg-rose-700'
                    });
                } else {
                    confirmed = confirm('Deseja realmente encerrar a sessão corporativa?');
                }

                if (confirmed) {
                    if (typeof TokenManager !== 'undefined') {
                        TokenManager.clearAll();
                    } else {
                        localStorage.removeItem('sv_token');
                        localStorage.removeItem('sv_user');
                    }
                    const isInsideViews = window.location.pathname.includes('/views/');
                    window.location.href = isInsideViews ? 'login.html' : 'views/login.html';
                }
            };
        }
    };

    // Inicializa quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }

    // Expõe globalmente se necessário
    window.SidebarManager = {
        init: initSidebar,
        toggle: () => {
            const sidebarEl = document.getElementById('app-sidebar');
            if (sidebarEl) {
                const nowCollapsed = !sidebarEl.classList.contains('is-collapsed');
                applySidebarState(sidebarEl, nowCollapsed);
                setStoredState(nowCollapsed);
            }
        }
    };
})();
