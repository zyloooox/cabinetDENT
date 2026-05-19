/**
 * Administration : services + upload d’image obligatoire à la création.
 */
const API_BASE = getApiBase();

let servicesCache = [];

document.addEventListener('DOMContentLoaded', initGestionServices);

async function initGestionServices() {
    const gate = document.getElementById('svcGate');
    const app = document.getElementById('svcApp');

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

        document.getElementById('createServiceForm').addEventListener('submit', handleCreate);
        document.getElementById('editServiceForm').addEventListener('submit', handleEdit);

        await loadServices();
    } catch (e) {
        console.error(e);
        gate.className = 'message error';
        gate.textContent = 'Erreur de chargement.';
    }
}

async function loadServices() {
    const res = await fetch(`${API_BASE}services-api.php?admin=1`, { credentials: 'same-origin' });
    const data = await res.json();
    if (!data.success || !Array.isArray(data.services)) {
        document.getElementById('svcTableWrap').innerHTML = '<p class="message error">Impossible de charger les services.</p>';
        return;
    }
    servicesCache = data.services;
    renderTable(data.services);
}

function renderTable(list) {
    const wrap = document.getElementById('svcTableWrap');
    if (!list.length) {
        wrap.innerHTML = '<p class="muted-note">Aucun service.</p>';
        return;
    }
    const rows = list
        .map((s) => {
            const img = s.image_url
                ? `<img src="${API_BASE}${String(s.image_url).replace(/^\//, '')}" alt="" width="56" height="56" style="object-fit:cover;border-radius:6px;" onerror="this.style.display='none'">`
                : '<span class="muted-note">—</span>';
            const actif = Number(s.actif) === 1 ? 'Oui' : 'Non';
            return `<tr>
                <td>${img}</td>
                <td>${escapeHtml(s.nom)}</td>
                <td>${escapeHtml(s.categorie)}</td>
                <td>${escapeHtml(String(s.prix_min))} / ${escapeHtml(String(s.prix_max))}</td>
                <td>${actif}</td>
                <td>
                    <button type="button" class="btn-small btn-secondary" data-edit-id="${s.id}"><i class="fas fa-edit"></i></button>
                    <button type="button" class="btn-small" data-del-id="${s.id}" style="margin-left:6px;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        })
        .join('');

    wrap.innerHTML = `<table class="account-table rdv-admin-table"><thead><tr>
        <th>Visuel</th><th>Nom</th><th>Catégorie</th><th>Prix min/max</th><th>Actif</th><th></th>
    </tr></thead><tbody>${rows}</tbody></table>`;

    wrap.querySelectorAll('[data-edit-id]').forEach((btn) => {
        btn.addEventListener('click', () => fillEdit(parseInt(btn.getAttribute('data-edit-id'), 10)));
    });
    wrap.querySelectorAll('[data-del-id]').forEach((btn) => {
        btn.addEventListener('click', () => deleteService(parseInt(btn.getAttribute('data-del-id'), 10)));
    });
}

function fillEdit(id) {
    const s = servicesCache.find((x) => Number(x.id) === id);
    if (!s) return;
    document.getElementById('editId').value = String(s.id);
    document.getElementById('editNom').value = s.nom || '';
    document.getElementById('editCat').value = s.categorie || '';
    document.getElementById('editDesc').value = s.description || '';
    document.getElementById('editPmin').value = s.prix_min ?? 0;
    document.getElementById('editPmax').value = s.prix_max ?? 0;
    document.getElementById('editOrdre').value = s.ordre_affichage ?? 0;
    document.getElementById('editActif').checked = Number(s.actif) === 1;
    document.getElementById('editNewImage').value = '';
    document.getElementById('editSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleCreate(e) {
    e.preventDefault();
    const fd = new FormData(document.getElementById('createServiceForm'));
    try {
        const res = await fetch(`${API_BASE}services-api.php`, {
            method: 'POST',
            body: fd,
            credentials: 'same-origin',
        });
        const json = await res.json();
        if (!json.success) {
            alert(json.message || 'Échec');
            return;
        }
        document.getElementById('createServiceForm').reset();
        await loadServices();
        alert('Service créé.');
    } catch (err) {
        console.error(err);
        alert('Erreur réseau');
    }
}

async function handleEdit(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('editId').value, 10);
    if (!id) {
        alert('Choisissez un service via « Modifier » dans le tableau.');
        return;
    }
    const payload = {
        id,
        nom: document.getElementById('editNom').value.trim(),
        categorie: document.getElementById('editCat').value.trim(),
        description: document.getElementById('editDesc').value.trim() || null,
        prix_min: parseFloat(document.getElementById('editPmin').value) || 0,
        prix_max: parseFloat(document.getElementById('editPmax').value) || 0,
        ordre_affichage: parseInt(document.getElementById('editOrdre').value, 10) || 0,
        actif: document.getElementById('editActif').checked ? 1 : 0,
    };

    try {
        const res = await fetch(`${API_BASE}services-api.php`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) {
            alert(json.message || 'Échec mise à jour');
            return;
        }

        const fileInput = document.getElementById('editNewImage');
        const file = fileInput.files && fileInput.files[0];
        if (file) {
            const fd = new FormData();
            fd.append('image', file);
            const ir = await fetch(`${API_BASE}services-api.php?action=replace-image&id=${id}`, {
                method: 'POST',
                body: fd,
                credentials: 'same-origin',
            });
            const ij = await ir.json();
            if (!ij.success) {
                alert(ij.message || 'Données enregistrées mais image non remplacée.');
            }
            fileInput.value = '';
        }

        await loadServices();
        alert('Modifications enregistrées.');
    } catch (err) {
        console.error(err);
        alert('Erreur réseau');
    }
}

async function deleteService(id) {
    if (!confirm('Supprimer ce service ? Les rendez-vous liés conserveront un service_id orphelin (NULL possible selon la base).')) return;
    try {
        const res = await fetch(`${API_BASE}services-api.php?id=${id}`, { method: 'DELETE', credentials: 'same-origin' });
        const json = await res.json();
        if (!json.success) {
            alert(json.message || 'Échec');
            return;
        }
        await loadServices();
    } catch (e) {
        alert('Erreur');
    }
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t == null ? '' : String(t);
    return d.innerHTML;
}
