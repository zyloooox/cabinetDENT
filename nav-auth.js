/**
 * Menu : « Inscription / Connexion » pour les invités,
 * puce avec photo (ou initiales) + lien « Mon compte » si session active.
 * Liens cabinet : « Gestion patients », « Rendez-vous » et « Comptes praticiens » pour médecins et administrateurs.
 */
(function () {
    const API_BASE = typeof getApiBase === 'function' ? getApiBase() : '';

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function initials(u) {
        const a = (u.prenom || '?')[0] || '?';
        const b = (u.nom || '?')[0] || '?';
        return (a + b).toUpperCase();
    }

    function setGestionPatientsNavVisible(show) {
        document.querySelectorAll('a.nav-link-gestion-patients').forEach((a) => {
            if (show) {
                a.removeAttribute('hidden');
            } else {
                a.setAttribute('hidden', '');
            }
        });
    }

    const NAV_PRATICIENS_ID = 'navPraticiensCabinetLink';
    const NAV_RDV_ID = 'navRdvCabinetLink';

    function removeNavPraticiensLink() {
        document.getElementById(NAV_PRATICIENS_ID)?.remove();
    }

    function removeNavRdvLink() {
        document.getElementById(NAV_RDV_ID)?.remove();
    }

    function isStaffRole(role) {
        return role === 'admin' || role === 'medecin';
    }

    /** Regroupe Mon compte et le « + » à l’extrême droite de la barre. */
    function ensureNavEndGroup() {
        const nav = document.querySelector('header nav');
        const slot = document.getElementById('navAuthSlot');
        if (!nav || !slot) return null;
        let group = document.getElementById('navEndGroup');
        if (!group) {
            group = document.createElement('span');
            group.id = 'navEndGroup';
            group.className = 'nav-end-group';
            nav.appendChild(group);
        }
        if (slot.parentElement !== group) {
            group.appendChild(slot);
        }
        return group;
    }

    /** Comptes praticiens : icône « + » à côté de Mon compte. */
    function setNavPraticiensLink(role) {
        removeNavPraticiensLink();
        if (!isStaffRole(role)) return;
        const group = ensureNavEndGroup();
        if (!group) return;
        const a = document.createElement('a');
        a.id = NAV_PRATICIENS_ID;
        a.href = 'gestion-medecins.html#nouveau-compte-medecin';
        a.className = 'nav-praticiens-pill nav-praticiens-add';
        a.title = 'Comptes praticiens — créer ou gérer';
        a.setAttribute('aria-label', 'Comptes praticiens');
        a.innerHTML = '<i class="fas fa-plus" aria-hidden="true"></i>';
        group.appendChild(a);
    }

    /** Lien rendez-vous (médecin / admin) — avant le bloc de droite. */
    function setNavRdvLink(role) {
        removeNavRdvLink();
        if (!isStaffRole(role)) return;
        const group = ensureNavEndGroup();
        if (!group?.parentNode) return;
        const a = document.createElement('a');
        a.id = NAV_RDV_ID;
        a.href = 'gestion-rdv.html';
        a.className = 'nav-rdv-pill';
        a.title = 'Gestion des rendez-vous et commandes de prestations';
        a.innerHTML = '<i class="fas fa-calendar-check"></i> Rendez-vous';
        group.insertAdjacentElement('beforebegin', a);
    }

    async function run() {
        const slot = document.getElementById('navAuthSlot');
        if (!slot || !API_BASE) return;

        ensureNavEndGroup();
        setGestionPatientsNavVisible(false);
        removeNavPraticiensLink();
        removeNavRdvLink();

        const guestHtml =
            '<a href="inscription-connexion.html" class="nav-auth-combined"><i class="fas fa-user"></i> Inscription / Connexion</a>';

        try {
            const res = await fetch(`${API_BASE}auth.php?action=me`, {
                method: 'GET',
                credentials: 'same-origin',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success || !data.user) {
                slot.innerHTML = guestHtml;
                setGestionPatientsNavVisible(false);
                removeNavPraticiensLink();
                removeNavRdvLink();
                return;
            }

            const u = data.user;
            const name = [u.prenom, u.nom].filter(Boolean).join(' ');
            const init = initials(u);
            let avatarInner;
            if (u.photo_url) {
                const src = encodeURI(`${API_BASE}${String(u.photo_url).replace(/^\//, '')}?t=${Date.now()}`);
                avatarInner = `<img src="${src}" alt="" width="32" height="32" loading="lazy">`;
            } else {
                avatarInner = `<span class="nav-user-initials">${esc(init)}</span>`;
            }

            slot.innerHTML = `
                <a href="mon-compte.html" class="nav-user-chip" title="Mon compte — ${esc(name)}">
                    <span class="nav-user-avatar">${avatarInner}</span>
                    <span class="nav-user-label">Mon compte</span>
                </a>`;

            const img = slot.querySelector('img');
            if (img) {
                img.addEventListener('error', () => {
                    img.replaceWith(Object.assign(document.createElement('span'), { className: 'nav-user-initials', textContent: init }));
                });
            }

            const staff = isStaffRole(u.role);
            setGestionPatientsNavVisible(staff);
            setNavRdvLink(u.role);
            setNavPraticiensLink(u.role);
        } catch {
            slot.innerHTML = guestHtml;
            setGestionPatientsNavVisible(false);
            removeNavPraticiensLink();
            removeNavRdvLink();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
