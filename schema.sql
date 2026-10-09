CREATE DATABASE IF NOT EXISTS abacus_db CHARACTER SET utf8mb4;
USE abacus_db;

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
  name VARCHAR(100) NOT NULL,
  level VARCHAR(60) NOT NULL,
  age_group VARCHAR(40) NOT NULL,
  days VARCHAR(60) NOT NULL,
  timing VARCHAR(60) NOT NULL,
  mode VARCHAR(30) NOT NULL DEFAULT 'Offline',
  seats_left INT NOT NULL DEFAULT 0,
  fee VARCHAR(40) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(120) NULL,
  batch_interest VARCHAR(100) NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample data (replace with your real details)
INSERT INTO events (title, description, event_date, location) VALUES
('Inter-School Abacus Championship', 'Students compete in speed and accuracy rounds across three age categories.', DATE_ADD(NOW(), INTERVAL 21 DAY), 'Community Hall, Andheri'),
('Parent Orientation Workshop', 'See how abacus training builds focus and mental maths, and meet our trainers.', DATE_ADD(NOW(), INTERVAL 45 DAY), 'Main Centre'),
('Annual Day & Prize Distribution', 'Certificates, trophies and a showcase by our top performers.', DATE_SUB(NOW(), INTERVAL 60 DAY), 'Town Auditorium'),
('Summer Mental Maths Camp', 'A two-week camp of games, flash cards and timed challenges.', DATE_SUB(NOW(), INTERVAL 150 DAY), 'Main Centre');

INSERT INTO batches (name, level, age_group, days, timing, mode, seats_left, fee) VALUES
('Little Beads', 'Level 1-2 (Beginner)', '5-7 years', 'Mon, Wed, Fri', '4:00 PM - 5:00 PM', 'Offline', 6, NULL),
('Bead Masters', 'Level 3-5 (Intermediate)', '8-10 years', 'Tue, Thu, Sat', '5:00 PM - 6:00 PM', 'Offline', 3, NULL),
('Mind Sprinters', 'Level 6-8 (Advanced)', '11-14 years', 'Sat, Sun', '10:00 AM - 12:00 PM', 'Offline', 8, NULL),
('Online Starters', 'Level 1-3 (Beginner)', '6-10 years', 'Mon, Wed, Fri', '6:30 PM - 7:30 PM', 'Online', 10, NULL);

-- Admin accounts (create one with: npm run create-admin -- yourname yourpassword)
  CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

-- Students and exams
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  batch_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_students_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL
);

CREATE TABLE exams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT NULL,
  batch_id INT NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  pass_percent INT NOT NULL DEFAULT 40,
  show_answers TINYINT(1) NOT NULL DEFAULT 1,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_exams_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT
);

CREATE TABLE IF questions (
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
