package com.fitlog.exercise;

import com.fitlog.common.ApiException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExerciseService {

    private final ExerciseRepository repository;

    public ExerciseService(ExerciseRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<ExerciseResponse> list() {
        return repository.findAllByOrderByNameAscIdAsc().stream().map(ExerciseResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public Exercise getEntity(Long id) {
        return repository.findById(id).orElseThrow(() -> ApiException.notFound("운동"));
    }
}
