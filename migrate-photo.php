<?php
declare(strict_types=1);
/**
 * Ajoute la colonne photo_url à users si elle manque. Ouvrir une fois dans le navigateur.
 */
require_once __DIR__ . '/database.php';
header('Content-Type: application/json; charset=utf-8');

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();
    $row = $pdo->query("
        SELECT COUNT(*) AS c FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'photo_url'
    ")->fetch(PDO::FETCH_ASSOC);
    if ((int) ($row['c'] ?? 0) > 0) {
        echo json_encode(['ok' => true, 'message' => 'La colonne photo_url existe déjà.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $pdo->exec('ALTER TABLE users ADD COLUMN photo_url VARCHAR(500) NULL AFTER newsletter');
    echo json_encode(['ok' => true, 'message' => 'Colonne photo_url ajoutée avec succès.'], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
