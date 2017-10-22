package pl.itcg.home.backup;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.activation.DataHandler;
import javax.activation.DataSource;
import javax.activation.FileDataSource;
import javax.mail.*;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeBodyPart;
import javax.mail.internet.MimeMessage;
import javax.mail.internet.MimeMultipart;
import java.io.IOException;
import java.util.Properties;
import java.util.concurrent.Executors;

@Service
public class BackupApplicationService {

    private static final Logger log = LoggerFactory.getLogger(BackupApplicationService.class);

    @Value("${pl.itcg.home.truelife.backup.dir}")
    private String backupsDir;

    @Value("${pl.itcg.home.truelife.backup.fileName}")
    private String fileName;

    @Value("${spring.datasource.username}")
    private String usernName;

    @Value("${spring.datasource.password}")
    private String password;

    @Value("${pl.itcg.home.truelife.backup.active}")
    private boolean isBackupActive;

    @Value("${mail.user}")
    private String mailUser;

    @Value("${mail.password}")
    private String mailPassword;

    public void backup() {
        try {
            tryBackup();
        } catch (Exception e) {
            log.error("Error during backup process");
            e.printStackTrace();
        }
    }

    public void tryBackup() throws IOException, MessagingException, InterruptedException {
        log.info("Backup process - start");

        log.info("Checking if application is ready for backup process - start");
        boolean isWindows = System.getProperty("os.name").toLowerCase().startsWith("windows");
        if (!isWindows || !isBackupActive) {
            log.info("Checking if application is ready for backup process - is not ready - done");
            return;
        }
        log.info("Checking if application is ready for backup process - is ready - done");

        log.info("Preparing to dump command - start");
        long currentTime = System.currentTimeMillis();
        String currentFileName = fileName + "_" + currentTime + ".sql";
        String filePath = backupsDir + "\\" + currentFileName;
        String command = String.format("cmd.exe /c mysqldump -u%s -p%s home --result-file=%s", usernName, password, filePath);
        Process process = Runtime.getRuntime().exec(command);
        //To print result on standard output
        StreamGobbler streamGobbler = new StreamGobbler(process.getInputStream(), log::info);
        Executors.newSingleThreadExecutor().submit(streamGobbler);
        log.info("Preparing to dump command - done");

        log.info("Dump command in progress - start\n[" + command + "]");
        int exitCode = process.waitFor();
        log.info("Dump command in progress - done");

        log.info("Preparing to send mail - start");
        Properties properties = new Properties();
        properties.load(this.getClass().getResourceAsStream("/application-production.properties"));
        Session session = Session.getInstance(properties);
        MimeMessage mm = new MimeMessage(session);
        mm.setFrom(new InternetAddress(properties.getProperty("ADRES_NADAWCY@example.com"), properties.getProperty("NAZWA_NADAWCY")));
        mm.setRecipient(Message.RecipientType.TO, new InternetAddress("tyka.szymon@gmail.com", "Szymon Tyka"));
        mm.setSubject("Backup " + fileName + " - time: " + currentTime);
        Multipart multipart = new MimeMultipart();
        MimeBodyPart textBodyPart = new MimeBodyPart();
        textBodyPart.setText("You will find backup in attachement.");
        MimeBodyPart attachmentBodyPart = new MimeBodyPart();
        DataSource source = new FileDataSource(filePath); // ex : "C:\\test.pdf"
        attachmentBodyPart.setDataHandler(new DataHandler(source));
        attachmentBodyPart.setFileName(currentFileName); // ex : "test.pdf"
        multipart.addBodyPart(textBodyPart);  // add the text part
        multipart.addBodyPart(attachmentBodyPart); // add the attachement part
        mm.setContent(multipart);
        Transport t = session.getTransport("smtp");
        t.connect(mailUser, mailPassword);
        log.info("Preparing to send mail - done");

        log.info("Sending mail - start");
        t.sendMessage(mm, mm.getAllRecipients());
        log.info("Sending mail - done");

        log.info("-------------------------------");
        log.info("--- BACKUP SUMMARY ------------");
        log.info("-------------------------------");
        log.info("- isBackupActive: " + isBackupActive);
        log.info("- isWindows: " + isWindows);
        log.info("- backupsDir: " + backupsDir);
        log.info("- fileName: " + fileName);
        log.info("- filePath: " + filePath);
        log.info("- command: " + command);
        log.info("- exitCode: " + exitCode);
        log.info("-------------------------------");

        log.info("Backup process - done");
    }

}
