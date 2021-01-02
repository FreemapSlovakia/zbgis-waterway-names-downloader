const axios = require('axios');
const osmtogeojson = require('osmtogeojson');
const turf = require('@turf/turf');

const res = [];

const bbox = (process.argv.length === 3
  ? process.argv[2].split(',')
  : process.argv.slice(2)
)
  .map((a) => Number(a))
  .filter((n) => !isNaN(n));

if (process.argv.length !== 6 || bbox.length !== 4) {
  console.error('Missing bbox');
  process.exitCode = 1;
  return;
}

axios
  .post(
    // 'https://overpass-api.de/api/interpreter',
    'https://overpass.freemap.sk/api/interpreter',
    `
      [out:json][timeout:120][bbox:${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]}];
      (
        way["waterway"="river"]["name"!~"."];
        way["waterway"="stream"]["name"!~"."];
        way["waterway"="drain"]["name"!~"."];
        way["waterway"="ditch"]["name"!~"."];
      );
      out body;
      >;
      out skel qt;
    `
  )
  .then(async (response) => {
    const { features } = osmtogeojson(response.data);

    console.error('Features:', features.length);

    const promises = [];

    let i = 0;

    let pending = 0;

    for (const feature of features) {
      if (feature.geometry.type !== 'LineString') {
        continue;
      }

      const len = turf.length(feature);

      for (
        let dist = len / 2 - Math.floor(len / 2);
        dist < len;
        dist += 1 // every kilometer
      ) {
        const center = turf.along(feature, dist);

        const [lon, lat] = center.geometry.coordinates;

        // max "threads" is 10
        // ugly but works ;-)
        while (pending > 10) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        pending++;

        const p = axios
          .get(
            'https://zbgisws.skgeodesy.sk/zbgis_vodstvo_wms_featureinfo/service.svc/get',
            {
              params: {
                SERVICE: 'WMS',
                VERSION: '1.3.0',
                REQUEST: 'GetFeatureInfo',
                BBOX: `${lat - 0.000001},${lon - 0.000001},${lat + 0.000001},${
                  lon + 0.0001
                }`,
                CRS: 'EPSG:4326',
                WIDTH: 1,
                HEIGHT: 1,
                QUERY_LAYERS: 7,
                INFO_FORMAT: 'text/plain',
                I: 0,
                J: 0,
                FEATURE_COUNT: 1,
              },
            }
          )
          .then((response) => {
            const s = response.data.split(';');

            const d = {};

            const half = (s.length - 1) / 2;

            for (let i = 0; i < half; i++) {
              d[s[i]] = s[i + half];
            }

            const name = d['@Vodný tok Meno, názov (prípadne kód)']
              ?.trim()
              .replace('N/A', '');

            console.error(`Features ${i++}/${features.length}:`, name);

            if (name) {
              center.properties.name = name;

              return center;
            }
          })
          .catch((err) => {
            // ignore
          })
          .finally(() => {
            pending--;
          });

        promises.push(p);
      }
    }

    return Promise.all(promises);
  })
  .then((results) => {
    console.log(
      JSON.stringify(turf.featureCollection(results.filter((x) => x)))
    );
  });
