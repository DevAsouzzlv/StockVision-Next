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

    const initProfileDisplays = () => {
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

        const initials = (user.fullname || 'SV')
            .trim()
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

        const applyAvatar = (el) => {
            if (!el) return;
            if (user.avatarUrl && user.avatarUrl.trim() !== '') {
                el.innerHTML = `<img src="${user.avatarUrl}" alt="${user.fullname}" class="w-full h-full object-cover rounded-full" onerror="this.parentElement.innerText='${initials}'">`;
            } else {
                el.innerText = initials;
            }
        };

        // Sidebar
        applyAvatar(document.getElementById('sidebar-user-avatar'));
        const sidebarNameEl = document.getElementById('sidebar-user-name');
        const sidebarRoleEl = document.getElementById('sidebar-user-role');
        if (sidebarNameEl) sidebarNameEl.innerText = user.fullname || 'Usuário';
        if (sidebarRoleEl) sidebarRoleEl.innerText = user.jobTitle || (user.isAdmin ? 'ADMINISTRADOR' : 'GESTOR WMS');

        // Topbar / Header
        applyAvatar(document.getElementById('topbar-avatar'));
        const topbarNameEl = document.getElementById('topbar-user-name');
        if (topbarNameEl) topbarNameEl.innerText = user.fullname || 'Usuário';

        // Cabeçalhos de boas-vindas
        const userNameDisplays = document.querySelectorAll('#user-name-display');
        userNameDisplays.forEach(el => {
            if (el.tagName === 'H1') el.innerText = `Olá, ${user.fullname || 'Gestor'}`;
        });

        const companyDisplays = document.querySelectorAll('#user-company-display, #company-name-display');
        companyDisplays.forEach(el => {
            el.innerText = user.company || 'StockVision WMS';
        });
    };

    const handleLogoutAction = async (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        let confirmed = true;
        if (typeof uiFeedback !== 'undefined') {
            confirmed = await uiFeedback.confirm({
                title: 'Encerrar Sessão Corporativa',
                message: 'Deseja realmente sair do StockVision? Seus dados e modificações foram preservados com segurança.',
                confirmText: 'Sair Agora',
                confirmClass: 'bg-rose-600 hover:bg-rose-700'
            });
        } else {
            confirmed = confirm('Deseja realmente encerrar a sessão corporativa?');
        }

        if (confirmed) {
            if (typeof AuthAPI !== 'undefined' && AuthAPI.logout) {
                AuthAPI.logout();
            } else if (typeof TokenManager !== 'undefined') {
                TokenManager.clearAll();
                const isInsideViews = window.location.pathname.includes('/views/');
                window.location.replace(isInsideViews ? 'login.html' : 'views/login.html');
            } else {
                localStorage.removeItem('sv_token');
                localStorage.removeItem('sv_user');
                const isInsideViews = window.location.pathname.includes('/views/');
                window.location.replace(isInsideViews ? 'login.html' : 'views/login.html');
            }
        }
    };

    const initSidebar = () => {
        const sidebarEl = document.getElementById('app-sidebar');
        if (sidebarEl) {
            // 1. Aplica estado persistido
            const isCollapsed = getStoredState();
            applySidebarState(sidebarEl, isCollapsed);

            // 2. Listener do botão de recolher/expandir
            const toggleBtn = document.getElementById('btn-toggle-sidebar');
            if (toggleBtn) {
                toggleBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const nowCollapsed = !sidebarEl.classList.contains('is-collapsed');
                    applySidebarState(sidebarEl, nowCollapsed);
                    setStoredState(nowCollapsed);
                };
            }
        }

        // 3. Popula informações do usuário em toda a UI
        initProfileDisplays();

        // 4. Conecta listeners de Logout Unificados (Menu Lateral e Cabeçalho)
        const logoutElements = document.querySelectorAll('#btn-sidebar-logout, #btn-header-logout, .btn-logout, [data-action="logout"]');
        logoutElements.forEach(el => {
            el.onclick = handleLogoutAction;
        });
    };

    // Inicializa quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }

    // Expõe globalmente
    window.SidebarManager = {
        init: initSidebar,
        logout: handleLogoutAction,
        refreshProfile: initProfileDisplays,
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
