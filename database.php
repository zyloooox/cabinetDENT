<?php
declare(strict_types=1);

/**
 * Classe Database - Gestion de la connexion PDO
 * Singleton pattern pour une connexion unique
 */
class Database {
    private static ?Database $instance = null;
    private ?PDO $conn = null;
    
    private string $host = '127.0.0.1';
    private string $db_name = 'cabinet_dentaire';
    private string $username = 'root';
    private string $password = '';
    private string $charset = 'utf8mb4';
    private ?int $port = null;
    
    private function __construct() {
        $this->loadConfig();
        $this->connect();
    }
    
    /**
     * Charge db-config.php à côté de ce fichier (optionnel).
     */
    private function loadConfig(): void {
        $path = __DIR__ . DIRECTORY_SEPARATOR . 'db-config.php';
        if (!is_file($path)) {
            return;
        }
        $cfg = require $path;
        if (!is_array($cfg)) {
            return;
        }
        if (!empty($cfg['host'])) {
            $this->host = (string) $cfg['host'];
        }
        if (!empty($cfg['database'])) {
            $this->db_name = (string) $cfg['database'];
        }
        if (isset($cfg['username'])) {
            $this->username = (string) $cfg['username'];
        }
        if (array_key_exists('password', $cfg)) {
            $this->password = (string) $cfg['password'];
        }
        if (!empty($cfg['charset'])) {
            $this->charset = (string) $cfg['charset'];
        }
        if (!empty($cfg['port'])) {
            $this->port = (int) $cfg['port'];
        }
    }
    
    /**
     * Pattern Singleton - Recupere linstance unique
     */
    public static function getInstance(): Database {
        if (self::$instance === null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }
    
    /**
     * etablit la connexion PDO
     */
    private function connect(): void {
        try {
            $dsn = "mysql:host={$this->host}";
            if ($this->port !== null && $this->port > 0) {
                $dsn .= ";port={$this->port}";
            }
            $dsn .= ";dbname={$this->db_name};charset={$this->charset}";
            
            $this->conn = new PDO($dsn, $this->username, $this->password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]);
        } catch (PDOException $e) {
            error_log('[cabinet_dentaire] PDO: ' . $e->getMessage());
            $hint = 'Démarrez MySQL dans le panneau XAMPP, puis dans phpMyAdmin importez le fichier database.sql pour créer la base « cabinet_dentaire » et les tables. ';
            $hint .= 'Si le compte root a un mot de passe, éditez db-config.php (voir db-config.example.php). ';
            $hint .= 'Pour un diagnostic rapide, ouvrez db-check.php dans le navigateur.';
            $this->sendError('Impossible de se connecter à la base de données. ' . $hint, 500);
        }
    }
    
    /**
     * Retourne la connexion PDO
     */
    public function getConnection(): PDO {
        if ($this->conn === null) {
            $this->connect();
        }
        return $this->conn;
    }
    
    /**
     * Prépare et exécute une requête
     */
    public function execute(string $sql, array $params = []): PDOStatement {
        $stmt = $this->getConnection()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }
    
    /**
     * Récupère une ligne
     */
    public function fetchOne(string $sql, array $params = []): ?array {
        $stmt = $this->execute($sql, $params);
        $result = $stmt->fetch();
        return $result ?: null;
    }
    
    /**
     * Récupère toutes les lignes
     */
    public function fetchAll(string $sql, array $params = []): array {
        $stmt = $this->execute($sql, $params);
        return $stmt->fetchAll();
    }
    
    /**
     * Insère et retourne l'ID
     */
    public function insert(string $sql, array $params = []): int {
        $this->execute($sql, $params);
        return (int)$this->getConnection()->lastInsertId();
    }
    
    /**
     * Envoie une réponse JSON d'erreur
     */
    public function sendError(string $message, int $code = 400): void {
        http_response_code($code);
        echo json_encode(['success' => false, 'message' => $message]);
        exit();
    }
    
    /**
     * Envoie une réponse JSON de succès
     */
    public function sendSuccess(array $data = [], string $message = 'Succès'): void {
        echo json_encode(['success' => true, 'message' => $message, ...$data]);
        exit();
    }
}