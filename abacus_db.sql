-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: abacus_db
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` VALUES (1,'root@gmail.com','$2a$10$4/yiKUv1QcOIN/tbNXcpm.6OoqFDBcrXwRJ7o9yDNSAzRG5OxgaSK','2026-10-09 05:15:29','root@gmail.com','owner',1);
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `attempt_answers`
--

LOCK TABLES `attempt_answers` WRITE;
/*!40000 ALTER TABLE `attempt_answers` DISABLE KEYS */;
/*!40000 ALTER TABLE `attempt_answers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
INSERT INTO `attendance` VALUES (1,1,'2026-10-19','present','2026-10-19 06:32:55');
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `batches`
--

LOCK TABLES `batches` WRITE;
/*!40000 ALTER TABLE `batches` DISABLE KEYS */;
INSERT INTO `batches` VALUES (1,'Little Beads','Level 1-2 (Beginner)','5-7 years','Mon, Wed, Fri','4:00 PM - 5:00 PM','Offline',6,NULL,1,1),(2,'Bead Masters','Level 3-5 (Intermediate)','8-10 years','Tue, Thu, Sat','5:00 PM - 6:00 PM','Offline',3,NULL,1,1),(3,'Mind Sprinters','Level 6-8 (Advanced)','11-14 years','Sat, Sun','10:00 AM - 12:00 PM','Offline',8,NULL,1,1),(4,'Online Starters','Level 1-3 (Beginner)','6-10 years','Mon, Wed, Fri','6:30 PM - 7:30 PM','Online',10,NULL,1,1);
/*!40000 ALTER TABLE `batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `branches`
--

LOCK TABLES `branches` WRITE;
/*!40000 ALTER TABLE `branches` DISABLE KEYS */;
INSERT INTO `branches` VALUES (1,'main','Chinchwad','Head Office – Pune Region',1),(2,'main','Dombivli','Head Office – Mumbai Region',2),(3,'franchise','Alandi, Pune',NULL,1),(4,'franchise','Magarpatta City, Pune',NULL,2),(5,'franchise','Vashi, Navi Mumbai',NULL,3),(6,'franchise','Belapur, Navi Mumbai',NULL,4),(7,'franchise','Palghar',NULL,5),(8,'franchise','Kalyan',NULL,6),(9,'franchise','Solapur',NULL,7),(10,'franchise','Chalisgaon',NULL,8);
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `contact_messages`
--

LOCK TABLES `contact_messages` WRITE;
/*!40000 ALTER TABLE `contact_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `contact_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `events`
--

LOCK TABLES `events` WRITE;
/*!40000 ALTER TABLE `events` DISABLE KEYS */;
INSERT INTO `events` VALUES (1,'Inter-School Abacus Championship','Students compete in speed and accuracy rounds across three age categories.','2026-10-30 10:34:31','Community Hall, Andheri',NULL,'2026-10-09 05:04:31'),(2,'Parent Orientation Workshop','See how abacus training builds focus and mental maths, and meet our trainers.','2026-11-23 10:34:31','Main Centre',NULL,'2026-10-09 05:04:31'),(3,'Annual Day & Prize Distribution','Certificates, trophies and a showcase by our top performers.','2026-08-10 10:34:31','Town Auditorium',NULL,'2026-10-09 05:04:31'),(4,'Summer Mental Maths Camp','A two-week camp of games, flash cards and timed challenges.','2026-05-12 10:34:31','Main Centre',NULL,'2026-10-09 05:04:31');
/*!40000 ALTER TABLE `events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `exam_attempts`
--

LOCK TABLES `exam_attempts` WRITE;
/*!40000 ALTER TABLE `exam_attempts` DISABLE KEYS */;
/*!40000 ALTER TABLE `exam_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `exams`
--

LOCK TABLES `exams` WRITE;
/*!40000 ALTER TABLE `exams` DISABLE KEYS */;
/*!40000 ALTER TABLE `exams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `holidays`
--

LOCK TABLES `holidays` WRITE;
/*!40000 ALTER TABLE `holidays` DISABLE KEYS */;
/*!40000 ALTER TABLE `holidays` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `questions`
--

LOCK TABLES `questions` WRITE;
/*!40000 ALTER TABLE `questions` DISABLE KEYS */;
/*!40000 ALTER TABLE `questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES ('q-2bHBO83brbPu6M15wyla-dMX-XTd6l','{\"cookie\":{\"originalMaxAge\":7200000,\"expires\":\"2026-10-21T10:49:43.580Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"admin\":{\"id\":1,\"username\":\"root@gmail.com\"},\"csrf\":\"c648bcc211a1f7944f84e1a3cb5bad659520f9301bf2b1e1\"}',1792579792051);
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `students`
--

LOCK TABLES `students` WRITE;
/*!40000 ALTER TABLE `students` DISABLE KEYS */;
INSERT INTO `students` VALUES (1,'Root Student','root@gmail.com','$2a$10$4/yiKUv1QcOIN/tbNXcpm.6OoqFDBcrXwRJ7o9yDNSAzRG5OxgaSK',1,1,'2026-10-09 05:15:42',1);
/*!40000 ALTER TABLE `students` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-22 13:36:46
