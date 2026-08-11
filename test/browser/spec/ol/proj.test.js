import {register} from 'ol/proj/proj4.js';
import {transform} from 'ol/proj.js';
import proj4 from 'proj4';
import {getProjection} from '../../../../src/ol/proj.js';

// OGC WKT for ETRS89 / UTM zone 32N, as served by spatialreference.org
const WKT_25832 =
  'PROJCS["ETRS89 / UTM zone 32N",GEOGCS["ETRS89",DATUM["European_Terrestrial_Reference_System_1989",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",9],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",0],UNIT["metre",1]]';

// A minimal stac-js-like reference exposing metadata
function fakeReference(metadata) {
  return {
    getMetadata(key) {
      return metadata[key];
    },
  };
}

describe('ol/proj', function () {
  describe('getProjection', function () {
    let originalFetch;

    beforeEach(function () {
      register(proj4);
      originalFetch = window.fetch;
      window.fetch = (url) => {
        if (String(url).includes('spatialreference.org')) {
          return Promise.resolve(new Response(WKT_25832, {status: 200}));
        }
        return Promise.resolve(new Response('', {status: 404}));
      };
    });

    afterEach(function () {
      window.fetch = originalFetch;
    });

    it('resolves proj:code through the projection lookup', async function () {
      const projection = await getProjection(
        fakeReference({'proj:code': 'EPSG:25832'}),
      );
      expect(projection).to.be.ok();
      expect(projection.getCode()).to.be('EPSG:25832');
      // The definition must be usable, i.e. transforms must be registered
      const [lon, lat] = transform(
        [533000, 5929000],
        'EPSG:25832',
        'EPSG:4326',
      );
      expect(lon).to.be.within(9.49, 9.51);
      expect(lat).to.be.within(53.5, 53.52);
    });

    it('falls back to the default projection without projection metadata', async function () {
      const projection = await getProjection(fakeReference({}), 'EPSG:4326');
      expect(projection).to.be('EPSG:4326');
    });
  });
});
