/**
 * Inscription patient - Validation et envoi AJAX
 */
const API_BASE = getApiBase();

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('inscriptionForm');
    if (form) {
        form.addEventListener('submit', handleRegister);
    }
});

async function handleRegister(e) {
    e.preventDefault();
    
    // Récupération des données
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validation mot de passe
    if (password !== confirmPassword) {
        showMessage('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    if (password.length < 8) {
        showMessage('Le mot de passe doit contenir au moins 8 caractères', 'error');
        return;
    }
    
    // Récupération des conditions
    if (!document.getElementById('conditions').checked) {
        showMessage('Vous devez accepter les conditions générales', 'error');
        return;
    }
    
    const nomComplet = document.getElementById('nom').value.trim();
    const parts = nomComplet.split(/\s+/).filter(Boolean);
    const prenom = parts[0] || nomComplet;
    const nom = parts.length > 1 ? parts.slice(1).join(' ') : prenom;

    const formData = {
        nom,
        prenom,
        civilite: document.getElementById('civilite').value,
        date_naissance: document.getElementById('naissance').value,
        email: document.getElementById('email').value,
        telephone: document.getElementById('telephone').value,
        adresse: document.getElementById('adresse').value || null,
        password: password,
        newsletter: document.getElementById('newsletter').checked ? 1 : 0,
        compte_type: 'patient',
    };
    
    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        showMessage('Email invalide', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}auth.php?action=register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('Inscription réussie ! Redirection...', 'success');
            setTimeout(() => {
                window.location.href = 'mon-compte.html';
            }, 2000);
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        showMessage('Erreur de connexion', 'error');
    } finally {
        showLoading(false);
    }
}

function showMessage(message, type) {
    const existing = document.querySelector('.message');
    if (existing) existing.remove();
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i> ${message}`;
    
    const form = document.getElementById('inscriptionForm');
    form.insertBefore(msgDiv, form.firstChild);
    
    setTimeout(() => msgDiv.remove(), 5000);
}

function showLoading(show) {
    const btn = document.querySelector('#inscriptionForm button[type="submit"]');
    if (btn) {
        btn.disabled = show;
        btn.innerHTML = show ? '<i class="fas fa-spinner fa-spin"></i> Inscription...' : '<i class="fas fa-sign-in-alt"></i> S\'inscrire';
    }
}