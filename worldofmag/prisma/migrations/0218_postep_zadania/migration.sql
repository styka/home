-- 039: postęp wieloetapowego zadania w kolejce.
--
-- Do tej pory zadanie miało tylko status (QUEUED/RUNNING/DONE/FAILED) i wynik wypełniany na końcu.
-- Wystarczało to dla zadań jednoetapowych, ale przebieg odświeżania Wiadomości ma cztery etapy i
-- użytkownik ma widzieć, na którym z nich stoi — także po odświeżeniu strony, kiedy komponent
-- traci pamięć, a zadanie leci dalej. Stan musi więc mieszkać w kolejce, nie w przeglądarce.
--
-- Kolumna jest w "Job", a nie w tabelach modułu, bo to brak warstwy kolejki: każdy wieloetapowy
-- handler ma dokładnie ten sam problem. Migracja addytywna, dopuszcza NULL (zadania bez etapów).
ALTER TABLE "Job" ADD COLUMN "progress" TEXT;
