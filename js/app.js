// Defined: http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#navigatorlanguage
//   with allowable values at http://www.ietf.org/rfc/bcp/bcp47.txt
// Note that the HTML spec suggests that anonymizing services return "en-US" by default for
//   user privacy (so your app may wish to provide a means of changing the locale)
navigator.language = navigator.language ||
        // IE 10 in IE8 mode on Windows 7 uses upper-case in
        // navigator.userLanguage country codes but per
        // http://msdn.microsoft.com/en-us/library/ie/ms533052.aspx (via
        // http://msdn.microsoft.com/en-us/library/ie/ms534713.aspx), they
        // appear to be in lower case, so we bring them into harmony with navigator.language.
    (navigator.userLanguage && navigator.userLanguage.replace(/-[a-z]{2}$/, String.prototype.toUpperCase)) ||
    'en-US'; // Default for anonymizing services: http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#navigatorlanguage

(function () {
    moment.locale(navigator.language);

    var app = angular.module('wordcamp-web-app', ['ngSanitize', 'ngStorage']);

    app.factory('WordCamps', ['$http', '$q', '$localStorage', function ($http, $q, $localStorage) {
        var self = this,
            url = 'https://central.wordcamp.org/wp-json/posts?type=wordcamp&filter[posts_per_page]=50&filter[meta_key]=Start%20Date%20(YYYY-mm-dd)&filter[orderby]=meta_value_num&filter[order]=DESC';

        $localStorage.$default({
            wordcamp_cache: {}
        });

        self.get = function () {
            return $q(function (resolve) {
                if (!_.isEmpty($localStorage.wordcamp_cache)) {
                    self.wordcamps = $localStorage.wordcamp_cache;
                    resolve();
                }

                $http.get(url).success(function (data) {
                    $localStorage.wordcamp_cache = self.wordcamps = data;
                    resolve();
                });
            });
        };

        return self;
    }]);

    app.factory('Plan', ['$http', '$q', '$localStorage', function ($http, $q, $localStorage) {
        var self = this,
            wc_url = null,
            query = 'wp-json/posts?type=wcb_session&filter[order]=ASC&filter[orderby]=meta_value_num&filter[meta_value_num]=_wcpt_session_time&filter[posts_per_page]=100';

        $localStorage.$default({
            cache: {}
        });

        var get_meta = function (meta, key) {
            if (meta) {
                for (var i = 0; i < meta.length; i++) {
                    if (meta[i].key === key) {
                        return meta[i].value;
                    }
                }
            }
            return false;
        };

        var build_plan = function (data) {
            var _plan = {}, _sessions = {};

            angular.forEach(data, function (session) {
                var time = get_meta(session.post_meta, '_wcpt_session_time'), date, day;

                if (time && session.terms.wcb_track) {
                    date = moment.utc(time * 1000);
                    day = date.format('dddd') + ', ' + date.format('LL');
                    time = date.format('LT');
                    angular.forEach(session.terms.wcb_track, function (track) {
                        if (!_plan[day]) {
                            _plan[day] = {
                                tracks: {},
                                times: {}
                            };
                        }
                        if (!_plan[day].times[time]) {
                            _plan[day].times[time] = {};
                        }

                        _plan[day].times[time][track.ID] = session.ID;
                        _plan[day].tracks[track.ID] = track;
                    });
                }
                _sessions[session.ID] = session;
            });

            _.each(_plan, function (item, day) {
                _plan[day].tracks = _.sortBy(_.values(item.tracks), 'name');
                _.each(item.times, function (session_ids, time) {
                    var values = _.values(session_ids);
                    if (values.length > 1 && _.uniq(values, true).length === 1) {
                        _plan[day].times[time] = values[0];
                    }
                });
            });

            $localStorage.cache.plan = self.plan = _plan;
            $localStorage.cache.sessions = self.sessions = _sessions;
        };

        self.get = function () {
            return $q(function (resolve) {
                if ($localStorage.cache && !_.isEmpty($localStorage.cache.plan) && !_.isEmpty($localStorage.cache.sessions)) {
                    self.plan = $localStorage.cache.plan;
                    self.sessions = $localStorage.cache.sessions;

                    resolve();
                }

                if (wc_url) {
                    $http.get(wc_url + query).success(function (data) {
                        build_plan(data);
                        resolve();
                    });
                }
            });
        };

        self.setWordcamp = function (wordcamp, reset) {
            if (reset === true) {
                $localStorage.cache = {};
                self.plan = null;
                self.sessions = null;
            }

            wc_url = get_meta(wordcamp.post_meta, 'URL').replace('http://', 'https://');
            if (wc_url.substr(-1) != '/') wc_url += '/';
            return self.get();
        };

        return self;
    }]);

    app.controller('MainCtrl', [
        '$scope', 'Plan', '$localStorage', '$location', 'WordCamps',
        function ($scope, Plan, $localStorage, $location, WordCamps) {
            $scope.isObject = angular.isObject;

            $localStorage.$default({
                selected: {},
                selected_wordcamp: false
            });
            $scope.selected_wordcamp = $localStorage.selected_wordcamp;
            $scope.selected = $localStorage.selected;

            $scope.select = function (day, time, session_id) {
                if (!$scope.selected[day]) {
                    $scope.selected[day] = {};
                }

                $scope.selected[day][time] = session_id;
            };

            $scope.reset_selection = function () {
                $localStorage.selected = $scope.selected = {};
            };

            $scope.page = $location.search().page || 'auswahl';
            $scope.change_page = function (page) {
                $location.search('page', page);
                $scope.page = page;
            };

            Plan.setWordcamp($scope.selected_wordcamp).then(function () {
                $scope.plan = Plan.plan;
                $scope.sessions = Plan.sessions;
            });

            WordCamps.get().then(function () {
                $scope.wordcamps = WordCamps.wordcamps;
            });

            $scope.$watch('selected_wordcamp', function (newVal, oldVal) {
                if (oldVal !== newVal) {
                    $localStorage.selected = {};
                    $localStorage.selected_wordcamp = newVal;
                    Plan.setWordcamp(newVal, true).then(function () {
                        $scope.plan = Plan.plan;
                        $scope.sessions = Plan.sessions;
                    });
                }
            });
        }
    ]);

})();