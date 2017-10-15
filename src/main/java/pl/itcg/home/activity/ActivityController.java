package pl.itcg.home.activity;

import lombok.AllArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.itcg.home.BaseController;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

import static pl.itcg.home.BaseController.BASE_CONTEXT;

@RestController
@RequestMapping(value = BASE_CONTEXT + "activity")
@AllArgsConstructor
class ActivityController extends BaseController {

    ActivityApplicationService activityApplicationService;

    @GetMapping("findByStatusAndDate")
    public Iterable<Activity> findByStatusAndDate(
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "dateFrom", required = false) String dateFrom,
            @RequestParam(value = "dateTo", required = false) String dateTo ) {

        return activityApplicationService.findByStatusAndDate(status, dateFrom, dateTo);
    }

    @PostMapping
    public Activity addActivity(@RequestBody Activity activity) {
        return activityApplicationService.save(activity);
    }

    @PutMapping
    public Activity updateActivity(@RequestBody Activity activity) {
        return activityApplicationService.save(activity);
    }

    @GetMapping("dictionary/status")
    public List<String> dictionaryStatusList() {
        return activityApplicationService.getDictionaryStatusList();
    }

    @GetMapping("dictionary/date")
    public List<Date> dictionaryDateList() {
        return activityApplicationService.getDictionaryDate();
    }
}
