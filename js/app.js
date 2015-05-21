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

    app.factory('Sessions', ['$http', '$q', '$localStorage', function ($http, $q, $localStorage) {
        var self = this,
            wc_url = 'https://cologne.wordcamp.org/2015/',
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

        var map_sessions_to_tracks = function (data) {
            var _plan = {}, _sessions = {}, _tracks = {};

            angular.forEach(data, function (session) {
                var time = get_meta(session.post_meta, '_wcpt_session_time'), date, day;

                if (time && session.terms.wcb_track) {
                    date = moment.utc(time * 1000);
                    day = date.format('dddd') + ', ' + date.format('LL');
                    time = date.format('LT');
                    angular.forEach(session.terms.wcb_track, function (track) {
                        if (!_plan[day]) {
                            _plan[day] = {};
                        }
                        if (!_plan[day][time]) {
                            _plan[day][time] = {};
                        }

                        _plan[day][time][track.ID] = session.ID;
                        _tracks[track.ID] = track;
                    });
                }
                _sessions[session.ID] = session;
            });

            _.each(_plan, function (times, day) {
                _.each(times, function (session_ids, time) {
                    var values = _.values(session_ids);
                    if (values.length > 1 && _.uniq(values, true).length === 1) {
                        _plan[day][time] = values[0];
                    }
                });
            });

            $localStorage.cache.plan = self.plan = _plan;
            $localStorage.cache.sessions = self.sessions = _sessions;
            $localStorage.cache.tracks = self.tracks = _.values(_tracks);
        };

        self.get = function () {
            return $q(function (resolve, reject) {
                if ($localStorage.cache.tracks && $localStorage.cache.plan && $localStorage.cache.sessions) {
                    self.plan = $localStorage.cache.plan;
                    self.sessions = $localStorage.cache.sessions;
                    self.tracks = $localStorage.cache.tracks;

                    resolve();
                }

                $http.get(wc_url + query).success(function (data) {
                    map_sessions_to_tracks(data);
                    resolve();
                });
            });
        };

        return self;
    }]);

    app.controller('MainCtrl', ['$scope', 'Sessions', '$localStorage', function ($scope, Sessions, $localStorage) {
        Sessions.get().then(function () {
            $scope.tracks = Sessions.tracks;
            $scope.plan = Sessions.plan;
            $scope.sessions = Sessions.sessions;
        });

        $scope.isObject = angular.isObject;

        $localStorage.$default({
            selected: {}
        });
        $scope.selected = $localStorage.selected;

        $scope.select = function (day, time, session_id) {
            if (!$scope.selected[day]) {
                $scope.selected[day] = {};
            }

            $scope.selected[day][time] = session_id;
        };

        $scope.reset_selection = function () {
            $localStorage.selected = $scope.selected = {};
        }
    }]);

})();