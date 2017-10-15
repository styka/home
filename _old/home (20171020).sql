-- phpMyAdmin SQL Dump
-- version 4.0.10.12
-- http://www.phpmyadmin.net
--
-- Host: 127.2.173.130:3306
-- Generation Time: Oct 02, 2017 at 11:35 AM
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
-- Table structure for table `activity`
--

CREATE TABLE IF NOT EXISTS `activity` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `asia_time` decimal(19,2) DEFAULT NULL,
  `date` datetime DEFAULT NULL,
  `description` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `status` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `szymon_time` decimal(19,2) DEFAULT NULL,
  `title` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci AUTO_INCREMENT=74 ;

--
-- Dumping data for table `activity`
--

INSERT INTO `activity` (`id`, `asia_time`, `date`, `description`, `status`, `szymon_time`, `title`, `user_id`) VALUES
(1, NULL, '2017-07-08 18:00:00', NULL, 'PATTERN', NULL, 'żąśdfsdfźźź', NULL),
(2, '0.00', NULL, NULL, 'DRAFT', '0.00', 'ążźś', NULL),
(3, NULL, '2017-07-08 18:00:00', NULL, 'PATTERN', NULL, 'Nowa treść', NULL),
(4, NULL, '2017-10-01 18:00:00', 'Co poniedziałek o 17nastej', 'WAITING', '1.00', 'Angielski', NULL),
(5, NULL, '2017-08-27 18:00:00', NULL, 'DONE', '0.50', 'Oczekiwać na fryzjerski fartuch', NULL),
(6, NULL, '2017-07-11 18:00:00', NULL, 'DONE', NULL, 'Kupić wkładki do butów', NULL),
(7, NULL, '2017-07-12 18:00:00', NULL, 'NOT_DONE', NULL, 'Ultradźwięki', NULL),
(8, NULL, '2017-08-20 18:00:00', 'żeby się sam nie składał', 'DONE', '1.50', 'Stuningować pojemnik na sztućce', NULL),
(9, NULL, '2017-10-04 18:00:00', '5 dnia miesiąca', 'WAITING', NULL, 'biuro rachunkowe faktury i opłata, orange opłata', NULL),
(10, NULL, '2017-10-13 18:00:00', '14 dnia miesiąca', 'WAITING', NULL, 'PIT opłata', NULL),
(11, NULL, '2017-10-04 18:00:00', '5 dnia miesiąca; bm.1: parking; pm.21: czynsz, internet', 'WAITING', '0.50', 'Sprawdzić status wykonania przelewów stałych', NULL),
(12, NULL, '2017-10-19 18:00:00', '20 dnia miesiąca; Uroforce x?/6, L-Methiocid x?/2, Fortyron x?/12 NaBóle x?/2, Fatrocartila 250ml x?/1,5', 'WAITING', '1.00', 'Kupić Joyowi leki w SmartVet', NULL),
(13, NULL, '2017-07-26 18:00:00', 'chyba na 8 rano', 'DONE', NULL, 'Joy - badanie krwi i USG wątroby', NULL),
(14, NULL, '2017-10-30 19:00:00', '31 wieczór do 5 po południu', 'WAITING', NULL, 'Zwardoń Domek', NULL),
(15, NULL, '2017-07-27 18:00:00', NULL, 'DONE', NULL, 'Joy - zadzwonić po wyniki z krwi około 17nastej', NULL),
(16, NULL, '2017-09-18 18:00:00', 'Potrzebne RTG do 17nastej i badanie krwiþ', 'WAITING', '0.50', 'Umówić ortopede', NULL),
(17, NULL, '2017-10-25 18:00:00', NULL, 'WAITING', '0.50', 'Kupić Joyowi karmę', NULL),
(18, NULL, '2017-08-02 16:18:42', NULL, 'DONE', '0.50', 'Wymienić filtr do wody', NULL),
(19, NULL, '2017-09-19 18:00:00', 'co środę', 'WAITING', '1.00', 'Wyczesać joya', NULL),
(20, NULL, '2018-09-22 18:00:00', NULL, 'WAITING', NULL, '71 taty', NULL),
(21, NULL, '2017-09-30 18:00:00', 'sturtup', 'WAITING', NULL, 'Ter kos do spa', NULL),
(22, NULL, '2017-09-30 18:00:00', 'sturtup', 'WAITING', NULL, 'Kół do wóz', NULL),
(23, NULL, '2017-09-30 18:00:00', 'sturtup', 'WAITING', NULL, 'Masz do joi', NULL),
(24, NULL, '2017-09-14 18:00:00', NULL, 'DONE', NULL, 'Mamomam Jura', NULL),
(25, NULL, '2017-09-01 18:00:00', NULL, 'DONE', NULL, 'Olek ślub', NULL),
(26, NULL, '2017-08-24 18:00:00', NULL, 'DONE', NULL, 'Odebrać wkładki', NULL),
(27, NULL, '2017-09-29 18:00:00', 'Zweryfikować zlecenie i sprawdzić czy poszła płatność', 'WAITING', NULL, 'Polecenie zapłaty z Orange', NULL),
(28, NULL, '2017-09-25 18:00:00', NULL, 'WAITING', NULL, 'Polecenie zapłaty Tauron i inna umowa?', NULL),
(29, NULL, '2017-10-01 18:00:00', 'co poniedziałek sprawdzić czy jest co składać i poskładać', 'WAITING', NULL, 'Składanie ubrań', NULL),
(30, NULL, '2018-08-23 18:00:00', 'Równo za rok', 'WAITING', NULL, 'Szczepienie Joya na wściekliznę', NULL),
(31, NULL, '2017-10-19 18:00:00', '20 dnia miesiąca', 'WAITING', NULL, 'Szacowanie kosztów na kolejny miesiąc', NULL),
(32, NULL, '2017-09-29 18:00:00', 'W każdy pn śr i so', 'WAITING', NULL, 'Poodkładać rzeczy na miejsca', NULL),
(33, NULL, '2017-10-13 18:00:00', 'Co drugą sobotę', 'WAITING', NULL, 'Wytrzeć kurze w mieszkaniu z przetarciem drzwi', NULL),
(34, NULL, '2017-12-16 18:00:00', 'Co 4 miesiące', 'WAITING', NULL, 'Wyczyścić szafkę ze śmieciami', NULL),
(35, NULL, '2017-10-06 18:00:00', 'Co sobotę', 'WAITING', NULL, 'Odkurzanie', NULL),
(36, NULL, '2017-10-06 18:00:00', 'Co sobotę', 'WAITING', NULL, 'Mycie podłóg', NULL),
(37, NULL, '2017-10-19 18:00:00', '20 dnia miesiąca', 'WAITING', NULL, 'Wytrzeć Shishe', NULL),
(38, NULL, '2017-10-19 18:00:00', '20 dnia miesiąca; za bm', 'WAITING', NULL, 'ZUS opłata', NULL),
(39, NULL, '2017-10-04 18:00:00', '5 dnia nieparzystego miesiąca', 'WAITING', NULL, 'Odczyt prądu', NULL),
(40, NULL, '2017-10-19 18:00:00', '20 dnia miesiąca', 'WAITING', NULL, 'Przelew za fakturę z 7N', NULL),
(41, NULL, '2017-10-19 18:00:00', '20 dnia miesiąca', 'WAITING', NULL, 'VAT opłata', NULL),
(42, NULL, '2017-10-19 18:00:00', '20 dnia nieparzystego miesiąca', 'WAITING', NULL, 'Prąd opłata', NULL),
(43, NULL, '2017-09-19 18:00:00', '20 dnia miesiąca, Maść ochronna z witaminą A × ?, BioPrazol x ?, SlowMag B6 x ?', 'WAITING', NULL, 'Kupić Joyowi leki w Aptece', NULL),
(44, NULL, '2018-09-14 18:00:00', 'Co rok od zrobienia;', 'WAITING', NULL, 'Joy szczepienia na zakaźne + tabletki na odrobaczanie', NULL),
(45, NULL, '2017-09-17 18:00:00', NULL, 'WAITING', NULL, 'Zrobić filtry na gmailu i posprzątać skrzynkę', NULL),
(46, NULL, '2017-08-26 06:32:39', 'Kuszula x 2, C&A', 'DONE', NULL, 'Zakupy SCC pasaż', NULL),
(47, NULL, '2017-10-10 18:00:00', 'Co dwa tygodnie', 'WAITING', NULL, 'Zakupy Tesco Online', NULL),
(48, NULL, '2017-10-28 18:00:00', 'co miesiąc', 'WAITING', NULL, 'Podać Joyowi Trocoxil', NULL),
(49, NULL, '2017-09-29 18:00:00', NULL, 'WAITING', NULL, 'Kupić okulary', NULL),
(50, NULL, '2017-09-30 18:00:00', NULL, 'WAITING', NULL, 'Kupić nowe okulary + przeciw sloneczne', NULL),
(51, NULL, '2017-08-30 09:07:59', NULL, 'DONE', NULL, 'Przygotować gift na wesele Olka&Judyt', NULL),
(52, NULL, '2018-02-28 18:00:00', 'co jakiś czas; sprawdzić czy jest i zamówić jak nie ma', 'WAITING', NULL, 'Miód', NULL),
(53, NULL, '2018-08-31 18:00:00', 'Ogarnąć', 'WAITING', NULL, 'Prezent na 71 lat taty', NULL),
(54, NULL, '2017-09-04 18:00:00', ':) cosik', 'DRAFT', NULL, 'Asia urodziny 17nastego', NULL),
(55, NULL, '2017-09-04 18:00:00', ':) cosik', 'DRAFT', NULL, 'Asia urodziny 17nastego', NULL),
(56, NULL, '2017-09-04 18:00:00', ':) cosik', 'DRAFT', NULL, 'Asia urodziny 17nastego', NULL),
(57, NULL, '2018-09-16 18:00:00', 'co rok 17 września', 'WAITING', NULL, 'Asia urodziny', NULL),
(58, NULL, '2017-09-04 18:00:00', 'cosik :)', 'DRAFT', NULL, 'Asia urodziny', NULL),
(59, NULL, '2017-09-18 18:00:00', 'Lakier i skrzypienie i centr zamek', 'WAITING', NULL, 'Auto', NULL),
(60, NULL, '2017-12-09 18:00:00', 'auto + dom? + na życie?', 'WAITING', NULL, 'Ubezpieczenie', NULL),
(61, NULL, '2018-01-13 18:00:00', 'termin: 02.02.2018', 'WAITING', NULL, 'Auto serwis + przegląd', NULL),
(62, NULL, '2017-09-04 18:00:00', 'Zrobić i sprawdzić przelewy', 'DONE', NULL, 'Trasa do Akiko', NULL),
(63, NULL, '2017-10-30 19:00:00', 'W ostatni dzień roboczy miesiąca', 'WAITING', NULL, 'Wystawić fakturę', NULL),
(64, NULL, '2017-09-18 18:00:00', 'Zrobić ewentualne wnioski o przeksięgowania', 'WAITING', NULL, 'PIT, VAT i ZUS - sprawdzić tytuły i daty przelewów wykonanych', NULL),
(65, NULL, '2017-09-29 18:00:00', NULL, 'WAITING', NULL, 'Znaleźć Asi książkę informatyczną', NULL),
(66, NULL, '2017-09-19 18:00:00', NULL, 'WAITING', NULL, 'Wyrzucić tv i to do stóp', NULL),
(67, NULL, '2018-04-30 18:00:00', NULL, 'WAITING', NULL, 'Zabrze ogród botaniczny', NULL),
(68, NULL, '2017-09-30 18:00:00', ':-D', 'WAITING', NULL, 'Uchwyt na kom do łóź', NULL),
(69, NULL, '2017-09-17 09:55:08', NULL, 'WAITING', NULL, 'Kupić baterię do tel.', NULL),
(70, NULL, '2017-09-29 18:00:00', 'Zdecydować co z magneto i laseroterapią', 'WAITING', NULL, 'Joy weterynarz', NULL),
(71, NULL, '2017-10-01 18:00:00', 'co 2 tygodnie', 'WAITING', NULL, 'Zakupy Simply', NULL),
(72, NULL, '2017-09-24 15:46:23', 'Wpisać najlepsze drony do 300 zł', 'WAITING', NULL, 'Kupić drona', NULL),
(73, NULL, '2018-09-28 18:00:00', 'Co rok', 'WAITING', NULL, 'Podać Joyowi leki na odrobaczanie', NULL);

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

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
