-- Comptes médecins fixes. Mot de passe initial : password (hash bcrypt Laravel de démo).
-- Exécutez après migration_user_roles_medecin.sql si besoin.

USE cabinet_dentaire;

INSERT INTO users (nom, prenom, civilite, date_naissance, email, telephone, password, role, newsletter)
SELECT 'Trabelsi Bougatef', 'Ilhem', 'Mme', '1975-06-01', 'dr.ilhem.trabelsi@cabinetbougatef.com', '70000001',
       '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'medecin', 0
FROM (SELECT 1 AS x) AS dummy
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'dr.ilhem.trabelsi@cabinetbougatef.com');

INSERT INTO users (nom, prenom, civilite, date_naissance, email, telephone, password, role, newsletter)
SELECT 'Bougatef', 'Mohamed Chakib', 'M', '1973-04-10', 'dr.chakib.bougatef@cabinetbougatef.com', '70000002',
       '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'medecin', 0
FROM (SELECT 1 AS x) AS dummy
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'dr.chakib.bougatef@cabinetbougatef.com');
