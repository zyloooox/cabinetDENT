<?php
/**
 * Copiez ce fichier en db-config.php puis adaptez vos paramètres
 * si votre MySQL n'est pas root / mot de passe vide.
 *
 * Commande (PowerShell) depuis ce dossier :
 *   Copy-Item db-config.example.php db-config.php
 */
return [
    'host'     => '127.0.0.1',
    'database' => 'cabinet_dentaire',
    'username' => 'root',
    'password' => '',
    'charset'  => 'utf8mb4',
    // 'port' => 3306,  // décommentez si MySQL n’écoute pas sur le port par défaut
];
