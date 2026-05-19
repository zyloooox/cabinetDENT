<?php
declare(strict_types=1);
session_start();

require_once __DIR__ . '/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$db = Database::getInstance();
$action = $_GET['action'] ?? 'dashboard';

if (!isset($_SESSION['user_id'])) {
    $db->sendError('Connexion requise. Veuillez vous identifier.', 401);
}

$userId = (int) $_SESSION['user_id'];

try {
    switch ($action) {
        case 'dashboard':
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                $db->sendError('Méthode non autorisée', 405);
            }
            handleDashboard($db, $userId);
            break;
        case 'upload-photo':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                $db->sendError('Méthode non autorisée', 405);
            }
            handleUploadPhoto($db, $userId);
            break;
        case 'profile':
            if (!in_array($_SERVER['REQUEST_METHOD'], ['PUT', 'POST'], true)) {
                $db->sendError('Méthode non autorisée', 405);
            }
            handleUpdateProfile($db, $userId);
            break;
        default:
            $db->sendError('Action non reconnue', 400);
    }
} catch (PDOException $e) {
    error_log('[compte-api] ' . $e->getMessage());
    $db->sendError('Erreur lors de la lecture des données.', 500);
}

/**
 * Tableau de bord : profil, dossier patient, consultations, paiements.
 */
