var BASE_CONTEXT = "api/v1"

var app = angular.module('TrueLifeApp', ['ngMaterial']);

app.config(function ($mdDateLocaleProvider, $mdIconProvider) {
    $mdDateLocaleProvider.formatDate = function (date) {
        return moment(date).format('YYYY-MM-DD');
    };
    $mdIconProvider.icon('menu', './svg/menu.svg', 24)
});