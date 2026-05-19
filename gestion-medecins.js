/**
 * Admin : créer les comptes médecins (2 postes), promotion / remplacement.
 */
const API_BASE = getApiBase();

let lastMedecinCount = 0;

document.addEventListener('DOMContentLoaded', initPage);

async function initPage() {
    const gate = document.getElementById('gate');
    const app = document.getElementById('app');

    try {
        const meRes = await fetch(`${API_BASE}auth.php?action=me`, { credentials: 'same-origin' });
        const me = await meRes.json();
        if (!meRes.ok || !me.success || !me.user || !['admin', 'medecin'].includes(me.user.role)) {
            gate.className = 'message error';
            gate.innerHTML =
                '<i class="fas fa-user-shield"></i> Cette page est réservée aux comptes <strong>praticien</strong> ou <strong>administrateur</strong> du cabinet. ' +
                '<a href="inscription-connexion.html#connexion">Se connecter</a> avec un compte autorisé.';
            return;
        }
        gate.classList.add('hidden');
        app.classList.remove('hidden');

        document.getElementById('promoteForm').addEventListener('submit', handlePromote);
        document.getElementById('createMedecinForm').addEventListener('submit', handleCreateMedecin);
        await reloadData();
    } catch (e) {
        console.error(e);
        gate.className = 'message error';
        gate.textContent = 'Erreur de chargement.';
    }
}

function renderSlotsHint(med) {
    const slotsHint = document.getElementById('slotsHint');
    if (!slotsHint) return;
    let body;
    let tone = 'info';
    if (med.length === 0) {
        body =
            'Aucun praticien pour l’instant : complétez le formulaire ci-dessous pour créer le <strong>premier</strong> compte, puis le second.';
    } else if (med.length === 1) {
        body =
            'Un praticien est enregistré : vous pouvez encore ajouter le <strong>deuxième</strong> compte sans remplacement.';
    } else {
        tone = 'warn';
        body =
            'Les <strong>deux postes</strong> sont occupés. Pour un nouveau compte, choisissez obligatoirement quel praticien est <strong>remplacé</strong> (son accès redeviendra celui d’un patient).';
    }
    slotsHint.className = `cabinet-alert cabinet-alert--${tone}`;
    slotsHint.innerHTML = `<i class="fas fa-info-circle cabinet-alert__icon" aria-hidden="true"></i><div class="cabinet-alert__body">${body}</div>`;
}

function initialsMed(m) {
    const a = (m.prenom || '?')[0] || '?';
    const b = (m.nom || '?')[0] || '?';
    return (a + b).toUpperCase();
}

async function reloadData() {
    const res = await fetch(`${API_BASE}admin-medecins-api.php`, { credentials: 'same-origin' });
    const data = await res.json();
    const medList = document.getElementById('medList');
    const slotsHint = document.getElementById('slotsHint');
    const countEl = document.getElementById('cabinetMedCount');

    if (!data.success) {
        if (medList) medList.innerHTML = `<p class="cabinet-empty">${escapeHtml(data.message || 'Erreur de chargement.')}</p>`;
        if (slotsHint) {
            slotsHint.className = 'cabinet-alert cabinet-alert--error';
            slotsHint.innerHTML = `<i class="fas fa-exclamation-triangle cabinet-alert__icon" aria-hidden="true"></i><div class="cabinet-alert__body">${escapeHtml(
                data.message || 'Erreur'
            )}</div>`;
        }
        if (countEl) countEl.textContent = '—';
        return;
    }

    const med = data.medecins || [];
    lastMedecinCount = med.length;

    if (countEl) countEl.textContent = String(med.length);
    renderSlotsHint(med);

    if (medList) {
        medList.innerHTML =
            med.length === 0
                ? `<div class="cabinet-empty cabinet-empty--soft" role="status">
                    <span class="cabinet-empty__icon" aria-hidden="true"><i class="fas fa-user-md"></i></span>
                    <p><strong>Aucun praticien enregistré</strong></p>
                    <p class="muted-note">Utilisez la section <a href="#nouveau-compte-medecin">Nouveau compte</a> ci-dessus pour créer le premier accès.</p>
                   </div>`
                : `<div class="cabinet-doc-grid">${med
                      .map(
                          (m) => `<article class="cabinet-doc-card">
                            <div class="cabinet-doc-card__avatar" aria-hidden="true">${escapeHtml(initialsMed(m))}</div>
                            <div class="cabinet-doc-card__body">
                                <h3 class="cabinet-doc-card__name">Dr ${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}</h3>
                                <p class="cabinet-doc-card__email">${escapeHtml(m.email)}</p>
                                <span class="cabinet-doc-card__id">Réf. ${escapeHtml(String(m.id))}</span>
                            </div>
                        </article>`
                      )
                      .join('')}</div>`;
    }

    const selP = document.getElementById('promoteUserId');
    const selR = document.getElementById('replaceMedId');
    selP.innerHTML = '<option value="">— Choisir un patient —</option>';
    (data.patients || []).forEach((p) => {
        const o = document.createElement('option');
        o.value = String(p.id);
        o.textContent = `${p.prenom} ${p.nom} — ${p.email}`;
        selP.appendChild(o);
    });

    selR.innerHTML = '<option value="">— Choisir si les 2 postes sont pris —</option>';
    med.forEach((m) => {
        const o = document.createElement('option');
        o.value = String(m.id);
        o.textContent = `Remplacer : Dr ${m.prenom} ${m.nom} (${m.email})`;
        selR.appendChild(o);
    });

    const createRep = document.getElementById('createReplaceMedId');
    const createWrap = document.getElementById('createReplaceWrap');
    if (createRep && createWrap) {
        createRep.innerHTML = '<option value="">— Choisir si 2 médecins —</option>';
        med.forEach((m) => {
            const o = document.createElement('option');
            o.value = String(m.id);
            o.textContent = `Remplacer : Dr ${m.prenom} ${m.nom} (${m.email})`;
            createRep.appendChild(o);
        });
        createWrap.style.display = med.length >= 2 ? 'block' : 'none';
        createRep.required = med.length >= 2;
    }
}

