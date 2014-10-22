/* APPLICATION */
window.Weather = Ember.Application.create();
window.NUM_READINGS = 9;

var dt_to_hour = function(date) {
  var hour = date.getHours();
  return hour >= 12 ? hour % 12 + 'p' : hour + 'a';
};

var deslugify = function(str) {
  return str.replace(/\-/g, ' ');
};

var slugify = function(str) {
  return str.replace(/([^\w\s\_\-\.]|(^[\W\_\-]+|[\W\_\-]+$))/g, '').replace(/[\s\-\_\.]+/g, '-');
};

var kelvin_to_f = function(kel) {
  var fehr = ((kel - 273.15) * 1.8) + 32;
  var str = fehr.toString();
  str = str.slice(0, str.indexOf('.') + 2);
  return str + '\xB0';
};

var kelvin_to_c = function(kel) {
  var cel = kel - 273.15;
  var str = cel.toString();
  str = str.slice(0, str.indexOf('.') + 2);
  return str + '\xB0C';
};


var beautify_text = function(str) {
  return str.replace(/\w\S*/g, function(ss){return ss.charAt(0).toUpperCase() + ss.substring(1).toLowerCase();});
};

var degrees_to_cardinal_direction = function(deg) {
  var cardinal_directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE',
      'SE', 'SSE', 'S', 'SSW', 'S', 'WSW', 'W', 'WNW',
      'NW', 'NNW', 'N'];
  var index = Math.floor((deg + 11.25) / 22.5);
  return cardinal_directions[index];
};

var meters_sec_str = function(ms) {
  var str = ms.toString();
  str = str.slice(0, str.indexOf('.') + 2);
  return str + 'm/s';
};

var meters_to_feet_sec_str = function(ms) {
  var str = (ms * 3.288).toString();
  str = str.slice(0, str.indexOf('.') + 2);
  return str + 'ft/s';
};

Weather.OWMArrayTransform = Ember.Object.extend({
  serialize: function(arr) {
    var srlz_arr = [];
    for (var i = 0; i < window.NUM_READINGS; i++) {
      var el = arr[i];
      var dt =  new Date( el.dt * 1000);
      srlz_arr.push(
        {
          id: i,
          hour: dt_to_hour(dt),
          temp: kelvin_to_f(el.main.temp),
          humid: el.main.humidity,
          sky: el.weather[0].main.toLowerCase(),
          sky_desc: beautify_text(el.weather[0].description),
          wind_dir: degrees_to_cardinal_direction(el.wind.deg),
          wind_spd: meters_to_feet_sec_str(el.wind.speed),
        }  
      );
    }
    return srlz_arr;
  }
});

Weather.ReadingsTransform = Weather.OWMArrayTransform.create();

// Serializes object from OpenWeatherMap API
// I use var named locale because I don't want any issues with window.location
Weather.OWMSerializer = Ember.Object.extend({
  serialize: function(payload) { 
    var locale = payload.city.name || payload.city.country;
    var readings = Weather.ReadingsTransform.serialize(payload.list);
    payload = {
      location: locale,
      id: slugify(locale),
      currentReading: readings.shift(0),
      readings: readings
    };
    return payload;
  }
});

Weather.ForecastSerializer = Weather.OWMSerializer.create();

Weather.GLAdapter = Ember.Object.extend({
  coordinates: function() {
    return new Promise(function(resolve, reject) {
      navigator.geolocation.getCurrentPosition( function(data) {
        resolve(data);
      }, function(e) {
        reject(e);
      });
    });
  }
});

Weather.Geolocation = Weather.GLAdapter.create();

Weather.LSAdapter = Ember.Object.extend({
  locationKey: 'location',
  locationExists: function() {
    return this.locationKey in localStorage;
  },
  getLocation: function() {
    return localStorage[this.locationKey];
  },
  setLocation: function(loc) {
    localStorage[this.locationKey] = loc;
  },
  deleteLocation: function() {
    return delete localStorage[this.locationKey];
  }
});

Weather.LocalStorage = Weather.LSAdapter.create();

