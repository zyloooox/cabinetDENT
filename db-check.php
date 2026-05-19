<?php
declare(strict_types=1);
/**
 * Diagnostic connexion MySQL — ouvrez dans le navigateur :
 *   http://localhost/projet%20html%20-%20Copie/db-check.php
 * Supprimez ce fichier en production si vous le souhaitez.
 */
header('Content-Type: application/json; charset=utf-8');

$defaults = [
    'host'     => '127.0.0.1',
    'database' => 'cabinet_dentaire',
    'username' => 'root',
    'password' => '',
    'charset'  => 'utf8mb4',
    'port'     => null,
];

$path = __DIR__ . DIRECTORY_SEPARATOR . 'db-config.php';
if (is_file($path)) {
    $loaded = require $path;
    if (is_array($loaded)) {
        $defaults = array_merge($defaults, $loaded);
    }
}

$host = (string) $defaults['host'];
$db   = (string) $defaults['database'];
$user = (string) $defaults['username'];
$pass = array_key_exists('password', $defaults) ? (string) $defaults['password'] : '';
$charset = (string) ($defaults['charset'] ?? 'utf8mb4');
$port = isset($defaults['port']) && $defaults['port'] !== null && $defaults['port'] !== ''
    ? (int) $defaults['port']
    : null;

$out = [
    'config_file' => is_file($path),
    'host'        => $host,
    'database'    => $db,
    'username'    => $user,
];

// 1) Test serveur (sans nom de base)
$dsnServer = "mysql:host={$host}" . ($port && $port > 0 ? ";port={$port}" : '') . ";charset={$charset}";
try {
    $pdo = new PDO($dsnServer, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $out['server_reachable'] = true;
} catch (PDOException $e) {
    $out['server_reachable'] = false;
    $out['error'] = $e->getMessage();
    $out['hint'] = 'MySQL n\'est pas joignable : démarrez « MySQL » dans XAMPP, ou corrigez host/port/mot de passe dans db-config.php.';
    echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// 2) La base existe-t-elle ?
$stmt = $pdo->query("SHOW DATABASES LIKE " . $pdo->quote($db));
$exists = $stmt && $stmt->fetch();
$out['database_exists'] = (bool) $exists;

if (!$exists) {
    $out['error'] = "La base « {$db} » n'existe pas.";
    $out['hint'] = 'Dans phpMyAdmin : Importer le fichier database.sql du projet (il contient CREATE DATABASE et les tables).';
    echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// 3) Connexion complète + table users
$dsn = "mysql:host={$host}" . ($port && $port > 0 ? ";port={$port}" : '') . ";dbname={$db};charset={$charset}";
try {
    $pdo2 = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $tables = $pdo2->query("SHOW TABLES LIKE 'users'")->fetch();
    $out['connection_ok'] = true;
    $out['users_table'] = (bool) $tables;
    if (!$tables) {
        $out['hint'] = 'La base existe mais la table « users » manque : réimportez database.sql.';
    } else {
        $out['hint'] = 'Tout semble correct. Réessayez l\'inscription.';
    }
} catch (PDOException $e) {
    $out['connection_ok'] = false;
    $out['error'] = $e->getMessage();
}

echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
