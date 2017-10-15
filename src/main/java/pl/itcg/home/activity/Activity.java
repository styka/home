package pl.itcg.home.activity;

import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import lombok.ToString;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import java.math.BigDecimal;
import java.util.Date;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@ToString
public class Activity {

    @Id
    @GeneratedValue
    public Long id;

    //TODO złączyć hibernejtowo
    public Long userId;

    public String title;
    public String description;
    public String status;
    public Date date;
    public BigDecimal asiaTime;
    public BigDecimal szymonTime;

}
