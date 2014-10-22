Weather.Loc = DS.Model.extend({
  name: DS.attr('string'),
  slug: DS.attr('slug'),
  lat: DS.attr('number'),
  lon: DS.attr('number')
});

Weather.Loc.FIXTURES = [
  {
    name: "San Francisco, Ca",
    slug: "San-Francisco-Ca",
    lat: 37.737331999999995,
    lon: -122.46940169999999
  }
];