var forecastModelFromObj = function(obj) {
  // create readings models from the objects in obj.readings
  for (var i = 0; i < obj.readings.length; i++) {
    obj.readings[i] = Weather.Reading.create(obj.readings[i]);
  }
  return Weather.Forecast.create(obj);
};

//Weather.ApplicationAdapter = DS.FixtureAdapter.extend();
Weather.OWMAdapter = Ember.Object.extend({
  host: "http://api.openweathermap.org/data/2.5/forecast",
  cityKey: '?q=',
  latKey: '?lat=',
  lonKey: '&lon=',
  cityUrl: function(city) {
    return this.host + this.cityKey + city;
  },
  coordUrl: function(coord) {
    var lat = coord.coords.latitude;
    var lon = coord.coords.longitude;
    return this.host + this.latKey + lat + this.lonKey + lon;
  },
  APIPromise: function(url) {
    return new Promise(function(resolve, reject) {
      Ember.$.getJSON(url).then(function(data) {
        if (data.cod === '200') {
          return resolve(data);
        } else {
          return reject();
        }
      }, function(e) {
        return reject(e);
      });
    });
  },
  find: function(id) {
    return this.APIPromise(this.cityUrl(id)).then(function(data) {
      console.log(data);
      return forecastModelFromObj(Weather.ForecastSerializer.serialize(data));
    });
  },
  findFromCoord: function(coord) {
    console.log(coord);
    return Ember.$.getJSON( this.coordUrl(coord) ).then(function(data) {
      // create a new Weather.Forecast object from the serialized data
      return forecastModelFromObj(Weather.ForecastSerializer.serialize(data));
    });
  }
});

Weather.ForecastAdapter = Weather.OWMAdapter.create();

/* MODELS */
// Base Model
Weather.Model = Ember.Object.extend();

//Forecast Model
Weather.Forecast = Weather.Model.extend({
  save: function() {
    Weather.LocalStorage.setLocation(this.id);
  },
  init: function() {
    this.save();
  }
});

//Reading Model
Weather.Reading = Weather.Model.extend();

/* ROUTER */
Weather.Router.map(function() {
  this.resource('index', { path: '/' });
  this.resource('forecast', { path: '/:forecast_id' });
  
});

// Injects the forecastAdapter into Weather (OWMAdapter)
Weather.initializer({
    name: "forecastAdapter",
    initialize: function (container, app) {
        app.register("my:manager", app.OWMAdapter);
        app.inject("controller", "forecastAdapter", "my:manager");
        app.inject("route", "forecastAdapter", "my:manager");
    }
});

Weather.IndexRoute = Ember.Route.extend({
  beforeModel: function(params) {
    var ctx = this;
    if (Weather.LocalStorage.locationExists()) {
      this.transitionTo('forecast', Weather.LocalStorage.getLocation());
    } else {
      Weather.Geolocation.coordinates().then( function(gl) {
        ctx.forecastAdapter.findFromCoord(gl).then( function(mdl) {
          ctx.transitionTo('forecast', mdl);
        });
      });
    }
  },
});

Weather.ForecastRoute = Ember.Route.extend({
  serialize: function(model) {
    return { forecast_id: model.id };
  },
  model: function(params) {
    /*blah = this.forecastAdapter.find(params.forecast_id);
    console.log(blah);
    return blah;*/
    return this.forecastAdapter.find(params.forecast_id);
  },
  actions: {
    error: function() {
      console.log('error');
      Weather.LocalStorage.deleteLocation();
      return this.transitionTo('index');
    }
  }
});

Weather.IndexController = Ember.Controller.extend({
  actions: {
    routeTo: function() {
      var value = slugify(this.get('newForecastValue'));
      this.transitionTo('forecast', Weather.ForecastAdapter.find(value));
    }
  }
});

Weather.ForecastController = Ember.ObjectController.extend({
  inputDisplay: false,

  actions: {
    routeTo: function() {
      this.set('inputDisplay', false);
      var value = slugify(this.get('newForecastValue'));
      this.transitionTo('forecast', Weather.ForecastAdapter.find(value));
    },
    showInput: function() {
      this.set('inputDisplay', true);
    },
    hideInput: function() {
      this.set('inputDisplay', false);
    }
    
  }
});
