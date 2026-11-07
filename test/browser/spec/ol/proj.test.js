import {transform} from 'ol/proj.js';
import {register} from 'ol/proj/proj4.js';
import proj4 from 'proj4';
import {
  getHorizontalProjjson,
  getHorizontalWkt,
  getProjection,
  normalizeWkt,
} from '../../../../src/ol/proj.js';

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
      expect(projection).to.be.ok;
      expect(projection.getCode()).to.equal('EPSG:25832');
      // The definition must be usable, i.e. transforms must be registered
      const [lon, lat] = transform(
        [533000, 5929000],
        'EPSG:25832',
        'EPSG:4326',
      );
      expect(lon).to.be.within(9.49, 9.51);
      expect(lat).to.be.within(53.5, 53.52);
    });

    it('uses the horizontal part of a compound WKT2', async function () {
      const wkt = `COMPD_CS["ETRS89 / UTM zone 32N + DHHN2016 height",${WKT_25832},VERT_CS["DHHN2016 height",VERT_DATUM["Deutsches Haupthoehennetz 2016",2005],UNIT["metre",1]]]`;
      const projection = await getProjection(fakeReference({'proj:wkt2': wkt}));
      expect(projection).to.be.ok;
      const [lon, lat] = transform([533000, 5929000], projection, 'EPSG:4326');
      expect(lon).to.be.within(9.49, 9.51);
      expect(lat).to.be.within(53.5, 53.52);
    });

    it('supports WKT2 with long keywords and parentheses', async function () {
      const wkt =
        'projectedcrs("WGS 84 / UTM zone 32N",basegeogcrs("WGS 84",datum("World Geodetic System 1984",ellipsoid("WGS 84",6378137,298.257223563))),conversion("UTM zone 32N",method("Transverse Mercator"),parameter("Latitude of natural origin",0,angleunit("degree",0.0174532925199433)),parameter("Longitude of natural origin",9,angleunit("degree",0.0174532925199433)),parameter("Scale factor at natural origin",0.9996,scaleunit("unity",1)),parameter("False easting",500000,lengthunit("metre",1)),parameter("False northing",0,lengthunit("metre",1))),cs(Cartesian,2),axis("easting",east,lengthunit("metre",1)),axis("northing",north,lengthunit("metre",1)))';
      const projection = await getProjection(fakeReference({'proj:wkt2': wkt}));
      const [lon, lat] = transform([500000, 0], projection, 'EPSG:4326');
      expect(lon).to.be.within(8.99, 9.01);
      expect(lat).to.be.within(-0.01, 0.01);
    });

    it('supports WKT with names in any script', async function () {
      const wkt = WKT_25832.replace(
        'ETRS89 / UTM zone 32N',
        'ETRS89 / UTM 32N 区域',
      );
      const projection = await getProjection(fakeReference({'proj:wkt2': wkt}));
      const [lon] = transform([500000, 0], projection, 'EPSG:4326');
      expect(lon).to.be.within(8.99, 9.01);
    });

    it('falls back to the default projection without projection metadata', async function () {
      const projection = await getProjection(fakeReference({}), 'EPSG:4326');
      expect(projection).to.equal('EPSG:4326');
    });
  });

  describe('getHorizontalWkt', function () {
    it('returns the horizontal part of a compound WKT1', function () {
      const wkt = `COMPD_CS["ETRS89 / UTM zone 32N + DHHN2016 height",${WKT_25832},VERT_CS["DHHN2016 height",VERT_DATUM["Deutsches Haupthoehennetz 2016",2005],UNIT["metre",1]]]`;
      expect(getHorizontalWkt(wkt)).to.equal(WKT_25832);
    });

    it('returns the horizontal part of a compound WKT2', function () {
      const horizontal =
        'PROJCRS["WGS 84 / UTM zone 32N",BASEGEOGCRS["WGS 84",DATUM["World Geodetic System 1984"]]]';
      const wkt = `COMPOUNDCRS["WGS 84 / UTM zone 32N + EGM96 height",${horizontal},VERTCRS["EGM96 height",VDATUM["EGM96 geoid"]]]`;
      expect(getHorizontalWkt(wkt)).to.equal(horizontal);
    });

    it('returns the projected part of a compound WKT2 with long keywords', function () {
      // BASEGEOGCRS must not be mistaken for the horizontal reference system
      const horizontal =
        'PROJECTEDCRS["WGS 84 / UTM zone 32N",BASEGEOGCRS["WGS 84",DATUM["World Geodetic System 1984"]],CONVERSION["UTM zone 32N"]]';
      const wkt = `COMPOUNDCRS["WGS 84 / UTM zone 32N + EGM96 height",${horizontal},VERTCRS["EGM96 height",VDATUM["EGM96 geoid"]]]`;
      expect(getHorizontalWkt(wkt)).to.equal(horizontal);
    });

    it('returns the geographic part of a compound WKT2', function () {
      const horizontal =
        'GEOGRAPHICCRS["WGS 84",DATUM["World Geodetic System 1984"]]';
      const wkt = `COMPOUNDCRS["WGS 84 + EGM96 height",${horizontal},VERTICALCRS["EGM96 height",VDATUM["EGM96 geoid"]]]`;
      expect(getHorizontalWkt(wkt)).to.equal(horizontal);
    });

    it('ignores the case of the WKT2 keywords', function () {
      const horizontal =
        'projcrs["WGS 84 / UTM zone 32N",basegeogcrs["WGS 84",datum["World Geodetic System 1984"]]]';
      const wkt = `compoundcrs["WGS 84 / UTM zone 32N + EGM96 height",${horizontal},vertcrs["EGM96 height"]]`;
      expect(getHorizontalWkt(wkt)).to.equal(horizontal);
    });

    it('ignores brackets and keywords in quoted strings', function () {
      const horizontal =
        'PROJCS["Local grid in (0, 1000000] metres",GEOGCS["WGS 84"]]';
      const wkt = `COMPD_CS["GEOGCS[ ""quoted"" + height",${horizontal},VERT_CS["height"]]`;
      expect(getHorizontalWkt(wkt)).to.equal(horizontal);
    });

    it('supports parentheses as delimiters', function () {
      const horizontal =
        'PROJCRS("WGS 84 / UTM zone 32N",BASEGEOGCRS("WGS 84",DATUM("World Geodetic System 1984")))';
      const wkt = `COMPOUNDCRS("WGS 84 / UTM zone 32N + EGM96 height",${horizontal},VERTCRS("EGM96 height"))`;
      expect(getHorizontalWkt(wkt)).to.equal(horizontal);
    });

    it('keeps other reference systems', function () {
      expect(getHorizontalWkt(` ${WKT_25832} `)).to.equal(WKT_25832);
    });
  });

  describe('normalizeWkt', function () {
    it('keeps WKT that proj4 supports', function () {
      expect(normalizeWkt(WKT_25832)).to.equal(WKT_25832);
    });

    it('converts long WKT2 keywords to their short forms', function () {
      expect(
        normalizeWkt('PROJECTEDCRS["a",BASEGEOGCRS["b",DATUM["c"]]]'),
      ).to.equal('PROJCRS["a",BASEGEOGCRS["b",DATUM["c"]]]');
      expect(normalizeWkt('GEOGRAPHICCRS["a"]')).to.equal('GEOGCRS["a"]');
      expect(normalizeWkt('GEODETICCRS["a"]')).to.equal('GEODCRS["a"]');
    });

    it('converts keywords to upper case', function () {
      expect(normalizeWkt('projcrs["a",cs[Cartesian,2]]')).to.equal(
        'PROJCRS["a",CS[Cartesian,2]]',
      );
    });

    it('converts parentheses to brackets', function () {
      expect(normalizeWkt('PROJCRS ("a",ID("EPSG",32632))')).to.equal(
        'PROJCRS ["a",ID["EPSG",32632]]',
      );
    });

    it('keeps quoted strings', function () {
      const wkt = 'PROJCRS["projcrs(a) [b] ""c""",ID["EPSG",1]]';
      expect(normalizeWkt(wkt)).to.equal(wkt);
    });
  });

  describe('getHorizontalProjjson', function () {
    const horizontal = {
      type: 'ProjectedCRS',
      name: 'NAD83 / UTM zone 18N',
      id: {authority: 'EPSG', code: 26918},
    };

    it('returns the horizontal part of a compound PROJJSON', function () {
      const compound = {
        type: 'CompoundCRS',
        name: 'NAD83 / UTM zone 18N + NAVD88 height',
        components: [
          horizontal,
          {
            type: 'VerticalCRS',
            name: 'NAVD88 height',
            id: {authority: 'EPSG', code: 5703},
          },
        ],
      };
      expect(getHorizontalProjjson(compound)).to.equal(horizontal);
    });

    it('keeps other reference systems', function () {
      expect(getHorizontalProjjson(horizontal)).to.equal(horizontal);
    });
  });
});
