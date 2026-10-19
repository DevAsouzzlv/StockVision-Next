/**
 * STOCKVISION - BARREIRA DE SEGURANÇA DE AUTENTICAÇÃO (Auth Guard)
 * Executa imediatamente para bloquear acessos não autorizados, blindar contra vazamento
 * visual de telas confidenciais (anti-FOUC) e gerenciar redirecionamentos limpos.
 */
(() => {
    const publicPages = ['login.html', 'register.html', 'reset-password.html', 'index.html'];
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const hasSession = Boolean(localStorage.getItem('sv_token') && localStorage.getItem('sv_user'));
    const isInsideViews = window.location.pathname.includes('/views/');
    const baseFolder = isInsideViews ? '' : 'views/';

    const redirectTo = (target) => {
        // Bloqueia a exibição visual da página atual para prevenir flicker de dados confidenciais
        document.documentElement.style.visibility = 'hidden';
        const finalTarget = target.startsWith('http') ? target : `${baseFolder}${target}`;
        window.location.replace(finalTarget);
    };

    const checkAuth = () => {
        const isPublic = publicPages.includes(currentPath);

        if (isPublic) {
            if (hasSession && currentPath !== 'index.html') {
                redirectTo('dashboard.html');
            }
            return;
        }

        // Rota protegida: exige token corporativo e registro do usuário
        if (!hasSession) {
            redirectTo('login.html');
        }
    };

    checkAuth();

    // Tratamento para histórico/cache de navegação retroativa (BFCache)
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            checkAuth();
        }
    });

    // Escuta evento corporativo de token expirado ou inválido (401/403)
    window.addEventListener('sv:unauthorized', () => {
        localStorage.removeItem('sv_token');
        localStorage.removeItem('sv_user');
        redirectTo('login.html');
    });
})();