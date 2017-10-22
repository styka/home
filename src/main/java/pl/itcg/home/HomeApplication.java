package pl.itcg.home;

import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import pl.itcg.home.backup.BackupApplicationService;
import pl.itcg.home.startupinfo.StartupInfoApplicationService;

@SpringBootApplication
@AllArgsConstructor
public class HomeApplication {

    private static final Logger log = LoggerFactory.getLogger(HomeApplication.class);

    private BackupApplicationService backupApplicationService;
    private StartupInfoApplicationService startupInfoApplicationService;

    public static void main(String[] args) {
        SpringApplication.run(HomeApplication.class, args);
    }

    @Bean
    public CommandLineRunner onStartUp() {
        return (args) -> {
            backupApplicationService.backup();
            startupInfoApplicationService.showInfo();
        };
    }

}

