<?php
declare(strict_types=1);
session_start();

require_once __DIR__ . '/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$db = Database::getInstance();
$isAdmin = isset($_SESSION['user_role']) && in_array($_SESSION['user_role'], ['admin', 'medecin'], true);
$userId = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;
$method = $_SERVER['REQUEST_METHOD'];
$raw = file_get_contents('php://input');
$body = json_decode($raw !== '' && $raw !== false ? $raw : '[]', true);
if (!is_array($body)) {
    $body = [];
}

try {
    switch ($method) {
        case 'GET':
            handleRdvList($db, $isAdmin, $userId);
            break;
        case 'POST':
            if ($userId <= 0) {
                $db->sendError('Connexion requise pour réserver un rendez-vous.', 401);
            }
            handleRdvBook($db, $userId, $body);
            break;
        case 'PUT':
            if (!$isAdmin) {
                $db->sendError('Accès réservé à l’administration.', 403);
            }
            handleRdvUpdate($db, $body);
            break;
        case 'DELETE':
            if (!$isAdmin) {
                $db->sendError('Accès réservé à l’administration.', 403);
            }
            handleRdvDelete($db);
            break;
        default:
            $db->sendError('Méthode non supportée', 405);
    }
} catch (PDOException $e) {
    error_log('[rdv-api] ' . $e->getMessage());
    $db->sendError('Erreur base de données.', 500);
}

/**
 * Liste des rendez-vous : tout pour l’admin, sinon ceux du patient lié au compte.
 */
