var ACTIVITY_URL = BASE_CONTEXT + '/activity';

function cutTime(date) {
    if (date == null) {
        return null;
    }
    var resultDate = (typeof date === 'string') ? new Date(parseInt(date, 10)) : date;
    var month = (resultDate.getMonth() + 1);
    month = month < 10 ? '0' + month : month;
    var day = resultDate.getDate();
    day = day < 10 ? '0' + day : day;
    return resultDate.getFullYear() + '-' + month + '-' + day;
}

function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}

var activityController = function ($scope, $http, $mdDialog) {
    $scope.notReadyDictionaryList = [];
    $scope.todayActivityList = [];
    $scope.futureActivityList = [];
    $scope.pastActivityList = [];
    $scope.activitySearchDto = {};
    $scope.dictionaryStatusList = [];
    $scope.dictionaryDateList = [];
    $scope.asiaTime = 0;
    $scope.szymonTime = 0;
    $scope.taskSearchDto = {};

    $scope.onLoad = function () {
        $scope.getDictionaryStatusList();
        $scope.getDictionaryDateList();
        $scope.findTodayActivities();
        $scope.findFutureActivities();
        $scope.findPastActivities();
    }

    $scope.findTodayActivities = function () {
        if ($scope.notReadyDictionaryList.length > 0) {
            setTimeout($scope.findTodayActivities, 1000);
        } else {
            $scope.findByStatusAndDate('WAITING', null, cutTime(new Date()), function (response) {
                $scope.todayActivityList = response.data;
                $scope.refreshTimes();
            });
        }
    }

    $scope.findFutureActivities = function () {
        if ($scope.notReadyDictionaryList.length > 0) {
            setTimeout($scope.findFutureActivities, 1000);
        } else {
            var dateFrom = new Date();
            dateFrom.setDate(dateFrom.getDate() + 1);
            $scope.findByStatusAndDate('WAITING', cutTime(dateFrom), null, function (response) {
                $scope.futureActivityList = response.data;
            });
        }
    };

    $scope.findPastActivities = function () {
        if ($scope.notReadyDictionaryList.length > 0) {
            setTimeout($scope.findPastActivities, 1000);
        } else {
            var dateTo = new Date();
            dateTo.setDate(dateTo.getDate());
            $scope.findByStatusAndDate(null, null, cutTime(dateTo), function (response) {
                $scope.pastActivityList = response.data;
            });
        }
    };

    $scope.searchActivities = function () {
        var taskSearchDto = $scope.taskSearchDto;
        $scope.findByStatusAndDate(taskSearchDto.status, cutTime(taskSearchDto.dateFrom), cutTime(taskSearchDto.dateTo), function (response) {
            $scope.searchActivityList = response.data;
            $scope.searchResultInfo = "Znaleziono " + $scope.searchActivityList.length + " aktywności";
        });
    };

    $scope.refreshTimes = function () {
        $scope.asiaTime = 0;
        $scope.szymonTime = 0;
        $scope.todayActivityList.forEach(function (activity) {
            $scope.asiaTime += activity.asiaTime;
            $scope.szymonTime += activity.szymonTime;
        });
    };

    $scope.findByStatusAndDate = function (status, dateFrom, dateTo, responseFunction) {
        $http({
            method: 'GET',
            url: ACTIVITY_URL + '/findByStatusAndDate',
            params: {status: status, dateFrom: dateFrom, dateTo: dateTo}
        }).then(function (response) {
            responseFunction(response)
        }, function (error) {
            alert('ERROR' + error)
        });
    };

    $scope.getDictionaryStatusList = function () {
        $scope.notReadyDictionaryList.push('dictionaryStatusList');
        $http({
            method: 'GET',
            url: ACTIVITY_URL + '/dictionary/status',
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
            url: ACTIVITY_URL + '/dictionary/date',
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

    $scope.addActivity = function () {
        $scope.editActivity({status: "WAITING", date: new Date().getTime()});
    }

    $scope.editActivity = function (activity) {
        var selectedActivity = clone(activity);
        selectedActivity.date = new Date(selectedActivity.date);
        $mdDialog.show({
            controller: ActivityEditController,
            controllerAs: "aec",
            templateUrl: 'activity/activityEditSection.html',
            parent: angular.element(document.querySelector("#content"))
        });
        function ActivityEditController() {
            this.selectedActivity = selectedActivity;
            this.dictionaryStatusList = $scope.dictionaryStatusList;
            this.markAsDone = function () {
                this.selectedActivity.status = 'DONE';
                this.save();
            };
            this.save = function () {
                $http.put(ACTIVITY_URL, this.selectedActivity).then(
                    function (response) {
                        $scope.info = 'Zadanie o tytule "' + response.data.title + '" zostało zapisane.';
                        $scope.getDictionaryDateList();
                        $scope.findTodayActivities();
                        $scope.findFutureActivities();
                        $scope.findPastActivities();
                        $mdDialog.hide();
                    },
                    function (response) {
                        $scope.info = 'ERROR' + response;
                    }
                );
            };
            this.cancel = function () {
                $mdDialog.hide();
            };
        }
    };

    $scope.onLoad();
};

app.controller('activityController', activityController);
