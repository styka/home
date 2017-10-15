package pl.itcg.home.activity;

import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@AllArgsConstructor
public class ActivityApplicationService {

    private static final SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
    private ActivityRepository activityRepository;

    public List<String> getDictionaryStatusList() {
        return getNames(ActivityStatus.class);
    }

    public List<Date> getDictionaryDate() {

        Set<Date> resultSet = new HashSet<>();
        activityRepository.findAll().forEach(item -> resultSet.add(item.date));
        resultSet.remove(null);
        resultSet.remove("");

        List<Date> resultList = new ArrayList<>();
        resultList.addAll(resultSet);
        Collections.sort(resultList);
        Collections.reverse(resultList);
        return resultList;
    }

    private List<String> getNames(Class<? extends Enum<?>> e) {
        String[] resultArray = Arrays.stream(e.getEnumConstants()).map(Enum::name).toArray(String[]::new);
        return Arrays.asList(resultArray);
    }

    public Iterable<Activity> findByStatusAndDate(String status, String dateFrom, String dateTo) {
        dateTo = addDay(dateTo);
        return activityRepository.findByStatusAndDate(status, cutTime(dateFrom), cutTime(dateTo));
    }

    private String addDay(String dateInString) {
        if (dateInString == null) {
            return null;
        }
        Calendar cal = Calendar.getInstance();
        try {
            cal.setTime(sdf.parse(dateInString));
        } catch (ParseException e) {
            throw new RuntimeException(e);
        }
        cal.add(Calendar.DATE, 1);
        return sdf.format(cal.getTime());
    }

    private Date cutTime(String dateInString) {
        if (StringUtils.isEmpty(dateInString)) {
            return null;
        }
        Calendar cal = Calendar.getInstance();
        try {
            cal.setTime(sdf.parse(dateInString));
        } catch (ParseException e) {
            throw new RuntimeException(e);
        }
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        return cal.getTime();
    }

    public Activity save(Activity activity) {
        return activityRepository.save(activity);
    }
}
