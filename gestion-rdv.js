/**
 * Administration : liste et mise a jour des rendez-vous (reservations / prestations).
 */
const API_BASE = getApiBase();

const RDV_STATUTS = ['planifié', 'confirmé', 'terminé', 'annulé'];
const PAY_STATUTS = ['non-payé', 'partiellement-payé', 'payé'];

document.addEventListener('DOMContentLoaded', initGestionRdv);

async function initGestionRdv() {
    const gate = document.getElementById('rdvGate');
    const app = document.getElementById('rdvApp');

    try {
        const meRes = await fetch(`${API_BASE}auth.php?action=me`, { credentials: 'same-origin' });
        const me = await meRes.json();
        if (!meRes.ok || !me.success || !me.user || !['admin', 'medecin'].includes(me.user.role)) {
            gate.className = 'message error';
            gate.innerHTML =
                '<i class="fas fa-user-shield"></i> Accès réservé aux administrateurs. <a href="inscription-connexion.html#connexion">Connexion</a>';
            return;
        }
        gate.classList.add('hidden');
        app.classList.remove('hidden');
        await loadRdv();
    } catch (e) {
        console.error(e);
        gate.className = 'message error';
        gate.textContent = 'Erreur de chargement.';
    }
}

async function loadRdv() {
    const wrap = document.getElementById('rdvTableWrap');
    try {
        const res = await fetch(`${API_BASE}rdv-api.php`, { credentials: 'same-origin' });
        const data = await res.json();
        if (!data.success || !Array.isArray(data.appointments)) {
            wrap.innerHTML = '<p class="message error">Impossible de charger les rendez-vous.</p>';
            return;
        }
        if (!data.appointments.length) {
            wrap.innerHTML = '<p class="muted-note">Aucun rendez-vous enregistré.</p>';
            return;
        }
        wrap.innerHTML = buildTable(data.appointments);
        wireRows();
    } catch (e) {
        console.error(e);
        wrap.innerHTML = '<p class="message error">Erreur réseau.</p>';
    }
}

function buildTable(rows) {
    const body = rows
        .map((a) => {
            const id = a.id;
            const date = escapeHtml(String(a.date_consultation || ''));
            const heure = a.heure_consultation ? String(a.heure_consultation).slice(0, 5) : '—';
            const patient = escapeHtml(a.nom_complet || '—');
            const tel = escapeHtml(a.telephone || '');
            const svc = escapeHtml(a.service_nom || '—');
            const rdvOpts = RDV_STATUTS.map(
                (s) => `<option value="${s}" ${a.statut_rdv === s ? 'selected' : ''}>${s}</option>`
            ).join('');
            const payOpts = PAY_STATUTS.map(
                (s) => `<option value="${s}" ${a.statut_paiement === s ? 'selected' : ''}>${s}</option>`
            ).join('');
            return `<tr data-rdv-id="${id}">
                <td>${id}</td>
                <td data-label="Date">${date}<br><small class="muted-note">${escapeHtml(heure)}</small></td>
                <td data-label="Patient">${patient}<br><small>${tel}</small></td>
                <td data-label="Acte">${svc}</td>
                <td data-label="Statut RDV"><select class="rdv-stat" data-id="${id}">${rdvOpts}</select></td>
                <td data-label="Paiement"><select class="rdv-pay" data-id="${id}">${payOpts}</select></td>
                <td data-label="Montants">
                    <input type="number" class="rdv-mt" data-id="${id}" step="0.01" value="${escapeHtml(String(a.montant_total ?? 0))}" style="width:5rem;">
                    /
                    <input type="number" class="rdv-mp" data-id="${id}" step="0.01" value="${escapeHtml(String(a.montant_paye ?? 0))}" style="width:5rem;">
                </td>
                <td>
                    <button type="button" class="btn-small btn-secondary rdv-save" data-id="${id}"><i class="fas fa-save"></i></button>
                    <button type="button" class="btn-small rdv-del" data-id="${id}" style="margin-left:4px;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        })
        .join('');

    return `<table class="account-table rdv-admin-table"><thead><tr>
        <th>#</th><th>Date</th><th>Patient</th><th>Acte</th><th>Statut RDV</th><th>Paiement</th><th>Total / Payé</th><th></th>
    </tr></thead><tbody>${body}</tbody></table>`;
}

function wireRows() {
    const wrap = document.getElementById('rdvTableWrap');
    wrap.querySelectorAll('.rdv-save').forEach((btn) => {
        btn.addEventListener('click', () => saveRow(parseInt(btn.getAttribute('data-id'), 10)));
    });
    wrap.querySelectorAll('.rdv-del').forEach((btn) => {
        btn.addEventListener('click', () => deleteRow(parseInt(btn.getAttribute('data-id'), 10)));
    });
}

function rowEls(id) {
    const tr = document.querySelector(`tr[data-rdv-id="${id}"]`);
    if (!tr) return null;
    return {
        statut_rdv: tr.querySelector(`select.rdv-stat[data-id="${id}"]`)?.value,
        statut_paiement: tr.querySelector(`select.rdv-pay[data-id="${id}"]`)?.value,
        montant_total: parseFloat(tr.querySelector(`input.rdv-mt[data-id="${id}"]`)?.value) || 0,
        montant_paye: parseFloat(tr.querySelector(`input.rdv-mp[data-id="${id}"]`)?.value) || 0,
    };
}

async function saveRow(id) {
    const r = rowEls(id);
    if (!r) return;
    const msg = document.getElementById('rdvMessage');
    try {
        const res = await fetch(`${API_BASE}rdv-api.php`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                id,
                statut_rdv: r.statut_rdv,
                statut_paiement: r.statut_paiement,
                montant_total: r.montant_total,
                montant_paye: r.montant_paye,
            }),
        });
        const json = await res.json();
        if (!json.success) {
            showRdvMsg(json.message || 'Erreur', 'error');
            return;
        }
        showRdvMsg('Ligne enregistrée.', 'success');
        setTimeout(() => {
            msg.style.display = 'none';
        }, 2000);
    } catch (e) {
        showRdvMsg('Erreur réseau', 'error');
    }
}

async function deleteRow(id) {
    if (!confirm('Supprimer définitivement ce rendez-vous ?')) return;
    try {
        const res = await fetch(`${API_BASE}rdv-api.php?id=${id}`, { method: 'DELETE', credentials: 'same-origin' });
        const json = await res.json();
        if (!json.success) {
            showRdvMsg(json.message || 'Erreur', 'error');
            return;
        }
        await loadRdv();
    } catch (e) {
        showRdvMsg('Erreur réseau', 'error');
    }
}

function showRdvMsg(text, type) {
    const msg = document.getElementById('rdvMessage');
    msg.className = `message ${type}`;
    msg.textContent = text;
    msg.style.display = 'block';
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t == null ? '' : String(t);
    return d.innerHTML;
}
