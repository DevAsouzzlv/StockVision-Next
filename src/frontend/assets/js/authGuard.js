/**
* STOCKVISION - BARREIRA DE SEGURANÇA DE AUTENTICAÇÃO (Auth Guard)
* Executa imediatamente para bloquear acessos não autorizados e limpar cache de histórico.
*/
(() => {
    const publicPages = ['login.html', 'register.html', 'reset-password.html', 'index.html'];
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const hasSession = Boolean(localStorage.getItem('sv_token') && localStorage.getItem('sv_user'));
    const baseFolder = window.location.pathname.includes('/views/') ? '' : 'views/';

    const redirectTo = (target) => {
        const finalTarget = target.startsWith('http') ? target : `${baseFolder}${target}`;
        window.location.replace(finalTarget);
    };

    const checkAuth = () => {
        if (publicPages.includes(currentPath)) {
            if (hasSession && currentPath !== 'index.html') {
                redirectTo('dashboard.html');
            }
            return;
        }

        if (!hasSession) {
            redirectTo('login.html');
        }
    };

    checkAuth();

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            checkAuth();
        }
    });
})();