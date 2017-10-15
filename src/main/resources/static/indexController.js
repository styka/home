var indexController = function ($scope, $mdSidenav) {
    $scope.menu = 'activityPage';
    $scope.pageTitle = 'Aktywności';
    $scope.toggleMenu = function(){
        $mdSidenav('menu').toggle();
    }
};
app.controller('indexController', indexController);