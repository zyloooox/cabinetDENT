/**
 * Espace patient : profil, photo, historique consultations & paiements.
 */
const API_BASE = getApiBase();

const LABEL_STATUT_RDV = {
    planifié: 'Planifié',
    confirmé: 'Confirmé',
    terminé: 'Terminé',
    annulé: 'Annulé',
};
const LABEL_STATUT_PAY = {
    'non-payé': 'Non payé',
    'partiellement-payé': 'Partiellement payé',
    payé: 'Payé',
};
const LABEL_MODE_PAY = {
    especes: 'Espèces',
    carte: 'Carte bancaire',
    cheque: 'Chèque',
    virement: 'Virement',
};

document.addEventListener('DOMContentLoaded', () => {
    initAccountPage();
});

async function initAccountPage() {
    const gate = document.getElementById('accountGate');
    const app = document.getElementById('accountApp');

    try {
        const res = await fetch(`${API_BASE}compte-api.php?action=dashboard`, { credentials: 'same-origin' });
        const data = await res.json();

        if (res.status === 401 || !data.success) {
            gate.className = 'message error';
            gate.innerHTML =
                '<i class="fas fa-lock"></i> Vous devez être connecté pour accéder à cette page. <a href="inscription-connexion.html#connexion">Se connecter</a>';
            return;
        }

        gate.classList.add('hidden');
        app.classList.remove('hidden');
        renderDashboard(data);
        wireEvents(data.user);
    } catch (e) {
        gate.className = 'message error';
        gate.innerHTML =
            '<i class="fas fa-exclamation-triangle"></i> Impossible de charger votre compte. Si vous venez de mettre à jour le site, ouvrez une fois <a href="migrate-photo.php">migrate-photo.php</a> puis réessayez.';
        console.error(e);
    }
}

function renderDashboard(data) {
    const u = data.user;
    const patient = data.patient;
    const rdvs = data.appointments || [];

    const title = document.getElementById('accountWelcomeTitle');
    title.textContent = `Bonjour, ${u.prenom || ''}`;

    const roleLine = document.getElementById('accountRoleLine');
    if (u.role === 'admin' || u.role === 'medecin') {
        const isDoc = u.role === 'medecin';
        roleLine.innerHTML =
            (isDoc
                ? '<span class="account-badge admin"><i class="fas fa-user-md"></i> Médecin — administration cabinet</span>'
                : '<span class="account-badge admin"><i class="fas fa-user-shield"></i> Compte administrateur</span>') +
            ' — <a href="gestion-medecins.html#nouveau-compte-medecin">Comptes praticiens</a> · ' +
            '<a href="gestion-rdv.html">Rendez-vous</a> · ' +
            '<a href="gestion-services.html">Services</a> · ' +
            '<a href="gestion-patient.html">Patients</a>';
    } else {
        roleLine.innerHTML = '<span class="account-badge"><i class="fas fa-tooth"></i> Espace patient</span>';
    }

    document.getElementById('pfNom').value = u.nom || '';
    document.getElementById('pfPrenom').value = u.prenom || '';
    const civ = u.civilite || 'M';
    const civSel = document.getElementById('pfCivilite');
    if (civSel) civSel.value = ['M', 'Mme', 'Mlle'].includes(civ) ? civ : 'M';

    const birth = u.date_naissance ? String(u.date_naissance).slice(0, 10) : '';
    document.getElementById('pfNaissance').value = birth;

    document.getElementById('pfEmail').value = u.email || '';
    document.getElementById('pfTel').value = u.telephone || '';
    document.getElementById('pfAdresse').value = u.adresse || '';

    const nw = document.getElementById('pfNewsletter');
    if (nw) nw.checked = Number(u.newsletter) === 1;

    setAvatar(u);

    const noDossier = document.getElementById('noDossier');
    const dossierContent = document.getElementById('dossierContent');
    if (!patient) {
        noDossier.classList.remove('hidden');
        dossierContent.classList.add('hidden');
    } else {
        noDossier.classList.add('hidden');
        dossierContent.classList.remove('hidden');
        document.getElementById('dNomComplet').textContent = patient.nom_complet || '—';
        document.getElementById('dMedecin').textContent =
            patient.medecin_traitant === 'chakib' ? 'Dr. Mohamed Chakib Bougatef' : 'Dr. Ilhem Trabelsi Bougatef';
        document.getElementById('dNotes').textContent = patient.notes_medicales || 'Aucune note enregistrée.';
    }

    const noHistory = document.getElementById('noHistory');
    const historyWrap = document.getElementById('historyWrap');
    if (!rdvs.length) {
        noHistory.classList.remove('hidden');
        historyWrap.classList.add('hidden');
    } else {
        noHistory.classList.add('hidden');
        historyWrap.classList.remove('hidden');
        historyWrap.innerHTML = buildConsultationsTable(rdvs);
    }

    const noPayments = document.getElementById('noPayments');
    const paymentsWrap = document.getElementById('paymentsWrap');
    const flatPayments = [];
    rdvs.forEach((a) => {
        (a.paiements || []).forEach((p) => {
            flatPayments.push({ rdv: a, pay: p });
        });
    });
    if (!flatPayments.length) {
        noPayments.classList.remove('hidden');
        paymentsWrap.classList.add('hidden');
    } else {
        noPayments.classList.add('hidden');
        paymentsWrap.classList.remove('hidden');
        paymentsWrap.innerHTML = buildPaymentsTable(flatPayments);
    }
}

