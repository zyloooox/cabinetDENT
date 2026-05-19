<?php
declare(strict_types=1);
session_start();

require_once __DIR__ . '/database.php';

// Headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Médecins = administrateurs du cabinet (même accès que le compte admin technique).
$isLogged = isset($_SESSION['user_id']);
$role = $_SESSION['user_role'] ?? '';
$canAccessPatientsApi = $isLogged && in_array($role, ['medecin', 'admin'], true);

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody !== '' && $rawBody !== false ? $rawBody : '[]', true);
if (!is_array($data)) {
    $data = [];
}

try {
    switch ($method) {
        case 'GET':
            if (!$canAccessPatientsApi) {
                $db->sendError('Accès réservé aux médecins du cabinet. Connectez-vous avec un compte médecin.', 403);
            }
            handleGetPatients($db);
            break;
        case 'POST':
            if (!$canAccessPatientsApi) {
                $db->sendError('Accès réservé aux médecins du cabinet.', 403);
            }
            handleCreatePatient($db, $data);
            break;
        case 'PUT':
            if (!$canAccessPatientsApi) {
                $db->sendError('Accès réservé aux médecins du cabinet.', 403);
            }
            handleUpdatePatient($db, $data);
            break;
        case 'DELETE':
            if (!$canAccessPatientsApi) {
                $db->sendError('Accès réservé aux médecins du cabinet.', 403);
            }
            handleDeletePatient($db);
            break;
        default:
            $db->sendError('Méthode non supportée', 405);
    }
} catch (PDOException $e) {
    $db->sendError('Erreur: ' . $e->getMessage(), 500);
}

/**
 * Récupération des patients (avec filtres)
 */
