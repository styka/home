-- phpMyAdmin SQL Dump
-- version 4.0.10.12
-- http://www.phpmyadmin.net
--
-- Host: 127.2.173.130:3306
-- Generation Time: Jul 30, 2017 at 11:54 AM
-- Server version: 5.5.52
-- PHP Version: 5.3.3

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;

--
-- Database: `home`
--

-- --------------------------------------------------------

--
-- Table structure for table `person`
--

CREATE TABLE IF NOT EXISTS `person` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `last_name` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Table structure for table `task`
--

CREATE TABLE IF NOT EXISTS `task` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `asia_time` decimal(19,2) DEFAULT NULL,
  `date` datetime DEFAULT NULL,
  `description` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `status` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `szymon_time` decimal(19,2) DEFAULT NULL,
  `title` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci AUTO_INCREMENT=16 ;

--
-- Dumping data for table `task`
--

INSERT INTO `task` (`id`, `asia_time`, `date`, `description`, `status`, `szymon_time`, `title`, `user_id`) VALUES
(1, NULL, '2017-07-08 18:00:00', NULL, NULL, NULL, 'żąśdfsdfźźź', NULL),
(2, '0.00', NULL, NULL, 'DRAFT', '0.00', 'ążźś', NULL),
(3, NULL, '2017-07-08 18:00:00', NULL, 'PATTERN', NULL, 'Nowa treść', NULL),
(4, NULL, '2017-07-09 18:00:00', NULL, 'DONE', '1.00', 'Angielski', NULL),
(5, NULL, '2017-07-11 18:00:00', NULL, 'WAITING', NULL, 'Kupić fryzjerski fartuch', NULL),
(6, NULL, '2017-07-11 18:00:00', NULL, 'DONE', NULL, 'Kupić wkładki do butów', NULL),
(7, NULL, '2017-07-12 18:00:00', NULL, 'NOT_DONE', NULL, 'Ultradźwięki', NULL),
(8, NULL, '2017-07-12 18:00:00', NULL, 'WAITING', NULL, 'Stuningować pojemnik na sztućce', NULL),
(9, NULL, '2017-08-04 18:00:00', NULL, 'WAITING', NULL, 'biuro rachunkowe faktury i opłata, orange opłata', NULL),
(10, NULL, '2017-08-13 18:00:00', NULL, 'WAITING', NULL, 'PIT opłata', NULL),
(11, NULL, '2017-08-04 18:00:00', NULL, 'WAITING', NULL, 'Sprawdzić status wykonania przelewów stałych', NULL),
(12, NULL, '2017-07-27 18:00:00', 'Uroforce', 'WAITING', NULL, 'Kupić Joyowi tabsy', NULL),
(13, NULL, '2017-07-26 18:00:00', 'chyba na 8 rano', 'DONE', NULL, 'Joy - badanie krwi i USG wątroby', NULL),
(14, NULL, '2017-07-24 18:00:00', NULL, 'WAITING', NULL, 'Domek w górach znaleźć', NULL),
(15, NULL, '2017-07-27 18:00:00', NULL, 'WAITING', NULL, 'Joy - zadzwonić po wyniki z krwi około 17nastej', NULL);

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
