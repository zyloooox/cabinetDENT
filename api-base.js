/**
 * URL de base des scripts PHP (dossier contenant les pages HTML).
 * Ne fonctionne pas en file:// : utilisez http://localhost/votre-dossier/ (XAMPP).
 */
function getApiBase() {
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        console.warn('[cabinet] Ouvrez le site via http://localhost/... (Apache XAMPP), pas en double-cliquant sur le fichier HTML.');
        return './';
    }
    const path = window.location.pathname || '/';
    const i = path.lastIndexOf('/');
    const folder = i >= 0 ? path.slice(0, i + 1) : '/';
    return window.location.origin + folder;
}
