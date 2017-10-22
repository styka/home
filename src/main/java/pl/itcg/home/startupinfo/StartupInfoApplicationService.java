package pl.itcg.home.startupinfo;

import com.google.common.collect.Lists;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import pl.itcg.home.activity.ActivityRepository;
import pl.itcg.home.person.PersonRepository;

@Service
@AllArgsConstructor
public class StartupInfoApplicationService {
    private static final Logger log = LoggerFactory.getLogger(StartupInfoApplicationService.class);

    private PersonRepository personRepository;
    private ActivityRepository taskRepository;

    public void showInfo() {
        log.info("-------------------------------");
        log.info("--- DATA COUNTER --------------");
        log.info("-------------------------------");
        log.info("- Persons: " + Lists.newArrayList(personRepository.findAll()).size());
        log.info("- Tasks: " + Lists.newArrayList(taskRepository.findAll()).size());
        log.info("-------------------------------");
    }
}