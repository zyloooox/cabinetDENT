<?php
declare(strict_types=1);
/**
 * Installation initiale de la base (une fois).
 * Ouvrez dans le navigateur : http://localhost/.../install-db.php
 * Puis supprimez ce fichier (sécurité).
 */
header('Content-Type: application/json; charset=utf-8');

if (!extension_loaded('mysqli')) {
    echo json_encode([
        'ok'      => false,
        'error'   => 'Extension mysqli absente. Activez extension=mysqli dans php.ini (XAMPP).',
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$defaults = [
    'host'     => '127.0.0.1',
    'username' => 'root',
    'password' => '',
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
$user = (string) $defaults['username'];
$pass = array_key_exists('password', $defaults) ? (string) $defaults['password'] : '';
$port = isset($defaults['port']) && $defaults['port'] !== null && $defaults['port'] !== ''
    ? (int) $defaults['port']
    : null;

$mysqli = mysqli_init();
if (!$mysqli) {
    echo json_encode(['ok' => false, 'error' => 'mysqli_init a échoué'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if ($port && $port > 0) {
    $mysqli->real_connect($host, $user, $pass, '', $port);
} else {
    $mysqli->real_connect($host, $user, $pass);
}

if ($mysqli->connect_error) {
    echo json_encode([
        'ok'    => false,
        'error' => 'Connexion MySQL impossible : ' . $mysqli->connect_error,
        'hint'  => 'Démarrez MySQL dans XAMPP et vérifiez db-config.php.',
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$mysqli->set_charset('utf8mb4');

$dbName = 'cabinet_dentaire';
$check  = $mysqli->query("SHOW DATABASES LIKE '" . $mysqli->real_escape_string($dbName) . "'");
if ($check && $check->num_rows > 0) {
    $mysqli->select_db($dbName);
    $users = $mysqli->query("SHOW TABLES LIKE 'users'");
    if ($users && $users->num_rows > 0) {
        echo json_encode([
            'ok'      => true,
            'skipped' => true,
            'message' => 'La base « cabinet_dentaire » existe déjà avec les tables. Aucune action.',
            'next'    => 'Réessayez l’inscription. En cas d’erreur, ouvrez db-check.php.',
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        $mysqli->close();
        exit;
    }
}

$sqlFile = __DIR__ . DIRECTORY_SEPARATOR . 'database.sql';
if (!is_readable($sqlFile)) {
    echo json_encode([
        'ok'    => false,
        'error' => 'Fichier database.sql introuvable ou illisible.',
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $mysqli->close();
    exit;
}

$sql = file_get_contents($sqlFile);
if ($sql === false || trim($sql) === '') {
    echo json_encode(['ok' => false, 'error' => 'database.sql est vide.'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $mysqli->close();
    exit;
}

if (!$mysqli->multi_query($sql)) {
    echo json_encode([
        'ok'    => false,
        'error' => 'Erreur SQL : ' . $mysqli->error,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $mysqli->close();
    exit;
}

do {
    if ($result = $mysqli->store_result()) {
        $result->free();
    }
    if (!$mysqli->more_results()) {
        break;
    }
} while ($mysqli->next_result());

if ($mysqli->errno) {
    echo json_encode([
        'ok'    => false,
        'error' => 'Erreur pendant l’exécution : ' . $mysqli->error,
        'errno' => $mysqli->errno,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $mysqli->close();
    exit;
}

$mysqli->close();

echo json_encode([
    'ok'      => true,
    'message' => 'Base « cabinet_dentaire » créée et données initiales importées.',
    'next'    => 'Supprimez install-db.php du serveur, puis réessayez l’inscription sur inscription-connexion.html.',
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
