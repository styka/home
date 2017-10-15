package pl.itcg.home;

import com.google.common.collect.Lists;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import pl.itcg.home.person.PersonRepository;
import pl.itcg.home.activity.ActivityRepository;

@SpringBootApplication
public class HomeApplication {

    private static final Logger log = LoggerFactory.getLogger(HomeApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(HomeApplication.class, args);
    }

    @Bean
    public CommandLineRunner demo(PersonRepository personRepository, ActivityRepository taskRepository) {
        return (args) -> {
            log.info("-------------------------------");
            log.info("--- DATA COUNTER --------------");
            log.info("-------------------------------");
            log.info("- Persons: " + Lists.newArrayList(personRepository.findAll()).size());
            log.info("- Tasks: " + Lists.newArrayList(taskRepository.findAll()).size());
            log.info("-------------------------------");
        };
    }
}

