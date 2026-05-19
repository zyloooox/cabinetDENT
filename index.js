/**
 * CTA « Prendre rendez-vous » : page adaptée si l’utilisateur est déjà connecté.
 */
(function () {
    const API_BASE = typeof getApiBase === 'function' ? getApiBase() : '';

    async function initRdvCta() {
        const link = document.getElementById('ctaRdvLink');
        if (!link || !API_BASE) return;

        try {
            const res = await fetch(`${API_BASE}auth.php?action=me`, {
                method: 'GET',
                credentials: 'same-origin',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success || !data.user) return;

            const role = data.user.role;
            if (role === 'admin' || role === 'medecin') {
                link.href = 'gestion-rdv.html';
            } else {
                link.href = 'reserver-rdv.html';
            }
        } catch {
            /* garde le lien inscription par défaut */
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRdvCta);
    } else {
        initRdvCta();
    }
})();
