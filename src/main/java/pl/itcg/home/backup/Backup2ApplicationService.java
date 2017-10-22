package pl.itcg.home.backup;

import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@AllArgsConstructor
public class Backup2ApplicationService {

//    @Autowired
//    public JavaMailSender emailSender;

    //   @Bean
    /*
    public CommandLineRunner backupV1() {
        return (args) -> {
            boolean isWindows = System.getProperty("os.name").toLowerCase().startsWith("windows");
            if (!isWindows || !isBackupActive) {
                return;
            }

            log.info("-------------------------------");
            log.info("--- BACKUP --------------------");
            log.info("-------------------------------");

            //Create backup file
            long currentTime = System.currentTimeMillis();
            String currentFileName = fileName + "_" + currentTime + ".sql";
            String filePath = backupsDir + "\\" + currentFileName;
            String command = String.format("cmd.exe /c mysqldump -u%s -p%s home --result-file=%s", usernName, password, filePath);
            Process process = Runtime.getRuntime().exec(command);
            //To print result on standard output
            StreamGobbler streamGobbler = new StreamGobbler(process.getInputStream(), System.out::println);
            Executors.newSingleThreadExecutor().submit(streamGobbler);
            int exitCode = process.waitFor();
            assert exitCode == 0;

            //Change backupfile to zip file
            //TODO

            //Send zip file on mail
            MimeMessage message = emailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);
            helper.setFrom("backup@truelife");
            helper.setTo("tyka.szymon@gmail.com");
            helper.setSubject("Backup " + fileName + " - time: " + currentTime);
            helper.setText("You will find backup in attachement.");
            FileSystemResource file = new FileSystemResource(new File(filePath));
            helper.addAttachment(currentFileName, file);
            emailSender.send(message);

            //Summary
            log.info("- isBackupActive: " + isBackupActive);
            log.info("- isWindows: " + isWindows);
            log.info("- backupsDir: " + backupsDir);
            log.info("- fileName: " + fileName);
            log.info("- filePath: " + filePath);
            log.info("- command: " + command);
            log.info("- exitCode: " + exitCode);
            log.info("-------------------------------");
        };
    }
    */
}
