<?php
declare(strict_types=1);
session_start();

require_once __DIR__ . '/database.php';

// Headers CORS
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$db = Database::getInstance();
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput !== false && $rawInput !== '' ? $rawInput : '[]', true);
if (!is_array($data)) {
    $data = [];
}
$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'register':
            handleRegister($db, $data);
            break;
        case 'login':
            handleLogin($db, $data);
            break;
        case 'logout':
            handleLogout();
            break;
        case 'me':
            handleGetMe($db);
            break;
        default:
            $db->sendError('Action non reconnue', 400);
    }
} catch (PDOException $e) {
    error_log('[auth] PDO: ' . $e->getMessage());
    $db->sendError('Erreur base de données. Vérifiez que MySQL est démarré et que la base existe.', 500);
} catch (Throwable $e) {
    error_log('[auth] ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Erreur serveur. Consultez les logs PHP ou contactez l’administrateur.']);
    exit();
}

/**
 * Gestion de l'inscription
 */
function handleRegister(Database $db, array $data): void {
    // Validation des champs obligatoires
    $required = ['nom', 'prenom', 'email', 'telephone', 'password', 'date_naissance'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            $db->sendError("Le champ '$field' est obligatoire");
        }
    }
    
    // Validation email
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $db->sendError('Email invalide');
    }
    
    // Vérification email unique
    $existing = $db->fetchOne("SELECT id FROM users WHERE email = ?", [$data['email']]);
    if ($existing) {
        $db->sendError('Cet email est déjà utilisé');
    }
    
    // Validation mot de passe (min 8 caractères)
    if (strlen($data['password']) < 8) {
        $db->sendError('Le mot de passe doit contenir au moins 8 caractères');
    }
    
    $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);

    $pdo = $db->getConnection();
    $pdo->beginTransaction();

    try {
        $roleInsert = 'patient';

        $sql = 'INSERT INTO users (nom, prenom, civilite, date_naissance, email, telephone, adresse, password, newsletter, role)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

        $id = $db->insert($sql, [
            $data['nom'],
            $data['prenom'],
            $data['civilite'] ?? 'M',
            $data['date_naissance'],
            $data['email'],
            $data['telephone'],
            $data['adresse'] ?? null,
            $hashedPassword,
            $data['newsletter'] ?? 0,
            $roleInsert,
        ]);

        $patientSql = 'INSERT INTO patients (user_id, nom_complet, genre, date_naissance, telephone, email, adresse)
               VALUES (?, ?, ?, ?, ?, ?, ?)';
        $db->insert($patientSql, [
            $id,
            $data['prenom'] . ' ' . $data['nom'],
            ($data['civilite'] ?? 'M') === 'M' ? 'M' : 'F',
            $data['date_naissance'],
            $data['telephone'],
            $data['email'],
            $data['adresse'] ?? null,
        ]);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $_SESSION['user_id'] = $id;
    $_SESSION['user_nom'] = $data['prenom'] . ' ' . $data['nom'];
    $_SESSION['user_email'] = $data['email'];
    $_SESSION['user_role'] = $roleInsert;

    $db->sendSuccess(['user' => [
        'id'     => $id,
        'nom'    => $data['prenom'] . ' ' . $data['nom'],
        'email'  => $data['email'],
        'role'   => $roleInsert,
    ]], 'Inscription réussie');
}

/**
 * Gestion de la connexion
 */
function handleLogin(Database $db, array $data): void {
    if (empty($data['email']) || empty($data['password'])) {
        $db->sendError('Email et mot de passe requis');
    }
    
    $user = $db->fetchOne("SELECT * FROM users WHERE email = ?", [$data['email']]);
    
    if (!$user || !password_verify($data['password'], $user['password'])) {
        $db->sendError('Email ou mot de passe incorrect', 401);
    }

    $role = (string) ($user['role'] ?? 'patient');
    if ($role === 'user') {
        $role = 'patient';
        $db->execute('UPDATE users SET role = ? WHERE id = ?', ['patient', (int) $user['id']]);
    }

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_nom'] = $user['prenom'] . ' ' . $user['nom'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_role'] = $role;
    
    $db->sendSuccess(['user' => [
        'id' => $user['id'],
        'nom' => $user['prenom'] . ' ' . $user['nom'],
        'email' => $user['email'],
        'role' => $role,
    ]], 'Connexion réussie');
}

/**
 * Gestion de la déconnexion
 */
function handleLogout(): void {
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'Déconnexion réussie']);
    exit();
}

/**
 * Récupère l'utilisateur connecté
 */
function handleGetMe(Database $db): void {
    if (!isset($_SESSION['user_id'])) {
        $db->sendError('Non authentifié', 401);
    }
    
    $user = $db->fetchOne(
        "SELECT id, nom, prenom, civilite, date_naissance, email, telephone, adresse, newsletter, role, photo_url, created_at
         FROM users WHERE id = ?",
        [$_SESSION['user_id']]
    );
    
    if (!$user) {
        session_destroy();
        $db->sendError('Utilisateur non trouvé', 401);
    }

    if (($user['role'] ?? '') === 'user') {
        $db->execute('UPDATE users SET role = ? WHERE id = ?', ['patient', (int) $user['id']]);
        $user['role'] = 'patient';
        $_SESSION['user_role'] = 'patient';
    }

    $db->sendSuccess(['user' => $user]);
}