function handleRdvList(Database $db, bool $isAdmin, int $userId): void {
    if ($isAdmin) {
        $rows = $db->fetchAll(
            "SELECT a.*, p.nom_complet, p.telephone, p.email, p.user_id AS patient_user_id,
                    s.nom AS service_nom, s.categorie AS service_categorie
             FROM appointments a
             INNER JOIN patients p ON p.id = a.patient_id
             LEFT JOIN services s ON s.id = a.service_id
             ORDER BY a.date_consultation DESC, a.heure_consultation DESC"
        );
        echo json_encode(['success' => true, 'appointments' => $rows], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($userId <= 0) {
        $db->sendError('Connexion requise.', 401);
    }

    $rows = $db->fetchAll(
        "SELECT a.*, s.nom AS service_nom, s.categorie AS service_categorie
         FROM appointments a
         INNER JOIN patients p ON p.id = a.patient_id
         LEFT JOIN services s ON s.id = a.service_id
         WHERE p.user_id = ?
         ORDER BY a.date_consultation DESC, a.heure_consultation DESC",
        [$userId]
    );
    echo json_encode(['success' => true, 'appointments' => $rows], JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * Crée ou retrouve le dossier patient lié au compte utilisateur.
 */
function ensurePatientForUser(Database $db, int $userId): int {
    $existing = $db->fetchOne(
        'SELECT id FROM patients WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [$userId]
    );
    if ($existing) {
        return (int) $existing['id'];
    }

    $u = $db->fetchOne(
        'SELECT nom, prenom, civilite, date_naissance, telephone, email, adresse FROM users WHERE id = ?',
        [$userId]
    );
    if (!$u) {
        $db->sendError('Utilisateur introuvable.', 404);
    }

    $genre = (($u['civilite'] ?? 'M') === 'M') ? 'M' : 'F';
    $nomComplet = trim(($u['prenom'] ?? '') . ' ' . ($u['nom'] ?? ''));
    if ($nomComplet === '') {
        $nomComplet = 'Patient';
    }

    return $db->insert(
        'INSERT INTO patients (user_id, nom_complet, genre, date_naissance, telephone, email, adresse, medecin_traitant, notes_medicales)
         VALUES (?, ?, ?, ?, ?, ?, ?, \'ilhem\', NULL)',
        [
            $userId,
            $nomComplet,
            $genre,
            $u['date_naissance'],
            $u['telephone'],
            $u['email'] !== null && $u['email'] !== '' ? trim((string) $u['email']) : null,
            isset($u['adresse']) && $u['adresse'] !== '' ? trim((string) $u['adresse']) : null,
        ]
    );
}

/**
 * Réservation en ligne (prestation / service).
 */
function handleRdvBook(Database $db, int $userId, array $data): void {
    $sid = isset($data['service_id']) ? (int) $data['service_id'] : 0;
    $date = isset($data['date_consultation']) ? trim((string) $data['date_consultation']) : '';
    $heure = isset($data['heure_consultation']) ? trim((string) $data['heure_consultation']) : '';
    $notes = isset($data['notes']) ? trim((string) $data['notes']) : '';
    $notes = $notes === '' ? null : $notes;

    if ($sid <= 0 || $date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        $db->sendError('Service et date de consultation (AAAA-MM-JJ) sont obligatoires.', 400);
    }

    $today = date('Y-m-d');
    if ($date < $today) {
        $db->sendError('La date doit être aujourd’hui ou ultérieure.', 400);
    }

    $svc = $db->fetchOne('SELECT id, nom, prix_min, prix_max FROM services WHERE id = ? AND actif = 1', [$sid]);
    if (!$svc) {
        $db->sendError('Service introuvable ou indisponible.', 400);
    }

    $montant = (float) ($svc['prix_min'] ?? 0);
    if ($montant <= 0 && isset($svc['prix_max'])) {
        $montant = (float) $svc['prix_max'];
    }

    if ($heure === '') {
        $heure = '09:00:00';
    } elseif (strlen($heure) === 5) {
        $heure .= ':00';
    }

    $patientId = ensurePatientForUser($db, $userId);

    $newId = $db->insert(
        'INSERT INTO appointments (patient_id, service_id, date_consultation, heure_consultation, duree_estimee, montant_total, montant_paye, statut_paiement, statut_rdv, notes)
         VALUES (?, ?, ?, ?, 30, ?, 0, \'non-payé\', \'planifié\', ?)',
        [$patientId, $sid, $date, $heure, $montant, $notes]
    );

    $db->sendSuccess(['appointment_id' => $newId], 'Demande de rendez-vous enregistrée.');
}

/**
 * Mise à jour d’un rendez-vous (statuts, montants, date…).
 */
function handleRdvUpdate(Database $db, array $data): void {
    $id = isset($data['id']) ? (int) $data['id'] : 0;
    if ($id <= 0) {
        $db->sendError('ID rendez-vous requis.', 400);
    }

    $row = $db->fetchOne('SELECT id FROM appointments WHERE id = ?', [$id]);
    if (!$row) {
        $db->sendError('Rendez-vous introuvable.', 404);
    }

    $fields = [];
    $params = [];

    if (array_key_exists('date_consultation', $data)) {
        $d = trim((string) $data['date_consultation']);
        if ($d !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) {
            $fields[] = 'date_consultation = ?';
            $params[] = $d;
        }
    }
    if (array_key_exists('heure_consultation', $data)) {
        $h = trim((string) $data['heure_consultation']);
        if ($h === '') {
            $fields[] = 'heure_consultation = NULL';
        } else {
            if (strlen($h) === 5) {
                $h .= ':00';
            }
            $fields[] = 'heure_consultation = ?';
            $params[] = $h;
        }
    }
    if (array_key_exists('statut_rdv', $data)) {
        $s = (string) $data['statut_rdv'];
        if (in_array($s, ['planifié', 'confirmé', 'terminé', 'annulé'], true)) {
            $fields[] = 'statut_rdv = ?';
            $params[] = $s;
        }
    }
    if (array_key_exists('statut_paiement', $data)) {
        $s = (string) $data['statut_paiement'];
        if (in_array($s, ['non-payé', 'partiellement-payé', 'payé'], true)) {
            $fields[] = 'statut_paiement = ?';
            $params[] = $s;
        }
    }
    if (array_key_exists('montant_total', $data)) {
        $fields[] = 'montant_total = ?';
        $params[] = max(0, (float) $data['montant_total']);
    }
    if (array_key_exists('montant_paye', $data)) {
        $fields[] = 'montant_paye = ?';
        $params[] = max(0, (float) $data['montant_paye']);
    }
    if (array_key_exists('notes', $data)) {
        $n = trim((string) $data['notes']);
        $fields[] = 'notes = ?';
        $params[] = $n === '' ? null : $n;
    }
    if (array_key_exists('service_id', $data) && $data['service_id'] !== null) {
        $sid = (int) $data['service_id'];
        if ($sid > 0) {
            $ok = $db->fetchOne('SELECT id FROM services WHERE id = ?', [$sid]);
            if ($ok) {
                $fields[] = 'service_id = ?';
                $params[] = $sid;
            }
        }
    }

    if ($fields === []) {
        $db->sendError('Aucun champ à mettre à jour.', 400);
    }

    $params[] = $id;
    $sql = 'UPDATE appointments SET ' . implode(', ', $fields) . ' WHERE id = ?';
    $db->execute($sql, $params);

    $db->sendSuccess([], 'Rendez-vous mis à jour.');
}

function handleRdvDelete(Database $db): void {
    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
    if ($id <= 0) {
        $db->sendError('ID requis.', 400);
    }
    $db->execute('DELETE FROM appointments WHERE id = ?', [$id]);
    $db->sendSuccess([], 'Rendez-vous supprimé.');
}
