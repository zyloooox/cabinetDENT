/**
 * Gestion des patients - Module JavaScript complet
 * Utilisation de l'API REST avec fetch et Promises
 */

const API_BASE = getApiBase();

// État global
let patients = [];
let currentEditId = null;

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
    const gate = document.getElementById('gpGate');
    const app = document.getElementById('gpApp');

    try {
        const res = await fetch(`${API_BASE}auth.php?action=me`, { credentials: 'same-origin' });
        const data = await res.json();
        if (!res.ok || !data.success || !data.user || !['medecin', 'admin'].includes(data.user.role)) {
            if (gate) {
                gate.className = 'message error';
                gate.innerHTML =
                    '<i class="fas fa-user-md"></i> Cette interface est réservée aux <strong>médecins</strong> et <strong>administrateurs</strong> du cabinet. ' +
                    'Les patients utilisent <a href="mon-compte.html">Mon compte</a>. Connectez-vous avec un compte <strong>médecin</strong> ou <strong>admin</strong>. ' +
                    '<a href="inscription-connexion.html#connexion">Connexion</a>';
            }
            return;
        }
        if (gate) gate.classList.add('hidden');
        if (app) app.classList.remove('hidden');

        initEventListeners();
        await loadPatients();
        updateStats();
        loadDoctorsSelect();
        await loadPatientServices();
        initAdminQuickLinks();
    } catch (e) {
        console.error(e);
        if (gate) {
            gate.className = 'message error';
            gate.textContent = 'Impossible de vérifier votre session.';
        }
    }
});

/**
 * Initialise tous les écouteurs d'événements
 */
function initEventListeners() {
    // Formulaire d'ajout
    const addForm = document.getElementById('addPatientForm');
    if (addForm) {
        addForm.addEventListener('submit', handleAddPatient);
    }
    
    // Formulaire de recherche
    const searchForm = document.getElementById('searchPatientForm');
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearch);
    }
    
    // Bouton afficher tous
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', () => loadPatients());
    }
    
    // Mise à jour automatique du statut de paiement
    const totalInput = document.getElementById('total-amount');
    const paidInput = document.getElementById('amount-paid');
    if (totalInput && paidInput) {
        totalInput.addEventListener('input', updatePaymentStatus);
        paidInput.addEventListener('input', updatePaymentStatus);
    }
    
    // Export CSV
    const exportBtn = document.getElementById('exportPatientsBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
    
    // Impression
    const printBtn = document.getElementById('printPatientsBtn');
    if (printBtn) {
        printBtn.addEventListener('click', printList);
    }
}

/**
 * Charge les médecins dans le select
 */
function loadDoctorsSelect() {
    const select = document.getElementById('patientMedecin');
    if (!select) return;
}

async function loadPatientServices() {
    const sel = document.getElementById('patientServiceId');
    if (!sel) return;
    try {
        const res = await fetch(`${API_BASE}services-api.php`, { credentials: 'same-origin' });
        const data = await res.json();
        if (!data.success || !Array.isArray(data.services)) return;
        sel.innerHTML = '<option value="">— Aucun —</option>';
        data.services.forEach((s) => {
            const o = document.createElement('option');
            o.value = String(s.id);
            o.textContent = `${s.nom} (${s.categorie})`;
            sel.appendChild(o);
        });
    } catch (e) {
        console.error(e);
    }
}

async function initAdminQuickLinks() {
    const bar = document.getElementById('adminQuickLinks');
    if (!bar) return;
    try {
        const res = await fetch(`${API_BASE}auth.php?action=me`, { credentials: 'same-origin' });
        const data = await res.json();
        if (res.ok && data.success && data.user && ['admin', 'medecin'].includes(data.user.role)) {
            bar.classList.remove('hidden');
        }
    } catch (_) {
        /* noop */
    }
}

/**
 * Met à jour le statut de paiement automatiquement
 */
function updatePaymentStatus() {
    const total = parseFloat(document.getElementById('total-amount')?.value) || 0;
    const paid = parseFloat(document.getElementById('amount-paid')?.value) || 0;
    const statusSelect = document.getElementById('payment-status');
    
    if (!statusSelect) return;
    
    if (paid === 0) {
        statusSelect.value = 'non-payé';
    } else if (paid >= total && total > 0) {
        statusSelect.value = 'payé';
    } else if (paid > 0 && paid < total) {
        statusSelect.value = 'partiellement-payé';
    }
}

/**
 * Ajoute un patient
 */
