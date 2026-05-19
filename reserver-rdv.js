/**
 * Réservation d’un acte / service (utilisateur connecté).
 */
const API_BASE = getApiBase();

document.addEventListener('DOMContentLoaded', initReservePage);

async function initReservePage() {
    const gate = document.getElementById('reserveGate');
    const app = document.getElementById('reserveApp');
    const form = document.getElementById('reserveForm');
    const sel = document.getElementById('reserveService');
    const msg = document.getElementById('reserveMessage');

    try {
        const meRes = await fetch(`${API_BASE}auth.php?action=me`, { credentials: 'same-origin' });
        const me = await meRes.json();
        if (!meRes.ok || !me.success || !me.user) {
            gate.className = 'message error';
            gate.innerHTML =
                '<i class="fas fa-lock"></i> Connectez-vous pour réserver. <a href="inscription-connexion.html#connexion">Connexion</a> · <a href="inscription-connexion.html#inscription">Créer un compte</a>';
            return;
        }
        gate.classList.add('hidden');
        app.classList.remove('hidden');

        const svcRes = await fetch(`${API_BASE}services-api.php`, { credentials: 'same-origin' });
        const svcData = await svcRes.json();
        if (!svcData.success || !Array.isArray(svcData.services)) {
            showMsg(msg, 'Impossible de charger les services.', 'error');
            return;
        }
        sel.innerHTML = '<option value="">— Choisir un acte —</option>';
        svcData.services.forEach((s) => {
            const o = document.createElement('option');
            o.value = String(s.id);
            o.textContent = `${s.nom} (${s.categorie})`;
            sel.appendChild(o);
        });

        const params = new URLSearchParams(window.location.search);
        const urlServicePre = params.get('service');
        if (urlServicePre && Array.from(sel.options).some((o) => o.value === urlServicePre)) {
            sel.value = urlServicePre;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const service_id = parseInt(sel.value, 10);
            const date_consultation = document.getElementById('reserveDate').value;
            const heure_consultation = document.getElementById('reserveTime').value;
            const notes = document.getElementById('reserveNotes').value.trim();

            if (!service_id || !date_consultation) {
                showMsg(msg, 'Choisissez un acte et une date.', 'error');
                return;
            }

            try {
                const res = await fetch(`${API_BASE}rdv-api.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        service_id,
                        date_consultation,
                        heure_consultation: heure_consultation || null,
                        notes: notes || null,
                    }),
                });
                const json = await res.json();
                if (!json.success) {
                    showMsg(msg, json.message || 'Demande refusée', 'error');
                    return;
                }
                showMsg(msg, 'Votre demande a bien été enregistrée. Retrouvez-la dans Mon compte.', 'success');
                form.reset();
                document.getElementById('reserveDate').value = new Date().toISOString().slice(0, 10);
                document.getElementById('reserveTime').value = '09:00';
                if (urlServicePre && Array.from(sel.options).some((o) => o.value === urlServicePre)) {
                    sel.value = urlServicePre;
                }
            } catch (err) {
                console.error(err);
                showMsg(msg, 'Erreur réseau', 'error');
            }
        });
    } catch (e) {
        console.error(e);
        gate.className = 'message error';
        gate.textContent = 'Erreur de chargement.';
    }
}

function showMsg(el, text, type) {
    if (!el) return;
    el.className = `message ${type}`;
    el.textContent = text;
    el.style.display = 'block';
}
