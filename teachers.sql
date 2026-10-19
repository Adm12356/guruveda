-- Run ONCE on your existing database (after attendance.sql).
-- Adds teacher accounts: every batch, student, exam and holiday now belongs to one admin account.
USE abacus_db;
SET SQL_SAFE_UPDATES = 0; -- Workbench safe-update mode blocks UPDATEs without a key; off for this session only

ALTER TABLE admins
  ADD COLUMN name VARCHAR(100) NULL,
  ADD COLUMN role ENUM('owner','teacher') NOT NULL DEFAULT 'teacher',
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

-- Your first (oldest) admin account becomes the owner / main person of the institute
UPDATE admins SET role = 'owner' WHERE id = (SELECT m FROM (SELECT MIN(id) AS m FROM admins) x);
UPDATE admins SET name = username WHERE name IS NULL;

SET @owner = (SELECT id FROM admins WHERE role = 'owner' ORDER BY id LIMIT 1);

-- Everything that exists today is assigned to the owner
ALTER TABLE batches  ADD COLUMN admin_id INT NULL, ADD KEY idx_batches_admin (admin_id);
ALTER TABLE students ADD COLUMN admin_id INT NULL, ADD KEY idx_students_admin (admin_id);
ALTER TABLE exams    ADD COLUMN admin_id INT NULL, ADD KEY idx_exams_admin (admin_id);
UPDATE batches  SET admin_id = @owner;
UPDATE students SET admin_id = @owner;
UPDATE exams    SET admin_id = @owner;
ALTER TABLE batches  MODIFY admin_id INT NOT NULL, ADD CONSTRAINT fk_batches_admin  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE RESTRICT;
ALTER TABLE students MODIFY admin_id INT NOT NULL, ADD CONSTRAINT fk_students_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE RESTRICT;
ALTER TABLE exams    MODIFY admin_id INT NOT NULL, ADD CONSTRAINT fk_exams_admin    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE RESTRICT;

-- Holidays become per-teacher (each teacher's own students). Existing holidays are copied to every account.
CREATE TABLE holidays_v2 (
  admin_id INT NOT NULL,
  holiday_date DATE NOT NULL,
  reason VARCHAR(150) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_id, holiday_date),
  CONSTRAINT fk_holidays_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);
INSERT INTO holidays_v2 (admin_id, holiday_date, reason)
  SELECT a.id, h.holiday_date, h.reason FROM holidays h CROSS JOIN admins a;
DROP TABLE holidays;
RENAME TABLE holidays_v2 TO holidays;

SET SQL_SAFE_UPDATES = 1;