function setAvatar(u) {
    const img = document.getElementById('accountAvatarImg');
    const fb = document.getElementById('accountAvatarFallback');
    const initials = ((u.prenom || '?')[0] + (u.nom || '?')[0]).toUpperCase();
    fb.textContent = initials;

    if (u.photo_url) {
        const url = `${API_BASE}${String(u.photo_url).replace(/^\//, '')}?t=${Date.now()}`;
        img.onload = () => {
            fb.classList.add('hidden');
            img.classList.remove('hidden');
        };
        img.onerror = () => {
            img.classList.add('hidden');
            fb.classList.remove('hidden');
        };
        img.src = url;
        if (img.complete && img.naturalWidth > 0) {
            fb.classList.add('hidden');
            img.classList.remove('hidden');
        }
    } else {
        img.removeAttribute('src');
        img.classList.add('hidden');
        fb.classList.remove('hidden');
    }
}

function buildConsultationsTable(rdvs) {
    const rows = rdvs
        .map(
            (a) => `
        <tr>
            <td data-label="Date">${escapeHtml(formatDate(a.date_consultation))}</td>
            <td data-label="Heure">${escapeHtml(formatHeure(a.heure_consultation))}</td>
            <td data-label="Soin / service">${escapeHtml(a.service_nom || '—')} ${a.service_categorie ? `<small>(${escapeHtml(a.service_categorie)})</small>` : ''}</td>
            <td data-label="Statut RDV">${escapeHtml(LABEL_STATUT_RDV[a.statut_rdv] || a.statut_rdv || '—')}</td>
            <td data-label="Total">${formatMoney(a.montant_total)}</td>
            <td data-label="Déjà payé">${formatMoney(a.montant_paye)}</td>
            <td data-label="Paiement">${escapeHtml(LABEL_STATUT_PAY[a.statut_paiement] || a.statut_paiement || '—')}</td>
            <td data-label="Compte-rendu">${escapeHtml(a.notes || '—')}</td>
        </tr>`
        )
        .join('');

    return `
        <table class="account-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Heure</th>
                    <th>Soin / service</th>
                    <th>Statut RDV</th>
                    <th>Total</th>
                    <th>Déjà payé</th>
                    <th>Statut paiement</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function buildPaymentsTable(items) {
    const rows = items
        .map(({ rdv, pay }) => {
            const mode = LABEL_MODE_PAY[pay.mode_paiement] || pay.mode_paiement || '—';
            return `
        <tr>
            <td data-label="Date paiement">${escapeHtml(formatDateTime(pay.created_at))}</td>
            <td data-label="Montant">${formatMoney(pay.montant)}</td>
            <td data-label="Mode">${escapeHtml(mode)}</td>
            <td data-label="Réf.">${escapeHtml(pay.reference || '—')}</td>
            <td data-label="Consultation">${escapeHtml(formatDate(rdv.date_consultation))} — ${escapeHtml(rdv.service_nom || 'Acte')}</td>
            <td data-label="Note">${escapeHtml(pay.notes || '—')}</td>
        </tr>`;
        })
        .join('');

    return `
        <table class="account-table">
            <thead>
                <tr>
                    <th>Date paiement</th>
                    <th>Montant</th>
                    <th>Mode</th>
                    <th>Référence</th>
                    <th>Consultation liée</th>
                    <th>Note</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function wireEvents(userSnapshot) {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await fetch(`${API_BASE}auth.php?action=logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: '{}',
            });
        } catch (_) {
            /* noop */
        }
        window.location.href = 'inscription-connexion.html#connexion';
    });

    document.getElementById('photoForm').addEventListener('submit', (e) => e.preventDefault());

    document.getElementById('photoBtn')?.addEventListener('click', () => {
        document.getElementById('photoInput')?.click();
    });

    document.getElementById('photoInput').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;

        const fd = new FormData();
        fd.append('photo', file);
        try {
            const res = await fetch(`${API_BASE}compte-api.php?action=upload-photo`, {
                method: 'POST',
                body: fd,
                credentials: 'same-origin',
            });
            const json = await res.json();
            if (!json.success) {
                alert(json.message || 'Envoi de la photo refusé');
                return;
            }
            userSnapshot.photo_url = json.photo_url;
            setAvatar(userSnapshot);
        } catch (err) {
            alert('Erreur lors de l’envoi de la photo');
            console.error(err);
        }
    });

    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            nom: document.getElementById('pfNom').value.trim(),
            prenom: document.getElementById('pfPrenom').value.trim(),
            civilite: document.getElementById('pfCivilite').value,
            date_naissance: document.getElementById('pfNaissance').value,
            email: document.getElementById('pfEmail').value.trim(),
            telephone: document.getElementById('pfTel').value.trim(),
            adresse: document.getElementById('pfAdresse').value.trim() || null,
            newsletter: document.getElementById('pfNewsletter').checked ? 1 : 0,
        };
        try {
            const res = await fetch(`${API_BASE}compte-api.php?action=profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!json.success) {
                alert(json.message || 'Mise à jour refusée');
                return;
            }
            if (json.user) {
                Object.assign(userSnapshot, json.user);
                document.getElementById('accountWelcomeTitle').textContent = `Bonjour, ${json.user.prenom || ''}`;
                setAvatar(userSnapshot);
                const dContent = document.getElementById('dossierContent');
                if (dContent && !dContent.classList.contains('hidden')) {
                    document.getElementById('dNomComplet').textContent = `${payload.prenom} ${payload.nom}`;
                }
            }
            alert('Profil enregistré.');
        } catch (err) {
            alert('Erreur réseau');
            console.error(err);
        }
    });
}

function formatDate(d) {
    if (!d) return '—';
    const dt = new Date(d + 'T12:00:00');
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatHeure(t) {
    if (!t) return '—';
    const s = String(t);
    return s.length >= 5 ? s.slice(0, 5) : s;
}

function formatDateTime(iso) {
    if (!iso) return '—';
    const dt = new Date(iso.replace(' ', 'T'));
    if (Number.isNaN(dt.getTime())) return iso;
    return dt.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatMoney(v) {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} DT`;
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}
