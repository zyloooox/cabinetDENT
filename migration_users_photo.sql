-- Exécuter une fois dans phpMyAdmin (onglet SQL). Si la colonne existe déjà, ignorez l'erreur « Duplicate column ».
USE cabinet_dentaire;
ALTER TABLE users ADD COLUMN photo_url VARCHAR(500) NULL AFTER newsletter;
