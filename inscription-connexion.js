/**
 * Page unifiée : onglets Connexion / Inscription.
 */
const API_BASE = getApiBase();

/**
 * Lit la réponse HTTP (JSON ou message d'erreur HTML).
 */
async function parseAuthResponse(response) {
    const raw = await response.text();
    let data = {};
    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch {
            const snippet = raw.replace(/<[^>]+>/g, ' ').trim().slice(0, 120);
            throw new Error(
                response.status >= 400
                    ? `Le serveur a renvoyé une page d'erreur (HTTP ${response.status}). Ouvrez le site via http://localhost/... avec Apache XAMPP démarré.`
                    : `Réponse non JSON (HTTP ${response.status}). ${snippet || 'Vérifiez auth.php et les logs PHP.'}`
            );
        }
    }
    return { ok: response.ok, status: response.status, data };
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.protocol === 'file:') {
        const box = document.createElement('div');
        box.className = 'message error';
        box.style.marginBottom = '1.25rem';
        box.innerHTML =
            '<strong><i class="fas fa-exclamation-triangle"></i> Mauvaise ouverture du site.</strong> ' +
            'Les pages ouvertes en <code>file://</code> ne peuvent pas exécuter PHP. ' +
            'Dans la barre d’adresse, utilisez par exemple : ' +
            '<code>http://localhost/projet%20html%20-%20Copie/inscription-connexion.html</code> ' +
            '(démarrez <strong>Apache</strong> dans XAMPP).';
        document.querySelector('.container-custom')?.prepend(box);
    }

    initTabs();
    const h = (window.location.hash || '').toLowerCase().replace(/^#/, '');
    if (h === 'inscription') {
        switchPanel('register');
    } else {
        switchPanel('login');
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const inscForm = document.getElementById('inscriptionForm');
    if (inscForm) inscForm.addEventListener('submit', handleRegister);

    const linkGoLogin = document.getElementById('linkGoLogin');
    if (linkGoLogin) {
        linkGoLogin.addEventListener('click', () => {
            const tab = document.getElementById('tabLogin');
            if (tab) tab.click();
            window.location.hash = 'connexion';
        });
    }

    window.addEventListener('hashchange', applyHashPanel);

    initPasswordToggles();
});

/**
 * Boutons œil : afficher / masquer le mot de passe
 */
function initPasswordToggles() {
    document.querySelectorAll('.password-toggle[data-password-target]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-password-target');
            const input = id ? document.getElementById(id) : null;
            if (!input) return;
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
            }
            btn.setAttribute('aria-pressed', show ? 'true' : 'false');
            btn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
        });
    });
}

function applyHashPanel() {
    const h = (window.location.hash || '').toLowerCase().replace(/^#/, '');
    switchPanel(h === 'inscription' ? 'register' : 'login');
}

function initTabs() {
    document.querySelectorAll('.auth-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            const panel = btn.getAttribute('data-panel');
            if (panel === 'login' || panel === 'register') {
                switchPanel(panel);
                window.location.hash = panel === 'register' ? 'inscription' : 'connexion';
                document.querySelectorAll('.auth-tab').forEach((b) => {
                    b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
                });
            }
        });
    });
}

