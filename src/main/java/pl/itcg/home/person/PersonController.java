package pl.itcg.home.person;

import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.itcg.home.BaseController;

import static pl.itcg.home.BaseController.BASE_CONTEXT;

@RestController
@RequestMapping(value = BASE_CONTEXT + "person")
@AllArgsConstructor
class PersonController extends BaseController {

    PersonRepository personRepository;

    @GetMapping
    public Iterable<Person> getPersonList() {
        return personRepository.findAll();
    }
}
