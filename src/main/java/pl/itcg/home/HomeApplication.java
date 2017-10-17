package pl.itcg.home;

import com.google.common.collect.Lists;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import pl.itcg.home.activity.ActivityRepository;
import pl.itcg.home.person.PersonRepository;

import java.util.concurrent.Executors;

@SpringBootApplication
public class HomeApplication {

    private static final Logger log = LoggerFactory.getLogger(HomeApplication.class);

    @Value("${pl.itcg.home.truelife.backup.dir}")
    private String backupsDir;

    @Value("${pl.itcg.home.truelife.backup.active}")
    private boolean isBackupActive;

    public static void main(String[] args) {
        SpringApplication.run(HomeApplication.class, args);
    }

    @Bean
    public CommandLineRunner backup() {
        return (args) -> {
            if(!isBackupActive){
                return;
            }

            boolean isWindows = System.getProperty("os.name").toLowerCase().startsWith("windows");
            Process process;
            if (isWindows) {
                process = Runtime.getRuntime()
                        .exec(String.format("cmd.exe /c dir %s", backupsDir));
            } else {
                process = Runtime.getRuntime()
                        .exec(String.format("sh -c ls %s", backupsDir));
            }
            StreamGobbler streamGobbler = new StreamGobbler(process.getInputStream(), System.out::println);
            Executors.newSingleThreadExecutor().submit(streamGobbler);
            int exitCode = process.waitFor();
            assert exitCode == 0;

            log.info("-------------------------------");
            log.info("--- BACKUP --------------------");
            log.info("-------------------------------");
            log.info("- isBackupActive: " + isBackupActive);
            log.info("- isWindows: " + isWindows);
            log.info("- backupsDir: " + backupsDir);
            log.info("- exitCode: " + exitCode);
            log.info("-------------------------------");
        };
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

