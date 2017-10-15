var TASK_URL = BASE_CONTEXT + '/task';

var taskController = function ($scope, $http) {
    $scope.notReadyDictionaryList = [];
    $scope.taskList = [];
    $scope.task = {};
    $scope.taskSearchDto = {};
    $scope.dictionaryStatusList = [];
    $scope.dictionaryDateList = [];
    $scope.asiaTime = 0;
    $scope.szymonTime = 0;

    $scope.onLoad = function () {
        $scope.getDictionaryStatusList();
        $scope.getDictionaryDateList();
        $scope.findTodayActivities(true);
    }

    $scope.findTodayActivities = function (resetFilter) {
        if ($scope.notReadyDictionaryList.length > 0) {
            setTimeout($scope.findTodayActivities, 1000, resetFilter);
        } else {
            $scope.findByStatusAndDate(resetFilter);
        }
    }

    $scope.refreshTimes = function () {
        $scope.asiaTime = 0;
        $scope.szymonTime = 0;
        $scope.taskList.forEach(function(task) {
            $scope.asiaTime += task.asiaTime;
            $scope.szymonTime += task.szymonTime;
        });
    };

    $scope.findByStatusAndDate = function (resetFilter) {
        if (resetFilter) {
            $scope.taskSearchDto.date = $scope.dictionaryDateList[0];
            $scope.taskSearchDto.status = 'WAITING';
        }
        $http({
            method: 'GET',
            url: TASK_URL + '/findByStatusAndDate',
            params: {status: $scope.taskSearchDto.status, date: $scope.taskSearchDto.date}
        }).then(function (response) {
            $scope.taskList = response.data;
            $scope.refreshTimes();
        }, function (error) {
            alert('ERROR' + error)
        });
    };

    $scope.getDictionaryStatusList = function () {
        $scope.notReadyDictionaryList.push('dictionaryStatusList');
        $http({
            method: 'GET',
            url: TASK_URL + '/dictionary/status',
        }).then(function (response) {
            $scope.dictionaryStatusList = response.data;
            $scope.removeFromNotReadyDictionaryList('dictionaryStatusList')
        }, function (error) {
            alert('ERROR' + error)
        });
    };

    $scope.getDictionaryDateList = function () {
        $scope.notReadyDictionaryList.push('dictionaryDateList');
        $http({
            method: 'GET',
            url: TASK_URL + '/dictionary/date',
        }).then(function (response) {
            $scope.dictionaryDateList = response.data;
            $scope.removeFromNotReadyDictionaryList('dictionaryDateList')
        }, function (error) {
            alert('ERROR' + error)
        });
    };

    $scope.removeFromNotReadyDictionaryList = function (item) {
        var index = $scope.notReadyDictionaryList.indexOf(item);
        if (index >= 0) {
            $scope.notReadyDictionaryList.splice(index, 1);
        }
    };

    $scope.addTask = function () {
        $http.post(TASK_URL, $scope.task).then(
            function (response) {
                $scope.info = 'Zadanie o tytule "' + response.data.title + '" zostało dodane.';
                $scope.closeFormForNew()
                $scope.getDictionaryDateList();
                $scope.findTodayActivities(false);
            },
            function (response) {
                $scope.info = 'ERROR' + response;
            }
        );
    };

    $scope.updateTask = function () {
        $http.put(TASK_URL, $scope.task).then(
            function (response) {
                $scope.info = 'Zadanie o tytule "' + response.data.title + '" zostało zapisane.';
                $scope.getDictionaryDateList();
                $scope.findTodayActivities(false);
                $scope.closeFormForEdit()
            },
            function (response) {
                $scope.info = 'ERROR' + response;
            }
        );
    };

    $scope.prepareFormForNew = function () {
        $scope.newTaskSectionVisibility = true;
        $scope.editTaskSectionVisibility = false;
        $scope.task = {};
        $scope.taskSectionVisibility = true;
        $scope.info = null;
    }

    $scope.prepareFormForEdit = function (task) {
        $scope.editTaskSectionVisibility = true;
        $scope.newTaskSectionVisibility = false;
        $scope.task = task;
        $scope.taskSectionVisibility = true;
        $scope.info = null;
    }

    $scope.closeFormForNew = function () {
        $scope.newTaskSectionVisibility = false;
        $scope.taskSectionVisibility = false;
    }

    $scope.closeFormForEdit = function () {
        $scope.editTaskSectionVisibility = false;
        $scope.taskSectionVisibility = false;
    }

    $scope.onLoad();
};

app.controller('taskController', taskController);

app.directive('bigDecimalType', function () {
    return {
        require: 'ngModel',
        link: function (scope, element, attr, ngModelCtrl) {
            function fromUser(text) {
                var transformedInput = text.replace(/[^0-9\\.]/g, '');
                if (transformedInput[0] == '.') {
                    transformedInput = transformedInput.slice(1);
                }
                var dotCount;
                while (dotCount = (transformedInput.match(/\./g) || []).length > 1) {
                    var dotLastIndex = transformedInput.lastIndexOf(".");
                    transformedInput = transformedInput.slice(0, dotLastIndex) + transformedInput.slice(dotLastIndex + 1);
                }
                if (transformedInput !== text) {
                    ngModelCtrl.$setViewValue(transformedInput);
                    ngModelCtrl.$render();
                }
                return transformedInput;  // or return Number(transformedInput)
            }

            ngModelCtrl.$parsers.push(fromUser);
        }
    };
});