<?php
declare(strict_types=1);
session_start();

require_once __DIR__ . '/database.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

$db = Database::getInstance();
$isAdmin = isset($_SESSION['user_role']) && in_array($_SESSION['user_role'], ['admin', 'medecin'], true);
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    if ($method === 'POST' && $action === 'replace-image') {
        if (!$isAdmin) {
            $db->sendError('Accès non autorisé', 403);
        }
        handleReplaceServiceImage($db);
        exit();
    }

    switch ($method) {
        case 'GET':
            handleGetServices($db, $isAdmin);
            break;
        case 'POST':
            if (!$isAdmin) {
                $db->sendError('Accès non autorisé', 403);
            }
            handleCreateService($db);
            break;
        case 'PUT':
            if (!$isAdmin) $db->sendError('Accès non autorisé', 403);
            handleUpdateService($db);
            break;
        case 'DELETE':
            if (!$isAdmin) $db->sendError('Accès non autorisé', 403);
            handleDeleteService($db);
            break;
        default:
            $db->sendError('Méthode non supportée', 405);
    }
} catch (PDOException $e) {
    $db->sendError('Erreur: ' . $e->getMessage(), 500);
}

function handleGetServices(Database $db, bool $isAdmin): void {
    $categorie = $_GET['categorie'] ?? null;
    $id = $_GET['id'] ?? null;
    $adminList = $isAdmin && isset($_GET['admin']) && $_GET['admin'] === '1';

    if ($id) {
        $service = $db->fetchOne('SELECT * FROM services WHERE id = ?', [$id]);
        echo json_encode(['success' => true, 'service' => $service]);
        return;
    }

    $sql = 'SELECT * FROM services WHERE 1=1';
    $params = [];

    if (!$adminList) {
        $sql .= ' AND actif = 1';
    }

    if ($categorie) {
        $sql .= ' AND categorie = ?';
        $params[] = $categorie;
    }

    $sql .= ' ORDER BY ordre_affichage ASC, id ASC';
    $services = $db->fetchAll($sql, $params);
    
    // Grouper par catégorie
    $grouped = [];
    foreach ($services as $s) {
        $grouped[$s['categorie']][] = $s;
    }
    
    echo json_encode(['success' => true, 'services' => $services, 'grouped' => $grouped]);
}

function serviceImageUploadPath(array $file): ?string {
    if (!isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK || empty($file['tmp_name'])) {
        return null;
    }
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!in_array($ext, $allowed, true)) {
        return null;
    }
    $uploadDir = __DIR__ . '/uploads/services/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    $filename = uniqid('service_', true) . '.' . $ext;
    $destination = $uploadDir . $filename;
    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        return null;
    }
    return 'uploads/services/' . $filename;
}

function handleCreateService(Database $db): void {
    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        $db->sendError('Une image illustrative est obligatoire pour créer un service (JPEG, PNG, WebP ou GIF).', 400);
    }

    $imageUrl = serviceImageUploadPath($_FILES['image']);
    if ($imageUrl === null) {
        $db->sendError('Image invalide ou non enregistrée. Formats acceptés : JPEG, PNG, WebP, GIF.', 400);
    }

    $nom = trim((string) ($_POST['nom'] ?? ''));
    $cat = trim((string) ($_POST['categorie'] ?? ''));
    if ($nom === '' || $cat === '') {
        $db->sendError('Le nom et la catégorie sont obligatoires.', 400);
    }

    $sql = 'INSERT INTO services (nom, categorie, description, prix_min, prix_max, image_url, ordre_affichage, actif)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

    $id = $db->insert($sql, [
        $nom,
        $cat,
        $_POST['description'] ?? null,
        floatval($_POST['prix_min'] ?? 0),
        floatval($_POST['prix_max'] ?? 0),
        $imageUrl,
        intval($_POST['ordre_affichage'] ?? 0),
        isset($_POST['actif']) ? (int) (bool) $_POST['actif'] : 1,
    ]);

    $db->sendSuccess(['id' => $id], 'Service ajouté avec succès');
}

function handleReplaceServiceImage(Database $db): void {
    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
    if ($id <= 0) {
        $db->sendError('ID service requis.', 400);
    }
    $row = $db->fetchOne('SELECT id, image_url FROM services WHERE id = ?', [$id]);
    if (!$row) {
        $db->sendError('Service introuvable.', 404);
    }
    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        $db->sendError('Fichier image requis.', 400);
    }
    $imageUrl = serviceImageUploadPath($_FILES['image']);
    if ($imageUrl === null) {
        $db->sendError('Image invalide.', 400);
    }
    $old = $row['image_url'] ?? null;
    if ($old && is_string($old) && strpos($old, 'uploads/services/') === 0) {
        $path = __DIR__ . '/' . $old;
        if (is_file($path)) {
            @unlink($path);
        }
    }
    $db->execute('UPDATE services SET image_url = ? WHERE id = ?', [$imageUrl, $id]);
    $db->sendSuccess(['image_url' => $imageUrl], 'Image mise à jour.');
}

function handleUpdateService(Database $db): void {
    $data = json_decode(file_get_contents('php://input'), true);
    if (empty($data['id'])) {
        $db->sendError('ID requis');
    }

    $id = (int) $data['id'];
    $fields = ['nom = ?', 'categorie = ?', 'description = ?', 'prix_min = ?', 'prix_max = ?', 'ordre_affichage = ?'];
    $params = [
        $data['nom'],
        $data['categorie'],
        $data['description'] ?? null,
        floatval($data['prix_min'] ?? 0),
        floatval($data['prix_max'] ?? 0),
        intval($data['ordre_affichage'] ?? 0),
    ];

    if (array_key_exists('actif', $data)) {
        $fields[] = 'actif = ?';
        $params[] = !empty($data['actif']) ? 1 : 0;
    }

    $params[] = $id;
    $sql = 'UPDATE services SET ' . implode(', ', $fields) . ' WHERE id = ?';
    $db->execute($sql, $params);

    $db->sendSuccess([], 'Service modifié avec succès');
}

function handleDeleteService(Database $db): void {
    $id = $_GET['id'] ?? null;
    if (!$id) $db->sendError('ID requis');
    
    $db->execute("DELETE FROM services WHERE id = ?", [$id]);
    $db->sendSuccess([], 'Service supprimé avec succès');
}