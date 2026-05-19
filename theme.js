/**
 * Thème clair / sombre persistant via cookie (cabinet_theme=light|dark).
 * Charger ce fichier dans <head> avant style.css pour limiter le flash.
 */
(function () {
    var COOKIE = 'cabinet_theme';

    function basePath() {
        var p = window.location.pathname || '/';
        var i = p.lastIndexOf('/');
        return i >= 0 ? p.slice(0, i + 1) || '/' : '/';
    }

    function readTheme() {
        try {
            var raw = document.cookie || '';
            var prefix = COOKIE + '=';
            var chunks = raw.split('; ');
            for (var i = 0; i < chunks.length; i++) {
                var chunk = chunks[i];
                if (chunk.indexOf(prefix) === 0) {
                    var v = chunk.slice(prefix.length).trim();
                    return v === 'dark' ? 'dark' : 'light';
                }
            }
            return 'light';
        } catch (e) {
            return 'light';
        }
    }

    function writeTheme(theme) {
        var t = theme === 'dark' ? 'dark' : 'light';
        var maxAge = 60 * 60 * 24 * 400;
        document.cookie =
            COOKIE + '=' + t + '; Max-Age=' + maxAge + '; Path=' + basePath() + '; SameSite=Lax';
    }

    function applyTheme(theme) {
        var t = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = t;
        document.documentElement.style.colorScheme = t === 'dark' ? 'dark' : 'light';
    }

    applyTheme(readTheme());

    function iconHtml(isDark) {
        return isDark
            ? '<i class="fas fa-sun" aria-hidden="true"></i>'
            : '<i class="fas fa-moon" aria-hidden="true"></i>';
    }

    function syncButton(btn) {
        if (!btn) {
            return;
        }
        var isDark = document.documentElement.dataset.theme === 'dark';
        btn.innerHTML = iconHtml(isDark);
        btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
        btn.setAttribute(
            'aria-label',
            isDark ? 'Activer le mode clair' : 'Activer le mode sombre'
        );
        btn.title = isDark ? 'Mode clair' : 'Mode sombre';
    }

    function toggle() {
        var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        writeTheme(next);
        syncButton(document.getElementById('themeToggleBtn'));
    }

    function init() {
        var nav = document.querySelector('header nav');
        if (!nav || document.getElementById('themeToggleBtn')) {
            return;
        }
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'themeToggleBtn';
        btn.className = 'theme-toggle-btn';
        btn.addEventListener('click', toggle);
        nav.insertBefore(btn, nav.firstChild);
        syncButton(btn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
