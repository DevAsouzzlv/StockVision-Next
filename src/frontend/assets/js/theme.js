/**
 * STOCKVISION - GERENCIADOR DE TEMA LIGHT / DARK NATIVO PARA TAILWIND CSS
 * Sincroniza a classe 'dark' no elemento raiz <html> e persiste em localStorage.
 */

(() => {
    const getStoredTheme = () => {
        const stored = localStorage.getItem('theme') || localStorage.getItem('sv_theme');
        if (stored) return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const applyTheme = (theme) => {
        const isDark = theme === 'dark';
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('theme', theme);
        localStorage.setItem('sv_theme', theme);

        const themeToggle = document.getElementById('theme-toggle');
        const icon = themeToggle ? themeToggle.querySelector('i') : null;
        if (icon) {
            if (isDark) {
                icon.className = 'bi bi-sun-fill text-amber-400 text-lg';
            } else {
                icon.className = 'bi bi-moon-stars-fill text-slate-600 dark:text-slate-300 text-lg';
            }
        }
    };

    // Aplica imediatamente para evitar flash de cor branca (FOUC)
    applyTheme(getStoredTheme());

    document.addEventListener('DOMContentLoaded', () => {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            applyTheme(getStoredTheme());
            themeToggle.addEventListener('click', () => {
                const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
                const next = current === 'dark' ? 'light' : 'dark';
                applyTheme(next);
            });
        }
    });

    window.toggleStockVisionTheme = () => {
        const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        applyTheme(current === 'dark' ? 'light' : 'dark');
    };
})();