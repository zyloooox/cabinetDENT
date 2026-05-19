const API_BASE = getApiBase();

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    if (form) {
        form.addEventListener('submit', handleLogin);
    }
});

async function handleLogin(e) {
    e.preventDefault();
    
    const formData = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
    };
    
    try {
        const response = await fetch(`${API_BASE}auth.php?action=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('Connexion réussie !', 'success');
            setTimeout(() => {
                const role = result.user && result.user.role;
                let dest = 'mon-compte.html';
                if (role === 'admin' || role === 'medecin') dest = 'gestion-rdv.html';
                window.location.href = dest;
            }, 1000);
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        showMessage('Erreur de connexion', 'error');
    }
}

function showMessage(message, type) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.style.display = 'block';
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
        errorDiv.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
        errorDiv.className = `message ${type}`;
        setTimeout(() => { errorDiv.style.display = 'none'; }, type === 'success' ? 2000 : 4000);
    }
}