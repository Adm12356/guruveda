-- RESUME: run this ONLY if teachers.sql stopped at 'UPDATE admins SET name = username WHERE name IS NULL'
-- (the admins columns and the owner role were already added by the first run).
USE abacus_db;
SET SQL_SAFE_UPDATES = 0;

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