function switchPanel(which) {
    const loginPanel = document.getElementById('authPanelLogin');
    const regPanel = document.getElementById('authPanelRegister');
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');

    const isLogin = which === 'login';
    if (loginPanel) loginPanel.classList.toggle('hidden', !isLogin);
    if (regPanel) regPanel.classList.toggle('hidden', isLogin);
    if (tabLogin) {
        tabLogin.classList.toggle('active', isLogin);
        tabLogin.setAttribute('aria-selected', isLogin ? 'true' : 'false');
    }
    if (tabRegister) {
        tabRegister.classList.toggle('active', !isLogin);
        tabRegister.setAttribute('aria-selected', !isLogin ? 'true' : 'false');
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const formData = {
        email: document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value,
    };

    try {
        let response;
        try {
            response = await fetch(`${API_BASE}auth.php?action=login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(formData),
            });
        } catch (netErr) {
            showLoginMessage(
                'Impossible de contacter le serveur. Utilisez l’adresse http://localhost/... (Apache XAMPP allumé), pas un fichier ouvert en double-clic.',
                'error'
            );
            console.error(netErr);
            return;
        }

        const { ok, status, data: result } = await parseAuthResponse(response);

        if (result.success) {
            showLoginMessage('Connexion réussie !', 'success');
            setTimeout(() => {
                const role = result.user && result.user.role;
                let dest = 'mon-compte.html';
                if (role === 'admin' || role === 'medecin') dest = 'gestion-rdv.html';
                window.location.href = dest;
            }, 900);
            return;
        }

        const msg = result.message || (ok ? 'Connexion refusée' : `Erreur HTTP ${status}`);
        showLoginMessage(msg, 'error');
    } catch (err) {
        showLoginMessage(err.message || 'Erreur de connexion', 'error');
        console.error(err);
    }
}

function showLoginMessage(message, type) {
    const errorDiv = document.getElementById('loginErrorMessage');
    if (errorDiv) {
        errorDiv.style.display = 'block';
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
        errorDiv.innerHTML = `<i class="fas ${icon}"></i> ${escapeHtml(message)}`;
        errorDiv.className = `message ${type}`;
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, type === 'success' ? 2000 : 5000);
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const password = document.getElementById('inscPassword').value;
    const confirmPassword = document.getElementById('inscConfirmPassword').value;

    if (password !== confirmPassword) {
        showRegisterMessage('Les mots de passe ne correspondent pas', 'error');
        return;
    }

    if (password.length < 8) {
        showRegisterMessage('Le mot de passe doit contenir au moins 8 caractères', 'error');
        return;
    }

    if (!document.getElementById('inscConditions').checked) {
        showRegisterMessage('Vous devez accepter les conditions générales', 'error');
        return;
    }

    const nomComplet = document.getElementById('inscNom').value.trim();
    const parts = nomComplet.split(/\s+/).filter(Boolean);
    const prenom = parts[0] || nomComplet;
    const nom = parts.length > 1 ? parts.slice(1).join(' ') : prenom;

    const formData = {
        nom,
        prenom,
        civilite: document.getElementById('inscCivilite').value,
        date_naissance: document.getElementById('inscNaissance').value,
        email: document.getElementById('inscEmail').value,
        telephone: document.getElementById('inscTelephone').value,
        adresse: document.getElementById('inscAdresse').value || null,
        password,
        newsletter: document.getElementById('inscNewsletter').checked ? 1 : 0,
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        showRegisterMessage('Email invalide', 'error');
        return;
    }

    showRegisterLoading(true);

    try {
        let response;
        try {
            response = await fetch(`${API_BASE}auth.php?action=register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(formData),
            });
        } catch (netErr) {
            showRegisterMessage(
                'Impossible de contacter le serveur. Ouvrez le site via http://localhost/... avec XAMPP (Apache).',
                'error'
            );
            console.error(netErr);
            return;
        }

        const { ok, status, data: result } = await parseAuthResponse(response);

        if (result.success) {
            showRegisterMessage('Inscription réussie ! Redirection...', 'success');
            setTimeout(() => {
                const role = result.user && result.user.role;
                let dest = 'mon-compte.html';
                if (role === 'admin' || role === 'medecin') dest = 'gestion-rdv.html';
                window.location.href = dest;
            }, 1500);
        } else {
            showRegisterMessage(result.message || (ok ? 'Inscription refusée' : `Erreur HTTP ${status}`), 'error');
        }
    } catch (err) {
        showRegisterMessage(err.message || 'Erreur de connexion', 'error');
        console.error(err);
    } finally {
        showRegisterLoading(false);
    }
}

function showRegisterMessage(message, type) {
    const regPanel = document.getElementById('authPanelRegister');
    if (!regPanel) return;
    regPanel.querySelectorAll('.message.dynamic').forEach((el) => el.remove());

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type} dynamic`;
    msgDiv.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i> ${escapeHtml(message)}`;

    const form = document.getElementById('inscriptionForm');
    if (form) {
        form.insertBefore(msgDiv, form.firstChild);
    } else {
        regPanel.insertBefore(msgDiv, regPanel.firstChild);
    }

    setTimeout(() => msgDiv.remove(), 5000);
}

function showRegisterLoading(show) {
    const btn = document.querySelector('#inscriptionForm button[type="submit"]');
    if (btn) {
        btn.disabled = show;
        btn.innerHTML = show
            ? '<i class="fas fa-spinner fa-spin"></i> Inscription...'
            : '<i class="fas fa-user-plus"></i> S\'inscrire';
    }
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
}