async function handleCreateMedecin(e) {
    e.preventDefault();
    const msg = document.getElementById('createMsg');
    const pw = document.getElementById('createPassword').value;
    const pw2 = document.getElementById('createPassword2').value;
    if (pw !== pw2) {
        msg.className = 'message error';
        msg.textContent = 'Les mots de passe ne correspondent pas.';
        msg.style.display = 'block';
        return;
    }
    if (pw.length < 8) {
        msg.className = 'message error';
        msg.textContent = 'Mot de passe trop court (8 caractères minimum).';
        msg.style.display = 'block';
        return;
    }

    const replaceRaw = document.getElementById('createReplaceMedId')?.value || '';
    const replaceId = replaceRaw ? parseInt(replaceRaw, 10) : 0;
    if (lastMedecinCount >= 2 && replaceId <= 0) {
        msg.className = 'message error';
        msg.textContent = 'Les 2 postes sont pris : sélectionnez quel médecin est remplacé.';
        msg.style.display = 'block';
        return;
    }

    const body = {
        action: 'create_medecin',
        prenom: document.getElementById('createPrenom').value.trim(),
        nom: document.getElementById('createNom').value.trim(),
        civilite: document.getElementById('createCivilite').value,
        date_naissance: document.getElementById('createNaissance').value,
        email: document.getElementById('createEmail').value.trim(),
        telephone: document.getElementById('createTel').value.trim(),
        password: pw,
    };
    if (replaceId > 0) {
        body.replace_medecin_id = replaceId;
    }

    try {
        const res = await fetch(`${API_BASE}admin-medecins-api.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body),
        });
        const json = await res.json();
        msg.style.display = 'block';
        if (!json.success) {
            msg.className = 'message error';
            msg.textContent = json.message || 'Refusé';
            return;
        }
        msg.className = 'message success';
        msg.textContent = json.message || 'Compte créé.';
        document.getElementById('createMedecinForm').reset();
        await reloadData();
    } catch (err) {
        msg.className = 'message error';
        msg.textContent = 'Erreur réseau';
        msg.style.display = 'block';
        console.error(err);
    }
}

async function handlePromote(e) {
    e.preventDefault();
    const msg = document.getElementById('promoteMsg');
    const promoteId = parseInt(document.getElementById('promoteUserId').value, 10);
    const replaceRaw = document.getElementById('replaceMedId').value;
    const replaceId = replaceRaw ? parseInt(replaceRaw, 10) : 0;

    if (!promoteId) {
        msg.className = 'message error';
        msg.textContent = 'Choisissez un compte patient.';
        msg.style.display = 'block';
        return;
    }

    const body = { promote_user_id: promoteId };
    if (replaceId > 0) {
        body.replace_medecin_id = replaceId;
    }

    try {
        const res = await fetch(`${API_BASE}admin-medecins-api.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body),
        });
        const json = await res.json();
        msg.style.display = 'block';
        if (!json.success) {
            msg.className = 'message error';
            msg.textContent = json.message || 'Refusé';
            return;
        }
        msg.className = 'message success';
        msg.textContent = json.message || 'OK';
        await reloadData();
    } catch (err) {
        msg.className = 'message error';
        msg.textContent = 'Erreur réseau';
        msg.style.display = 'block';
        console.error(err);
    }
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t == null ? '' : String(t);
    return d.innerHTML;
}