function handleDashboard(Database $db, int $userId): void {
    $user = $db->fetchOne(
        "SELECT id, nom, prenom, civilite, date_naissance, email, telephone, adresse, newsletter, role, created_at, photo_url
         FROM users WHERE id = ?",
        [$userId]
    );

    if (!$user) {
        session_destroy();
        $db->sendError('Utilisateur introuvable', 401);
    }

    $patient = $db->fetchOne(
        "SELECT id, nom_complet, genre, date_naissance, telephone, email, adresse, medecin_traitant, notes_medicales, created_at
         FROM patients WHERE user_id = ? ORDER BY id DESC LIMIT 1",
        [$userId]
    );

    $appointments = [];
    if ($patient) {
        $appointments = $db->fetchAll(
            "SELECT a.id, a.date_consultation, a.heure_consultation, a.duree_estimee,
                    a.montant_total, a.montant_paye, a.statut_paiement, a.statut_rdv, a.notes,
                    s.nom AS service_nom, s.categorie AS service_categorie, s.description AS service_description
             FROM appointments a
             LEFT JOIN services s ON s.id = a.service_id
             WHERE a.patient_id = ?
             ORDER BY a.date_consultation DESC, a.heure_consultation DESC",
            [(int) $patient['id']]
        );

        $ids = array_map(static fn (array $r): int => (int) $r['id'], $appointments);
        $paymentsByRdv = [];
        if ($ids !== []) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $rows = $db->fetchAll(
                "SELECT id, appointment_id, montant, mode_paiement, reference, notes, created_at
                 FROM payments WHERE appointment_id IN ($placeholders) ORDER BY created_at DESC",
                $ids
            );
            foreach ($rows as $row) {
                $aid = (int) $row['appointment_id'];
                $paymentsByRdv[$aid][] = $row;
            }
        }

        foreach ($appointments as &$a) {
            $aid = (int) $a['id'];
            $a['paiements'] = $paymentsByRdv[$aid] ?? [];
        }
        unset($a);
    }

    echo json_encode([
        'success' => true,
        'user'          => $user,
        'patient'       => $patient,
        'appointments'  => $appointments,
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * Mise à jour du profil : identité, civilité, date de naissance, email, téléphone, adresse, newsletter.
 * Synchronise le dossier patient lié (user_id) si présent.
 */
function handleUpdateProfile(Database $db, int $userId): void {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        $db->sendError('Données invalides', 400);
    }

    $nom = trim((string) ($data['nom'] ?? ''));
    $prenom = trim((string) ($data['prenom'] ?? ''));
    if ($nom === '' || $prenom === '') {
        $db->sendError('Le nom et le prénom sont obligatoires', 400);
    }

    $civilite = $data['civilite'] ?? 'M';
    if (!in_array($civilite, ['M', 'Mme', 'Mlle'], true)) {
        $civilite = 'M';
    }

    $dna = trim((string) ($data['date_naissance'] ?? ''));
    if ($dna === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dna)) {
        $db->sendError('Date de naissance invalide (format AAAA-MM-JJ)', 400);
    }
    $ts = strtotime($dna . ' 12:00:00');
    if ($ts === false || $ts > strtotime('today')) {
        $db->sendError('Date de naissance invalide', 400);
    }

    $email = trim((string) ($data['email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $db->sendError('Email invalide', 400);
    }
    $dup = $db->fetchOne('SELECT id FROM users WHERE email = ? AND id != ?', [$email, $userId]);
    if ($dup) {
        $db->sendError('Cet email est déjà utilisé par un autre compte', 400);
    }

    $telephone = trim((string) ($data['telephone'] ?? ''));
    if ($telephone === '' || strlen($telephone) < 6) {
        $db->sendError('Le numéro de téléphone est obligatoire (au moins 6 caractères)', 400);
    }

    $adresse = trim((string) ($data['adresse'] ?? ''));
    $adresse = $adresse === '' ? null : $adresse;

    $newsletter = 0;
    if (array_key_exists('newsletter', $data)) {
        $v = $data['newsletter'];
        $newsletter = ($v === true || $v === 1 || $v === '1') ? 1 : 0;
    } else {
        $curNw = $db->fetchOne('SELECT newsletter FROM users WHERE id = ?', [$userId]);
        $newsletter = (int) ($curNw['newsletter'] ?? 0);
    }

    $db->execute(
        'UPDATE users SET nom = ?, prenom = ?, civilite = ?, date_naissance = ?, email = ?, telephone = ?, adresse = ?, newsletter = ? WHERE id = ?',
        [$nom, $prenom, $civilite, $dna, $email, $telephone, $adresse, $newsletter, $userId]
    );

    $genre = $civilite === 'M' ? 'M' : 'F';
    $nomComplet = $prenom . ' ' . $nom;
    $db->execute(
        'UPDATE patients SET nom_complet = ?, genre = ?, date_naissance = ?, telephone = ?, email = ?, adresse = ? WHERE user_id = ?',
        [$nomComplet, $genre, $dna, $telephone, $email, $adresse, $userId]
    );

    $_SESSION['user_nom'] = $prenom . ' ' . $nom;
    $_SESSION['user_email'] = $email;

    $user = $db->fetchOne(
        'SELECT id, nom, prenom, civilite, date_naissance, email, telephone, adresse, newsletter, role, photo_url FROM users WHERE id = ?',
        [$userId]
    );

    echo json_encode([
        'success' => true,
        'message' => 'Profil mis à jour',
        'user'    => $user,
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * Upload photo de profil (JPEG, PNG, WebP, GIF — max 2 Mo).
 */
function handleUploadPhoto(Database $db, int $userId): void {
    if (empty($_FILES['photo']) || !isset($_FILES['photo']['error']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
        $db->sendError('Aucun fichier valide reçu', 400);
    }

    $tmp = $_FILES['photo']['tmp_name'];
    $size = (int) $_FILES['photo']['size'];
    if ($size > 2 * 1024 * 1024) {
        $db->sendError('Image trop volumineuse (maximum 2 Mo)', 400);
    }

    try {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($tmp) ?: '';
    } catch (Throwable $e) {
        $db->sendError('Vérification du fichier impossible (extension fileinfo).', 500);
    }
    $map = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];
    if (!isset($map[$mime])) {
        $db->sendError('Format non autorisé (utilisez JPG, PNG, WebP ou GIF)', 400);
    }
    $ext = $map[$mime];

    $dir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'avatars' . DIRECTORY_SEPARATOR;
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        $db->sendError('Impossible de créer le dossier de stockage', 500);
    }

    $basename = 'user_' . $userId . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
    $destFs = $dir . $basename;
    if (!move_uploaded_file($tmp, $destFs)) {
        $db->sendError('Échec de l’enregistrement du fichier', 500);
    }

    $publicPath = 'uploads/avatars/' . $basename;

    $old = $db->fetchOne('SELECT photo_url FROM users WHERE id = ?', [$userId]);
    if ($old && !empty($old['photo_url']) && str_starts_with((string) $old['photo_url'], 'uploads/avatars/')) {
        $oldPath = __DIR__ . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, (string) $old['photo_url']);
        if (is_file($oldPath) && str_starts_with(realpath($oldPath) ?: '', realpath($dir) ?: '')) {
            @unlink($oldPath);
        }
    }

    $db->execute('UPDATE users SET photo_url = ? WHERE id = ?', [$publicPath, $userId]);

    echo json_encode([
        'success'   => true,
        'message'   => 'Photo mise à jour',
        'photo_url' => $publicPath,
    ], JSON_UNESCAPED_UNICODE);
    exit();
}
