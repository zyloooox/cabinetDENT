<?php
declare(strict_types=1);
session_start();

require_once __DIR__ . '/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$isAdmin = isset($_SESSION['user_role']) && in_array($_SESSION['user_role'], ['admin', 'medecin'], true);

if (!$isAdmin) {
    http_response_code(403);
    echo json_encode([
        'success'              => false,
        'message'              => 'Statistiques réservées aux médecins / administration du cabinet.',
        'total_patients'       => 0,
        'today_appointments'   => 0,
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

$db = Database::getInstance();

$totalPatients = $db->fetchOne('SELECT COUNT(*) AS total FROM patients');
$todayAppointments = $db->fetchOne('SELECT COUNT(*) AS total FROM appointments WHERE date_consultation = CURDATE()');
$upcoming = $db->fetchOne(
    "SELECT COUNT(*) AS total FROM appointments WHERE date_consultation >= CURDATE() AND statut_rdv NOT IN ('annulé','terminé')"
);
$totalServices = $db->fetchOne('SELECT COUNT(*) AS total FROM services WHERE actif = 1');
$monthRevenue = $db->fetchOne(
    "SELECT COALESCE(SUM(montant_paye), 0) AS total FROM appointments
     WHERE statut_paiement = 'payé'
       AND YEAR(date_consultation) = YEAR(CURDATE())
       AND MONTH(date_consultation) = MONTH(CURDATE())"
);
$pendingPay = $db->fetchOne(
    "SELECT COUNT(*) AS total FROM appointments WHERE statut_paiement != 'payé' AND statut_rdv != 'annulé'"
);

echo json_encode([
    'success'               => true,
    'total_patients'        => (int) ($totalPatients['total'] ?? 0),
    'today_appointments'    => (int) ($todayAppointments['total'] ?? 0),
    'upcoming_appointments' => (int) ($upcoming['total'] ?? 0),
    'active_services'       => (int) ($totalServices['total'] ?? 0),
    'month_revenue_paid'    => (float) ($monthRevenue['total'] ?? 0),
    'pending_payment_rdv'   => (int) ($pendingPay['total'] ?? 0),
], JSON_UNESCAPED_UNICODE);
