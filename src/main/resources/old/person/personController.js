var personController = function ($scope, $http) {
    $http({
        method: 'GET',
        url: BASE_CONTEXT + '/person'
    }).then(function (response) {
        $scope.personList = response.data;
    }, function (error) {
        alert('ERROR' + error)
    });
};
app.controller('personController', personController);