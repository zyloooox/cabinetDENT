/**
 * Liste des prestations : tarifs + clic → reserver-rdv.html?service=ID
 */
(function () {
    const API_BASE = typeof getApiBase === 'function' ? getApiBase() : '';

    const CAT_META = {
        'Soins Généraux': { icon: 'fa-tooth', order: 1 },
        'Esthétique': { icon: 'fa-star', order: 2 },
        'Implantologie': { icon: 'fa-bone', order: 3 },
        'Radiologie': { icon: 'fa-x-ray', order: 4 },
    };

    const SERVICE_ICONS = {
        'Consultation': 'fa-stethoscope',
        'Détartrage': 'fa-shower',
        'Soin carie': 'fa-tooth',
        'Dévitalisation': 'fa-tooth',
        'Extraction': 'fa-teeth',
        'Blanchiment': 'fa-snowflake',
        'Facette': 'fa-gem',
        'Couronne': 'fa-crown',
        'Bridge': 'fa-teeth-open',
        'Implant': 'fa-screwdriver',
        'Couronne sur implant': 'fa-teeth',
        'Greffe osseuse': 'fa-teeth',
        'Radio panoramique': 'fa-x-ray',
        'Radio rétro-alvéolaire': 'fa-x-ray',
        'Scanner 3D': 'fa-x-ray',
    };

    const FALLBACK_SERVICES = [
        { id: 1, nom: 'Consultation', categorie: 'Soins Généraux', description: 'Examen complet et diagnostic', prix_min: 70, prix_max: 70, ordre_affichage: 1 },
        { id: 2, nom: 'Détartrage', categorie: 'Soins Généraux', description: 'Nettoyage et polissage des dents', prix_min: 100, prix_max: 100, ordre_affichage: 2 },
        { id: 3, nom: 'Soin carie', categorie: 'Soins Généraux', description: 'Obturation composite', prix_min: 80, prix_max: 160, ordre_affichage: 3 },
        { id: 4, nom: 'Dévitalisation', categorie: 'Soins Généraux', description: 'Traitement de canal', prix_min: 250, prix_max: 400, ordre_affichage: 4 },
        { id: 5, nom: 'Extraction', categorie: 'Soins Généraux', description: 'Extraction dentaire simple', prix_min: 100, prix_max: 100, ordre_affichage: 5 },
        { id: 6, nom: 'Blanchiment', categorie: 'Esthétique', description: 'Blanchiment au cabinet', prix_min: 500, prix_max: 500, ordre_affichage: 6 },
        { id: 7, nom: 'Facette', categorie: 'Esthétique', description: 'Facettes en céramique', prix_min: 500, prix_max: 700, ordre_affichage: 7 },
        { id: 8, nom: 'Couronne', categorie: 'Esthétique', description: 'Couronne céramique', prix_min: 450, prix_max: 450, ordre_affichage: 8 },
        { id: 9, nom: 'Bridge', categorie: 'Esthétique', description: 'Bridge 3 unités', prix_min: 1200, prix_max: 1200, ordre_affichage: 9 },
        { id: 10, nom: 'Implant', categorie: 'Implantologie', description: "Pose d'implant dentaire", prix_min: 1000, prix_max: 1000, ordre_affichage: 10 },
        { id: 11, nom: 'Couronne sur implant', categorie: 'Implantologie', description: 'Couronne sur implant', prix_min: 650, prix_max: 650, ordre_affichage: 11 },
        { id: 12, nom: 'Greffe osseuse', categorie: 'Implantologie', description: 'Greffe osseuse', prix_min: 500, prix_max: 850, ordre_affichage: 12 },
        { id: 13, nom: 'Radio panoramique', categorie: 'Radiologie', description: 'Radio panoramique dentaire', prix_min: 50, prix_max: 50, ordre_affichage: 13 },
        { id: 14, nom: 'Radio rétro-alvéolaire', categorie: 'Radiologie', description: 'Radio rétro-alvéolaire', prix_min: 30, prix_max: 30, ordre_affichage: 14 },
        { id: 15, nom: 'Scanner 3D', categorie: 'Radiologie', description: 'Scanner dentaire 3D', prix_min: 200, prix_max: 200, ordre_affichage: 15 },
    ];

    function money(min, max) {
        const x = Number(min);
        const y = Number(max);
        if (Number.isNaN(x)) return '—';
        if (!Number.isNaN(y) && y !== x) return `${x} – ${y} DT`;
        return `${x} DT`;
    }

    function escapeHtml(t) {
        const el = document.createElement('div');
        el.textContent = t == null ? '' : String(t);
        return el.innerHTML;
    }

    function groupServices(services) {
        const groups = {};
        services.forEach((s) => {
            const cat = s.categorie || 'Autres';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
        });
        Object.keys(groups).forEach((cat) => {
            groups[cat].sort((a, b) => (a.ordre_affichage || 0) - (b.ordre_affichage || 0));
        });
        return groups;
    }

    function renderItem(s) {
        const icon = SERVICE_ICONS[s.nom] || 'fa-teeth';
        const book = `reserver-rdv.html?service=${encodeURIComponent(String(s.id))}`;
        const desc = s.description
            ? `<span class="service-list-hint">${escapeHtml(s.description)}</span>`
            : '';
        return `<li>
            <a href="${book}" class="service-list-link" title="Réserver : ${escapeHtml(s.nom)}">
                <span class="service-list-label">
                    <span class="service-list-title"><i class="fas ${icon}"></i> ${escapeHtml(s.nom)}</span>
                    ${desc}
                </span>
                <span class="service-price">${money(s.prix_min, s.prix_max)}</span>
            </a>
        </li>`;
    }

    function renderCategory(cat, items) {
        const meta = CAT_META[cat] || { icon: 'fa-list', order: 99 };
        return `<section class="services-category-block">
            <h2><i class="fas ${meta.icon}"></i> ${escapeHtml(cat)}</h2>
            <ul class="service-list">${items.map(renderItem).join('')}</ul>
        </section>`;
    }

    function renderCatalog(services, usedFallback) {
        const root = document.getElementById('servicesListRoot');
        if (!root) return;

        const groups = groupServices(services);
        const cats = Object.keys(groups).sort((a, b) => {
            const oa = (CAT_META[a] && CAT_META[a].order) || 99;
            const ob = (CAT_META[b] && CAT_META[b].order) || 99;
            return oa - ob || a.localeCompare(b, 'fr');
        });

        const fallbackNote = usedFallback
            ? '<p class="muted-note" style="margin-bottom:0.75rem;"><i class="fas fa-info-circle"></i> Tarifs indicatifs affichés localement.</p>'
            : '';

        root.innerHTML =
            fallbackNote +
            '<p class="muted-note services-list-intro"><i class="fas fa-hand-pointer"></i> Cliquez sur une prestation pour la réserver — l’acte sera pré-sélectionné.</p>' +
            cats.map((cat) => renderCategory(cat, groups[cat])).join('');
    }

    async function fetchServices() {
        if (!API_BASE) {
            return { services: FALLBACK_SERVICES, usedFallback: true };
        }
        try {
            const res = await fetch(`${API_BASE}services-api.php`, { credentials: 'same-origin' });
            const data = await res.json();
            if (data.success && Array.isArray(data.services) && data.services.length > 0) {
                return { services: data.services, usedFallback: false };
            }
        } catch (e) {
            console.error(e);
        }
        return { services: FALLBACK_SERVICES, usedFallback: true };
    }

    async function run() {
        const root = document.getElementById('servicesListRoot');
        if (!root) return;

        root.innerHTML = '<p class="muted-note"><i class="fas fa-spinner fa-spin"></i> Chargement des prestations…</p>';

        const { services, usedFallback } = await fetchServices();
        renderCatalog(services, usedFallback);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