function handleGetPatients(Database $db): void {
    $id = $_GET['id'] ?? null;
    $search = $_GET['search'] ?? null;
    $date = $_GET['date'] ?? null;
    
    // Patient spécifique
    if ($id) {
        $patient = $db->fetchOne("
            SELECT p.*, a.date_consultation, a.heure_consultation, 
                   a.montant_total, a.montant_paye, a.statut_paiement, a.statut_rdv
            FROM patients p
            LEFT JOIN appointments a ON p.id = a.patient_id AND a.date_consultation >= CURDATE()
            WHERE p.id = ?
            ORDER BY a.date_consultation ASC
        ", [$id]);
        
        if (!$patient) $db->sendError('Patient non trouvé', 404);
        echo json_encode(['success' => true, 'patient' => $patient]);
        return;
    }
    
    // Construction de la requête avec filtres
    $sql = "
        SELECT p.*, 
               (SELECT COUNT(*) FROM appointments WHERE patient_id = p.id) as nb_rdv,
               (SELECT date_consultation FROM appointments WHERE patient_id = p.id AND date_consultation >= CURDATE() ORDER BY date_consultation ASC LIMIT 1) as prochain_rdv
        FROM patients p
        WHERE 1=1
    ";
    $params = [];
    
    if ($search) {
        $sql .= " AND (p.nom_complet LIKE ? OR p.telephone LIKE ? OR p.email LIKE ?)";
        $like = "%$search%";
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }
    
    if ($date) {
        $sql .= " AND EXISTS (SELECT 1 FROM appointments WHERE patient_id = p.id AND date_consultation = ?)";
        $params[] = $date;
    }
    
    $sql .= " ORDER BY p.created_at DESC";
    
    $patients = $db->fetchAll($sql, $params);
    echo json_encode(['success' => true, 'patients' => $patients]);
}

/**
 * Création d'un patient
 */
function handleCreatePatient(Database $db, ?array $data): void {
    $nom = isset($data['nom_complet']) ? trim((string) $data['nom_complet']) : '';
    $tel = isset($data['telephone']) ? trim((string) $data['telephone']) : '';
    $dna = isset($data['date_naissance']) ? trim((string) $data['date_naissance']) : '';
    $dc = isset($data['date_consultation']) ? trim((string) $data['date_consultation']) : '';

    if ($nom === '' || $tel === '' || $dna === '' || $dc === '') {
        $db->sendError('Nom complet, téléphone, date de naissance et date de consultation sont obligatoires.');
    }

    $med = $data['medecin_traitant'] ?? 'ilhem';
    if (!in_array($med, ['ilhem', 'chakib'], true)) {
        $med = 'ilhem';
    }

    $heure = $data['heure_consultation'] ?? null;
    if ($heure === '' || $heure === null) {
        $heure = null;
    }

    $email = isset($data['email']) ? trim((string) $data['email']) : '';
    $email = $email === '' ? null : $email;

    $adresse = isset($data['adresse']) ? trim((string) $data['adresse']) : '';
    $adresse = $adresse === '' ? null : $adresse;

    $notes = isset($data['notes_medicales']) ? trim((string) $data['notes_medicales']) : '';
    $notes = $notes === '' ? null : $notes;

    $statutPay = $data['statut_paiement'] ?? 'non-payé';
    if (!in_array($statutPay, ['non-payé', 'partiellement-payé', 'payé'], true)) {
        $statutPay = 'non-payé';
    }

    $serviceId = isset($data['service_id']) ? (int) $data['service_id'] : 0;
    $serviceId = $serviceId > 0 ? $serviceId : null;
    if ($serviceId !== null) {
        $svcOk = $db->fetchOne('SELECT id FROM services WHERE id = ?', [$serviceId]);
        if (!$svcOk) {
            $serviceId = null;
        }
    }

    $mt = isset($data['montant_total']) ? (float) $data['montant_total'] : 0.0;
    $mp = isset($data['montant_paye']) ? (float) $data['montant_paye'] : 0.0;
    if ($mt < 0) {
        $mt = 0.0;
    }
    if ($mp < 0) {
        $mp = 0.0;
    }

    // Insertion patient
    $patientSql = "INSERT INTO patients (nom_complet, genre, date_naissance, telephone, email, medecin_traitant, notes_medicales, adresse) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

    $patientId = $db->insert($patientSql, [
        $nom,
        $data['genre'] ?? 'M',
        $dna,
        $tel,
        $email,
        $med,
        $notes,
        $adresse,
    ]);

    // Insertion rendez-vous
    $rdvSql = 'INSERT INTO appointments (patient_id, service_id, date_consultation, heure_consultation, montant_total, montant_paye, statut_paiement, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

    $db->insert($rdvSql, [
        $patientId,
        $serviceId,
        $dc,
        $heure,
        $mt,
        $mp,
        $statutPay,
        $notes,
    ]);

    $db->sendSuccess(['id' => $patientId], 'Patient ajouté avec succès');
}

/**
 * Modification d'un patient
 */
function handleUpdatePatient(Database $db, ?array $data): void {
    if (empty($data['id'])) {
        $db->sendError('ID patient requis');
    }
    
    $sql = "UPDATE patients SET 
            nom_complet = ?, genre = ?, date_naissance = ?, telephone = ?, 
            email = ?, medecin_traitant = ?, notes_medicales = ?, adresse = ?
            WHERE id = ?";
    
    $db->execute($sql, [
        $data['nom_complet'],
        $data['genre'] ?? 'M',
        $data['date_naissance'],
        $data['telephone'],
        $data['email'] ?? null,
        $data['medecin_traitant'] ?? 'ilhem',
        $data['notes_medicales'] ?? null,
        $data['adresse'] ?? null,
        $data['id']
    ]);
    
    $db->sendSuccess([], 'Patient modifié avec succès');
}

/**
 * Suppression d'un patient
 */
function handleDeletePatient(Database $db): void {
    $id = $_GET['id'] ?? null;
    if (!$id) $db->sendError('ID patient requis');
    
    $db->execute("DELETE FROM patients WHERE id = ?", [$id]);
    $db->sendSuccess([], 'Patient supprimé avec succès');
}