-- Run this once on your existing database to add attendance + holidays
USE abacus_db;

CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  att_date DATE NOT NULL,
  status ENUM('present','absent') NOT NULL,
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_att (student_id, att_date),
  KEY idx_att_date (att_date),
  CONSTRAINT fk_att_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- A holiday applies to every student and every batch
CREATE TABLE IF NOT EXISTS holidays (
  holiday_date DATE NOT NULL PRIMARY KEY,
  reason VARCHAR(150) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
