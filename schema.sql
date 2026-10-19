-- Fresh install. (Existing database? Run attendance.sql and teachers.sql instead.)
CREATE DATABASE IF NOT EXISTS abacus_db CHARACTER SET utf8mb4;
USE abacus_db;

-- Admin accounts. 'owner' = main person of the institute, 'teacher' = everyone else.
-- Create the owner with: npm run create-admin -- yourname yourpassword "Your Name"
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  name VARCHAR(100) NULL,
  role ENUM('owner','teacher') NOT NULL DEFAULT 'teacher',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  event_date DATETIME NOT NULL,
  location VARCHAR(150),
  image VARCHAR(200) NULL,          -- e.g. 'annual-day.jpg' inside public/images/events/
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  level VARCHAR(60) NOT NULL,
  age_group VARCHAR(40) NOT NULL,
  days VARCHAR(60) NOT NULL,
  timing VARCHAR(60) NOT NULL,
  mode VARCHAR(30) NOT NULL DEFAULT 'Offline',
  seats_left INT NOT NULL DEFAULT 0,
  fee VARCHAR(40) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  KEY idx_batches_admin (admin_id),
  CONSTRAINT fk_batches_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(120) NULL,
  batch_interest VARCHAR(100) NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample events (replace with your real details). Add batches from the admin panel.
INSERT INTO events (title, description, event_date, location) VALUES
('Inter-School Abacus Championship', 'Students compete in speed and accuracy rounds across three age categories.', DATE_ADD(NOW(), INTERVAL 21 DAY), 'Community Hall, Andheri'),
('Parent Orientation Workshop', 'See how abacus training builds focus and mental maths, and meet our trainers.', DATE_ADD(NOW(), INTERVAL 45 DAY), 'Main Centre'),
('Annual Day & Prize Distribution', 'Certificates, trophies and a showcase by our top performers.', DATE_SUB(NOW(), INTERVAL 60 DAY), 'Town Auditorium'),
('Summer Mental Maths Camp', 'A two-week camp of games, flash cards and timed challenges.', DATE_SUB(NOW(), INTERVAL 150 DAY), 'Main Centre');

-- Students and exams (each belongs to the teacher who created it)
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  batch_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_students_admin (admin_id),
  CONSTRAINT fk_students_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE RESTRICT,
  CONSTRAINT fk_students_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS exams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NULL,
  batch_id INT NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  pass_percent INT NOT NULL DEFAULT 40,
  show_answers TINYINT(1) NOT NULL DEFAULT 1,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_exams_admin (admin_id),
  CONSTRAINT fk_exams_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE RESTRICT,
  CONSTRAINT fk_exams_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  question_text TEXT NOT NULL,
  option_a VARCHAR(255) NOT NULL,
  option_b VARCHAR(255) NOT NULL,
  option_c VARCHAR(255) NOT NULL,
  option_d VARCHAR(255) NOT NULL,
  correct_option CHAR(1) NOT NULL,
  marks INT NOT NULL DEFAULT 1,
  CONSTRAINT fk_questions_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  started_at DATETIME NOT NULL,
  submitted_at DATETIME NULL,
  score INT NULL,
  total_marks INT NULL,
  status ENUM('in_progress','submitted','auto_submitted') NOT NULL DEFAULT 'in_progress',
  UNIQUE KEY uq_attempt (exam_id, student_id),
  CONSTRAINT fk_attempt_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attempt_answers (
  attempt_id INT NOT NULL,
  question_id INT NOT NULL,
  selected_option CHAR(1) NULL,
  PRIMARY KEY (attempt_id, question_id),
  CONSTRAINT fk_ans_attempt FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_ans_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Attendance
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

-- A holiday applies to all students of one teacher (the owner can mark it for every teacher at once)
CREATE TABLE IF NOT EXISTS holidays (
  admin_id INT NOT NULL,
  holiday_date DATE NOT NULL,
  reason VARCHAR(150) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_id, holiday_date),
  CONSTRAINT fk_holidays_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);
