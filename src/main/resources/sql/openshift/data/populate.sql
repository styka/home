--users
insert into person(first_name, last_name) values('Szymon','Tyka');
insert into person(first_name, last_name) values('Joanna','Borowska');

--tasks
insert into task(title, description, asia_time, szymon_time, status, date) values('Kupić doniczki', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('Asia do dentysty', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('Wybrać i kupić dywany', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('Asia - prawo jazdy', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('Ogólnie posprzątać łazienkę', 'wanna, umywalka, prysznic', 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('Asia okulary', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('sprzedać zderzak', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('remament w piwnicy', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('przystosować balkon do pracy', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('Asia Hobby - chodzenie po górach', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('wyczesanie Joya', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('Asia Hobby - czytanie książek', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('Zmienić umowę z Tauron i zrobić polecenie zapłaty', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('Załątwić ZUS (przelewy tytuł)', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('sprawdzić status kredytu', null, 0, 0, 'DRAFT', null);
insert into task(title, description, asia_time, szymon_time, status, date) values('praca z dojazdami', null, 8.5, 7.5, 'DONE', str_to_date('2017-07-05', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Kolacja zrobić', null, 0, 0, 'WAITING', str_to_date('2017-07-05', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Kolacja zjeść i posprzątać', null, 0, 0, 'WAITING', str_to_date('2017-07-05', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Spacer z joyem', '6:30, 11:30, 15:30, 20:00, 23:30', 0.25, 0.5, 'WAITING', str_to_date('2017-07-05', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Stopa', 'sprej 1', 0, 0.25, 'WAITING', str_to_date('2017-07-05', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Planowanie', null, 0, 0.25, 'WAITING', str_to_date('2017-07-05', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('domowe zabawy z psem', null, 0, 0, 'WAITING', str_to_date('2017-07-05', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Stopa', 'moczenie w soli', 0, 0, 'WAITING', str_to_date('2017-07-05', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Lunch', null, 0.5, 0, 'WAITING', str_to_date('2017-07-05', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('ścielenie łóżka po wstaniu', null, 0, 0, 'WAITING', str_to_date('2017-07-05', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Śniadanie', null, 0, 0, 'WAITING', str_to_date('2017-07-05', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Asia - gimnastyka', null, 0, 0, 'WAITING', str_to_date('2017-07-05', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Szymon - nauka', null, 0, 0, 'WAITING', str_to_date('2017-07-05', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('praca z dojazdami', null, 8.5, 6.5, 'DONE', str_to_date('2017-07-06', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Wytrzeć kurze w mieszkaniu', 'z ogolnym posprzataniem (mało), ze starciem kurzy na frontach', 0, 2, 'DONE', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Kolacja zrobić', null, 0.5, 0.25, 'DONE', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Kolacja zjeść i posprzątać', null, 0.25, 0.25, 'DONE', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Spacer z joyem', '6:30, 11:30, 15:30, 20:00, 23:30', 0.75, 0.75, 'DONE', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Stopa', 'sprej 1', 0, 0.25, 'WAITING', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Planowanie', null, 0.25, 0.5, 'WAITING', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('domowe zabawy z psem', null, 0.25, 0, 'WAITING', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Stopa', 'moczenie w soli', 0, 0, 'WAITING', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Lunch', null, 0.5, 0.5, 'DONE', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('ścielenie łóżka po wstaniu', null, 0, 0, 'DONE', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Śniadanie', null, 0.25, 0, 'DONE', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Asia - gimnastyka', null, 0, 0, 'WAITING', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Szymon - nauka', null, 0, 1.5, 'DONE', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Odkurzanie', null, 0.5, 0, 'DONE', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Umycie podłogi', null, 0.5, 0, 'DONE', str_to_date('2017-07-04', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('praca z dojazdami', null, 8.5, 8.5, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Wytrzeć kurze w mieszkaniu', null, 0, 0, 'WAITING', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Kolacja zrobić', null, 0, 0, 'WAITING', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Kolacja zjeść i posprzątać', null, 0, 0, 'WAITING', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Spacer z joyem', '6:30, 11:30, 15:30, 20:00, 23:30', 1, 0.5, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Stopa', 'sprej 3', 0, 0.75, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Planowanie', null, 0.25, 0.75, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('domowe zabawy z psem', null, 0.25, 0.25, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Zrobić obiad', null, 0, 0.5, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Stopa', 'moczenie w soli', 0, 0, 'WAITING', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Jedzenie obiadu i posprzątanie', null, 0, 0.75, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Lunch', null, 0.5, 0, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Zanieść faktury do biura rachunkowego', null, 0, 0.25, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('ścielenie łóżka po wstaniu', null, 0, 0, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('rozpakowywanie zakupów', null, 0.25, 0.25, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Śniadanie', null, 0.25, 0, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Asia-lekarz', null, 1.5, 0, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Asia-apteka', null, 0.25, 0, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Ściągnięcie ubrań i poskładanie', null, 0, 1, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Asia - gimnastyka', null, 0.5, 0, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Pranie i wieszanie', null, 0.5, 0, 'DONE', str_to_date('2017-07-03', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Suszarka - czyszczenie', null, 0, 0.5, 'DONE', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Pojechać do Rafała', null, 0, 0.75, 'DONE', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Filtr do wody wymienić', null, 0.5, 0, 'DONE', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Filtr do okapu wymienić', null, 0, 0.25, 'DONE', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Wytrzeć kurze w mieszkaniu', null, 0, 0, 'WAITING', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Kolacja zrobić', null, 0.25, 0, 'DONE', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Kolacja zjeść i posprzątać', null, 0.5, 0.5, 'DONE', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Spacer z joyem', '7, 12, 16, 20, 24', 1.25, 0.75, 'DONE', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Zrobić i zjeść śnieadanie', null, 0.5, 0, 'DONE', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Stopa', 'sprej', 0, 0, 'WAITING', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Planowanie', null, 0.5, 1, 'DONE', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Zapakowanie zmywarki', null, 0.25, 0.25, 'DONE', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('domowe zabawy z psem', null, 0.25, 0.25, 'DONE', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Asia nauka', 'c# selenium PageObject', 2, 1, 'DONE', str_to_date('2017-07-02', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Zakupy Tesco', null, 1, 0, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Kupić naklejki na przyprawy', null, 0.5, 0, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Kupić toner do drukarki', null, 0, 0.5, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Opłaty, bilans, faktury, teczki', null, 0, 3.5, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Pranie powiesić puścić i powiesić', null, 0.5, 0, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Filtr do wody wymienić', null, 0, 0, 'WAITING', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Filtr do okapu wymienić', null, 0, 0, 'WAITING', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Wytrzeć kurze w mieszkaniu', null, 0, 0, 'WAITING', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Rozpakować się z delegacji', null, 0, 0.25, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Zrobić obiad', null, 1, 0.25, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Kolacja', null, 0, 0, 'WAITING', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Spacer z joyem', '12, 16, 20, 24', 0.75, 0.5, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Stopa', 'moczenie w soli', 0, 0.5, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Stopa', 'sprej', 0, 0.75, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Szycie plecaka', null, 0.5, 0, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Rozwiązać problem z drukarką', null, 0, 1.5, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Jedzenie obiadu', null, 0.5, 0.5, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Ogarnięcie śmieci', null, 0, 0.25, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Planowanie', null, 0.5, 1, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Wypakować zmywarkę i zapakować', null, 0.25, 0, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
insert into task(title, description, asia_time, szymon_time, status, date) values('Sprzątanie po obiedzie', null, 0.25, 0, 'DONE', str_to_date('2017-07-01', '%Y-%m-%d'));
