package pl.itcg.home.activity;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

import java.util.Date;

public interface ActivityRepository extends CrudRepository<Activity, Long> {

    @Query(
            "SELECT item FROM Activity item " +
                    "where " +
                    "(:status is null or :status = item.status) and" +
                    "(:dateFrom is null or :dateFrom <= item.date) and" +
                    "(:dateTo is null or :dateTo > item.date)" +
                    "order by item.date desc, item.title"
    )
    Iterable<Activity> findByStatusAndDate(@Param("status") String status, @Param("dateFrom") Date dateFrom, @Param("dateTo") Date dateTo);

}
