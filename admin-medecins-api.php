<?php
declare(strict_types=1);
session_start();

require_once __DIR__ . '/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if (!isset($_SESSION['user_role']) || !in_array($_SESSION['user_role'], ['admin', 'medecin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Accès réservé à l’administrateur.'], JSON_UNESCAPED_UNICODE);
    exit();
}

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$raw = file_get_contents('php://input');
$body = json_decode($raw !== '' && $raw !== false ? $raw : '[]', true);
if (!is_array($body)) {
    $body = [];
}

try {
    if ($method === 'GET') {
        $medecins = $db->fetchAll(
            "SELECT id, nom, prenom, email, telephone, created_at FROM users WHERE role = 'medecin' ORDER BY id ASC"
        );
        $patients = $db->fetchAll(
            "SELECT id, nom, prenom, email, telephone, created_at FROM users WHERE role = 'patient' ORDER BY created_at DESC LIMIT 300"
        );
        echo json_encode([
            'success'   => true,
            'medecins'  => $medecins,
            'patients'  => $patients,
            'max_slots' => 2,
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($method === 'POST') {
        if (($body['action'] ?? '') === 'create_medecin') {
            handleCreateMedecinAccount($db, $body);
            exit();
        }

        $promoteId = isset($body['promote_user_id']) ? (int) $body['promote_user_id'] : 0;
        $replaceId = isset($body['replace_medecin_id']) ? (int) $body['replace_medecin_id'] : 0;

        if ($promoteId <= 0) {
            $db->sendError('Identifiant du compte à promouvoir médecin requis.', 400);
        }

        $target = $db->fetchOne('SELECT id, role FROM users WHERE id = ?', [$promoteId]);
        if (!$target) {
            $db->sendError('Utilisateur introuvable.', 404);
        }
        if (($target['role'] ?? '') === 'medecin') {
            $db->sendError('Ce compte est déjà médecin.', 400);
        }
        if (($target['role'] ?? '') === 'admin') {
            $db->sendError('Impossible de modifier le rôle d’un administrateur ainsi.', 400);
        }

        $nbRow = $db->fetchOne("SELECT COUNT(*) AS c FROM users WHERE role = 'medecin'");
        $nb = (int) ($nbRow['c'] ?? 0);

        $pdo = $db->getConnection();
        $pdo->beginTransaction();
        try {
            if ($nb >= 2) {
                if ($replaceId <= 0) {
                    $pdo->rollBack();
                    $db->sendError('Les deux postes médecins sont occupés. Indiquez quel médecin est remplacé (replace_medecin_id).', 400);
                }
                $replace = $db->fetchOne('SELECT id, role FROM users WHERE id = ?', [$replaceId]);
                if (!$replace || ($replace['role'] ?? '') !== 'medecin') {
                    $pdo->rollBack();
                    $db->sendError('Le compte à remplacer doit être l’un des médecins actuels.', 400);
                }
                if ((int) $replace['id'] === $promoteId) {
                    $pdo->rollBack();
                    $db->sendError('Choix incohérent (même utilisateur).', 400);
                }
                $db->execute("UPDATE users SET role = 'patient' WHERE id = ?", [$replaceId]);
            }

            $db->execute("UPDATE users SET role = 'medecin' WHERE id = ?", [$promoteId]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $medecins = $db->fetchAll(
            "SELECT id, nom, prenom, email, telephone FROM users WHERE role = 'medecin' ORDER BY id ASC"
        );
        echo json_encode([
            'success'  => true,
            'message'  => 'Rôle médecin mis à jour.',
            'medecins' => $medecins,
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $db->sendError('Méthode non autorisée', 405);
} catch (PDOException $e) {
    error_log('[admin-medecins-api] ' . $e->getMessage());
    $db->sendError('Erreur base de données.', 500);
}

/**
 * Création d’un nouveau compte utilisateur avec rôle médecin (max 2).
 * Si les 2 postes sont pris : fournir replace_medecin_id pour repasser ce médecin en patient puis créer le nouveau.
 */
function handleCreateMedecinAccount(Database $db, array $body): void {
    $nbRow = $db->fetchOne("SELECT COUNT(*) AS c FROM users WHERE role = 'medecin'");
    $nb = (int) ($nbRow['c'] ?? 0);

    $replaceId = isset($body['replace_medecin_id']) ? (int) $body['replace_medecin_id'] : 0;

    if ($nb >= 2) {
        if ($replaceId <= 0) {
            $db->sendError('Les deux postes médecins sont occupés. Choisissez quel médecin est remplacé, ou promouvez un patient existant.', 400);
        }
        $rep = $db->fetchOne('SELECT id, role FROM users WHERE id = ?', [$replaceId]);
        if (!$rep || ($rep['role'] ?? '') !== 'medecin') {
            $db->sendError('Le compte à remplacer doit être l’un des médecins actuels.', 400);
        }
    }

    $nom = isset($body['nom']) ? trim((string) $body['nom']) : '';
    $prenom = isset($body['prenom']) ? trim((string) $body['prenom']) : '';
    $email = isset($body['email']) ? trim((string) $body['email']) : '';
    $telephone = isset($body['telephone']) ? trim((string) $body['telephone']) : '';
    $dna = isset($body['date_naissance']) ? trim((string) $body['date_naissance']) : '';
    $password = (string) ($body['password'] ?? '');

    if ($nom === '' || $prenom === '' || $email === '' || $telephone === '' || $dna === '') {
        $db->sendError('Nom, prénom, email, téléphone et date de naissance sont obligatoires.', 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $db->sendError('Email invalide.', 400);
    }
    if (strlen($password) < 8) {
        $db->sendError('Le mot de passe doit contenir au moins 8 caractères.', 400);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dna)) {
        $db->sendError('Date de naissance invalide (AAAA-MM-JJ).', 400);
    }

    $civilite = $body['civilite'] ?? 'M';
    if (!in_array($civilite, ['M', 'Mme', 'Mlle'], true)) {
        $civilite = 'M';
    }

    $dup = $db->fetchOne('SELECT id FROM users WHERE email = ?', [$email]);
    if ($dup) {
        $db->sendError('Cet email est déjà utilisé.', 400);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    $pdo = $db->getConnection();
    $pdo->beginTransaction();
    try {
        if ($nb >= 2 && $replaceId > 0) {
            $db->execute("UPDATE users SET role = 'patient' WHERE id = ?", [$replaceId]);
        }

        $newId = $db->insert(
            'INSERT INTO users (nom, prenom, civilite, date_naissance, email, telephone, adresse, password, newsletter, role)
             VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 0, \'medecin\')',
            [$nom, $prenom, $civilite, $dna, $email, $telephone, $hash]
        );

        $pdo->commit();

        $medecins = $db->fetchAll(
            "SELECT id, nom, prenom, email, telephone FROM users WHERE role = 'medecin' ORDER BY id ASC"
        );
        echo json_encode([
            'success'   => true,
            'message'   => 'Compte médecin créé.',
            'medecins'  => $medecins,
            'new_id'    => $newId,
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}