async function handleAddPatient(e) {
    e.preventDefault();
    
    const formData = {
        nom_complet: document.getElementById('patientNom').value,
        genre: document.getElementById('patientGenre').value,
        date_naissance: document.getElementById('patientNaissance').value,
        telephone: document.getElementById('patientTel').value,
        email: document.getElementById('patientEmail').value || null,
        adresse: document.getElementById('patientAdresse')?.value || null,
        medecin_traitant: document.getElementById('patientMedecin').value,
        notes_medicales: document.getElementById('patientNotes').value || null,
        date_consultation: document.getElementById('consultationDate').value,
        heure_consultation: document.getElementById('consultationTime').value || null,
        montant_total: parseFloat(document.getElementById('total-amount')?.value) || 0,
        montant_paye: parseFloat(document.getElementById('amount-paid')?.value) || 0,
        statut_paiement: document.getElementById('payment-status').value,
        service_id: (() => {
            const v = document.getElementById('patientServiceId')?.value;
            const n = parseInt(v, 10);
            return Number.isFinite(n) && n > 0 ? n : null;
        })(),
    };
    
    // Validation
    if (!formData.nom_complet || !formData.date_naissance || !formData.telephone || !formData.date_consultation) {
        showMessage('Veuillez remplir tous les champs obligatoires (*)', 'error');
        return;
    }
    
    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}patients.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(formData),
        });

        const ct = response.headers.get('content-type') || '';
        let result = {};
        if (ct.includes('application/json')) {
            result = await response.json();
        } else {
            await response.text();
            showMessage(`Réponse invalide du serveur (HTTP ${response.status}). Vérifiez que vous êtes bien connecté.`, 'error');
            return;
        }

        if (!response.ok || !result.success) {
            const msg = result.message || `Erreur HTTP ${response.status}`;
            showMessage(msg, 'error');
            return;
        }

        showMessage('Patient ajouté avec succès !', 'success');
        document.getElementById('addPatientForm').reset();
        await loadPatients();
        updateStats();
        setTimeout(() => {
            window.location.reload();
        }, 800);
    } catch (error) {
        console.error('Erreur:', error);
        showMessage('Erreur réseau ou serveur lors de l\'enregistrement.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Charge tous les patients
 */
async function loadPatients() {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}patients.php`, { credentials: 'same-origin' });
        const result = await response.json();
        
        if (result.success) {
            patients = result.patients;
            displayPatients(patients);
        } else {
            showMessage('Erreur chargement patients', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showMessage('Erreur de connexion', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Affiche la liste des patients
 */
function displayPatients(patientsList) {
    const container = document.getElementById('patientsList');
    
    if (!patientsList || patientsList.length === 0) {
        container.innerHTML = `
            <p style="text-align: center; color: #999; padding: 40px;">
                <i class="fas fa-users-slash fa-2x"></i><br>
                Aucun patient trouvé.
            </p>
        `;
        return;
    }
    
    // Création du tableau responsive
    const html = `
        <div class="patients-table" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: linear-gradient(120deg, #005f5c, #27c4c9); color: white;">
                    <tr>
                        <th style="padding: 12px;">Nom</th>
                        <th style="padding: 12px;">Téléphone</th>
                        <th style="padding: 12px;">Email</th>
                        <th style="padding: 12px;">Médecin</th>
                        <th style="padding: 12px;">Prochain RDV</th>
                        <th style="padding: 12px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${patientsList.map(patient => `
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 12px;">
                                <strong>${escapeHtml(patient.nom_complet)}</strong><br>
                                <small style="color: #666;">${patient.genre === 'M' ? '♂' : '♀'} ${formatDate(patient.date_naissance)}</small>
                            </td>
                            <td style="padding: 12px;">${escapeHtml(patient.telephone)}</td>
                            <td style="padding: 12px;">${escapeHtml(patient.email || '-')}</td>
                            <td style="padding: 12px;">
                                <span style="background: #e0f2f2; padding: 4px 8px; border-radius: 12px; font-size: 0.85rem;">
                                    ${patient.medecin_traitant === 'ilhem' ? 'Dr. Ilhem' : 'Dr. Chakib'}
                                </span>
                            </td>
                            <td style="padding: 12px;">
                                ${patient.prochain_rdv ? `
                                    <span style="color: #005f5c; font-weight: 600;">
                                        <i class="fas fa-calendar"></i> ${formatDate(patient.prochain_rdv)}
                                    </span>
                                ` : '<span style="color: #999;">Aucun</span>'}
                            </td>
                            <td style="padding: 12px;">
                                <button onclick="viewPatient(${patient.id})" class="btn-icon" title="Voir">
                                    <i class="fas fa-eye" style="color: #27c4c9;"></i>
                                </button>
                                <button onclick="editPatient(${patient.id})" class="btn-icon" title="Modifier">
                                    <i class="fas fa-edit" style="color: #ffc107;"></i>
                                </button>
                                <button onclick="deletePatient(${patient.id})" class="btn-icon" title="Supprimer">
                                    <i class="fas fa-trash" style="color: #dc3545;"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * Recherche des patients
 */
async function handleSearch(e) {
    e.preventDefault();
    
    const searchNom = document.getElementById('searchNom').value;
    const searchTel = document.getElementById('searchTel').value;
    const searchDate = document.getElementById('searchDate').value;
    
    let url = `${API_BASE}patients.php?`;
    
    if (searchNom) {
        url += `search=${encodeURIComponent(searchNom)}`;
    } else if (searchTel) {
        url += `search=${encodeURIComponent(searchTel)}`;
    } else if (searchDate) {
        url += `date=${searchDate}`;
    } else {
        loadPatients();
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(url, { credentials: 'same-origin' });
        const result = await response.json();
        
        if (result.success) {
            displayPatients(result.patients);
        }
    } catch (error) {
        console.error('Erreur:', error);
        showMessage('Erreur lors de la recherche', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Met à jour les statistiques
 */
async function updateStats() {
    const ids = ['totalPatients', 'todayPatients', 'statUpcoming', 'statServices', 'statRevenue', 'statPendingPay'];
    const hint = document.getElementById('statsAdminHint');

    const setDash = () => {
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = '—';
        });
        if (hint) hint.classList.remove('hidden');
    };

    try {
        const response = await fetch(`${API_BASE}stats.php`, { credentials: 'same-origin' });
        const stats = await response.json();

        if (response.status === 403 || !stats.success) {
            setDash();
            return;
        }

        if (hint) hint.classList.add('hidden');

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        set('totalPatients', stats.total_patients ?? 0);
        set('todayPatients', stats.today_appointments ?? 0);
        set('statUpcoming', stats.upcoming_appointments ?? 0);
        set('statServices', stats.active_services ?? 0);
        const rev = Number(stats.month_revenue_paid ?? 0);
        set('statRevenue', Number.isFinite(rev) ? rev.toFixed(2) : '0');
        set('statPendingPay', stats.pending_payment_rdv ?? 0);
    } catch (error) {
        console.error('Erreur stats:', error);
        setDash();
    }
}

/**
 * Filtre les patients
 */
function filterPatients(type) {
    const today = new Date().toISOString().split('T')[0];
    
    switch(type) {
        case 'today':
            document.getElementById('searchDate').value = today;
            handleSearch(new Event('submit'));
            break;
        case 'week':
            // Calcul de la date dans 7 jours
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            const endDate = nextWeek.toISOString().split('T')[0];
            alert('Filtre semaine: affiche les patients avec RDV dans les 7 jours');
            break;
        case 'new':
            alert('Filtre nouveaux patients du mois');
            break;
    }
}

/**
 * Supprime un patient
 */
async function deletePatient(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce patient ?')) return;
    
    try {
        const response = await fetch(`${API_BASE}patients.php?id=${id}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        const result = await response.json();
        
        if (result.success) {
            showMessage('Patient supprimé', 'success');
            loadPatients();
            updateStats();
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        showMessage('Erreur lors de la suppression', 'error');
    }
}

/**
 * Affiche les détails d'un patient
 */
async function viewPatient(id) {
    try {
        const response = await fetch(`${API_BASE}patients.php?id=${id}`, { credentials: 'same-origin' });
        const result = await response.json();
        
        if (result.success && result.patient) {
            const p = result.patient;
            alert(`Patient: ${p.nom_complet}\nTél: ${p.telephone}\nEmail: ${p.email || '-'}\nMédecin: ${p.medecin_traitant === 'ilhem' ? 'Dr. Ilhem' : 'Dr. Chakib'}`);
        }
    } catch (error) {
        showMessage('Erreur chargement détails', 'error');
    }
}

/**
 * Édite un patient (à implémenter)
 */
function editPatient(id) {
    alert(`Fonction d'édition à implémenter pour l'ID: ${id}`);
    // Charger les données du patient dans le formulaire
}

/**
 * Export CSV
 */
function exportToCSV() {
    if (patients.length === 0) {
        showMessage('Aucune donnée à exporter', 'error');
        return;
    }
    
    const headers = ['Nom', 'Téléphone', 'Email', 'Médecin', 'Date naissance'];
    const rows = patients.map(p => [
        p.nom_complet,
        p.telephone,
        p.email || '',
        p.medecin_traitant === 'ilhem' ? 'Dr. Ilhem' : 'Dr. Chakib',
        formatDate(p.date_naissance)
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'patients.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showMessage('Export CSV réussi', 'success');
}

/**
 * Impression de la liste
 */
function printList() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Liste des Patients</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #005f5c; color: white; }
                h1 { color: #005f5c; }
            </style>
        </head>
        <body>
            <h1>Liste des Patients</h1>
            <p>Date: ${new Date().toLocaleDateString()}</p>
            <table>
                <thead>
                    <tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Médecin</th></tr>
                </thead>
                <tbody>
                    ${patients.map(p => `
                        <tr>
                            <td>${escapeHtml(p.nom_complet)}</td>
                            <td>${escapeHtml(p.telephone)}</td>
                            <td>${escapeHtml(p.email || '-')}</td>
                            <td>${p.medecin_traitant === 'ilhem' ? 'Dr. Ilhem' : 'Dr. Chakib'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

/**
 * Formate une date
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
}

/**
 * Échappe le HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Affiche un message
 */
function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i> ${message}`;
    
    const container = document.querySelector('.container-custom');
    container.insertBefore(messageDiv, container.firstChild);
    
    setTimeout(() => messageDiv.remove(), 3000);
}

/**
 * Affiche/masque le chargement
 */
function showLoading(show) {
    const btn = document.querySelector('#addPatientForm button[type="submit"]');
    if (btn) {
        btn.disabled = show;
        btn.innerHTML = show ? '<i class="fas fa-spinner fa-spin"></i> Chargement...' : '<i class="fas fa-save"></i> Enregistrer le Patient';
    }
}