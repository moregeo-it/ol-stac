import {transform} from 'ol/proj.js';
import {register} from 'ol/proj/proj4.js';
import proj4 from 'proj4';
import {getProjection} from '../../../../src/ol/proj.js';

// OGC WKT for ETRS89 / UTM zone 32N, as served by spatialreference.org
const WKT_25832 =
  'PROJCS["ETRS89 / UTM zone 32N",GEOGCS["ETRS89",DATUM["European_Terrestrial_Reference_System_1989",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",9],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",0],UNIT["metre",1]]';

const WKT2_25832 =
  'PROJCRS["ETRS89 / UTM zone 32N",BASEGEOGCRS["ETRS89",DATUM["European Terrestrial Reference System 1989",ELLIPSOID["GRS 1980",6378137,298.257222101,LENGTHUNIT["metre",1]]],PRIMEM["Greenwich",0,ANGLEUNIT["degree",0.0174532925199433]],ID["EPSG",4258]],CONVERSION["UTM zone 32N",METHOD["Transverse Mercator",ID["EPSG",9807]],PARAMETER["Latitude of natural origin",0,ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",8801]],PARAMETER["Longitude of natural origin",9,ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",8802]],PARAMETER["Scale factor at natural origin",0.9996,SCALEUNIT["unity",1],ID["EPSG",8805]],PARAMETER["False easting",500000,LENGTHUNIT["metre",1],ID["EPSG",8806]],PARAMETER["False northing",0,LENGTHUNIT["metre",1],ID["EPSG",8807]]],CS[Cartesian,2],AXIS["easting",east,ORDER[1],LENGTHUNIT["metre",1]],AXIS["northing",north,ORDER[2],LENGTHUNIT["metre",1]],ID["EPSG",25832]]';

const VERTCRS =
  'VERTCRS["DHHN2016 height",VDATUM["Deutsches Haupthoehennetz 2016"],CS[vertical,1],AXIS["gravity-related height (H)",up,LENGTHUNIT["metre",1]]]';

// As written by PROJ 9.5 for a COMPD_CS with TOWGS84
const BOUND = `BOUNDCRS[SOURCECRS[${WKT2_25832}],TARGETCRS[GEOGCRS["WGS 84",DATUM["World Geodetic System 1984",ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]]],PRIMEM["Greenwich",0,ANGLEUNIT["degree",0.0174532925199433]],CS[ellipsoidal,2],AXIS["latitude",north,ORDER[1],ANGLEUNIT["degree",0.0174532925199433]],AXIS["longitude",east,ORDER[2],ANGLEUNIT["degree",0.0174532925199433]],ID["EPSG",4326]]],ABRIDGEDTRANSFORMATION["Transformation from ETRS89 to WGS84",METHOD["Position Vector transformation (geog2D domain)",ID["EPSG",9606]],PARAMETER["X-axis translation",0,ID["EPSG",8605]],PARAMETER["Y-axis translation",0,ID["EPSG",8606]],PARAMETER["Z-axis translation",0,ID["EPSG",8607]],PARAMETER["X-axis rotation",0,ID["EPSG",8608]],PARAMETER["Y-axis rotation",0,ID["EPSG",8609]],PARAMETER["Z-axis rotation",0,ID["EPSG",8610]],PARAMETER["Scale difference",1,ID["EPSG",8611]]]]`;

const COMPOUND_BOUND = `COMPOUNDCRS["ETRS89 / UTM zone 32N + DHHN2016 height",${BOUND},${VERTCRS}]`;

// As written by PROJ 9.5 for EPSG:25832+7837
const COMPOUND_PROJJSON = {
  'type': 'CompoundCRS',
  'name': 'ETRS89 / UTM zone 32N + DHHN2016 height',
  'components': [
    {
      'type': 'ProjectedCRS',
      'name': 'ETRS89 / UTM zone 32N',
      'base_crs': {
        'name': 'ETRS89',
        'datum_ensemble': {
          'name': 'European Terrestrial Reference System 1989 ensemble',
          'members': [
            {
              'name': 'European Terrestrial Reference Frame 1989',
              'id': {'authority': 'EPSG', 'code': 1178},
            },
            {
              'name': 'European Terrestrial Reference Frame 1990',
              'id': {'authority': 'EPSG', 'code': 1179},
            },
            {
              'name': 'European Terrestrial Reference Frame 1991',
              'id': {'authority': 'EPSG', 'code': 1180},
            },
            {
              'name': 'European Terrestrial Reference Frame 1992',
              'id': {'authority': 'EPSG', 'code': 1181},
            },
            {
              'name': 'European Terrestrial Reference Frame 1993',
              'id': {'authority': 'EPSG', 'code': 1182},
            },
            {
              'name': 'European Terrestrial Reference Frame 1994',
              'id': {'authority': 'EPSG', 'code': 1183},
            },
            {
              'name': 'European Terrestrial Reference Frame 1996',
              'id': {'authority': 'EPSG', 'code': 1184},
            },
            {
              'name': 'European Terrestrial Reference Frame 1997',
              'id': {'authority': 'EPSG', 'code': 1185},
            },
            {
              'name': 'European Terrestrial Reference Frame 2000',
              'id': {'authority': 'EPSG', 'code': 1186},
            },
            {
              'name': 'European Terrestrial Reference Frame 2005',
              'id': {'authority': 'EPSG', 'code': 1204},
            },
            {
              'name': 'European Terrestrial Reference Frame 2014',
              'id': {'authority': 'EPSG', 'code': 1206},
            },
            {
              'name': 'European Terrestrial Reference Frame 2020',
              'id': {'authority': 'EPSG', 'code': 1382},
            },
          ],
          'ellipsoid': {
            'name': 'GRS 1980',
            'semi_major_axis': 6378137,
            'inverse_flattening': 298.257222101,
          },
          'accuracy': '0.1',
          'id': {'authority': 'EPSG', 'code': 6258},
        },
        'coordinate_system': {
          'subtype': 'ellipsoidal',
          'axis': [
            {
              'name': 'Geodetic latitude',
              'abbreviation': 'Lat',
              'direction': 'north',
              'unit': 'degree',
            },
            {
              'name': 'Geodetic longitude',
              'abbreviation': 'Lon',
              'direction': 'east',
              'unit': 'degree',
            },
          ],
        },
        'id': {'authority': 'EPSG', 'code': 4258},
      },
      'conversion': {
        'name': 'UTM zone 32N',
        'method': {
          'name': 'Transverse Mercator',
          'id': {'authority': 'EPSG', 'code': 9807},
        },
        'parameters': [
          {
            'name': 'Latitude of natural origin',
            'value': 0,
            'unit': 'degree',
            'id': {'authority': 'EPSG', 'code': 8801},
          },
          {
            'name': 'Longitude of natural origin',
            'value': 9,
            'unit': 'degree',
            'id': {'authority': 'EPSG', 'code': 8802},
          },
          {
            'name': 'Scale factor at natural origin',
            'value': 0.9996,
            'unit': 'unity',
            'id': {'authority': 'EPSG', 'code': 8805},
          },
          {
            'name': 'False easting',
            'value': 500000,
            'unit': 'metre',
            'id': {'authority': 'EPSG', 'code': 8806},
          },
          {
            'name': 'False northing',
            'value': 0,
            'unit': 'metre',
            'id': {'authority': 'EPSG', 'code': 8807},
          },
        ],
      },
      'coordinate_system': {
        'subtype': 'Cartesian',
        'axis': [
          {
            'name': 'Easting',
            'abbreviation': 'E',
            'direction': 'east',
            'unit': 'metre',
          },
          {
            'name': 'Northing',
            'abbreviation': 'N',
            'direction': 'north',
            'unit': 'metre',
          },
        ],
      },
      'id': {'authority': 'EPSG', 'code': 25832},
    },
    {
      'type': 'VerticalCRS',
      'name': 'DHHN2016 height',
      'datum': {
        'type': 'VerticalReferenceFrame',
        'name': 'Deutsches Haupthoehennetz 2016',
      },
      'coordinate_system': {
        'subtype': 'vertical',
        'axis': [
          {
            'name': 'Gravity-related height',
            'abbreviation': 'H',
            'direction': 'up',
            'unit': 'metre',
          },
        ],
      },
      'id': {'authority': 'EPSG', 'code': 7837},
    },
  ],
};

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
      const projection = await getProjection(
        fakeReference({'proj:wkt2': COMPOUND_BOUND}),
      );
      const [lon, lat] = transform([533000, 5929000], projection, 'EPSG:4326');
      expect(lon).to.be.within(9.49, 9.51);
      expect(lat).to.be.within(53.5, 53.52);
    });

    it('supports WKT2 with alternative keywords in any case', async function () {
      const wkt = COMPOUND_BOUND.replace('COMPOUNDCRS[', 'compoundCrs[')
        .replace('PROJCRS[', 'projectedCRS[')
        .replace('ELLIPSOID[', 'spheroid[')
        .replace('VERTCRS[', 'verticalCRS[');
      const projection = await getProjection(fakeReference({'proj:wkt2': wkt}));
      const [lon, lat] = transform([533000, 5929000], projection, 'EPSG:4326');
      expect(lon).to.be.within(9.49, 9.51);
      expect(lat).to.be.within(53.5, 53.52);
    });

    it('uses the horizontal part of a compound PROJJSON', async function () {
      const projection = await getProjection(
        fakeReference({'proj:projjson': COMPOUND_PROJJSON}),
      );
      const [lon, lat] = transform([533000, 5929000], projection, 'EPSG:4326');
      expect(lon).to.be.within(9.49, 9.51);
      expect(lat).to.be.within(53.5, 53.52);
    });

    it('supports WKT2 with names in any script', async function () {
      const wkt = WKT2_25832.replace(
        'ETRS89 / UTM zone 32N',
        'ETRS89 / UTM 32N 区域',
      );
      const projection = await getProjection(fakeReference({'proj:wkt2': wkt}));
      const [lon] = transform([500000, 0], projection, 'EPSG:4326');
      expect(lon).to.be.within(8.99, 9.01);
    });

    it('rejects reference systems that proj4 can not parse without breaking others', async function () {
      let error = null;
      try {
        await getProjection(fakeReference({'proj:wkt2': 'PROJCRS["a"]'}));
      } catch (e) {
        error = e;
      }
      expect(error.message).to.contain(
        'Unsupported coordinate reference system',
      );
      const projection = await getProjection(
        fakeReference({'proj:wkt2': WKT2_25832}),
      );
      const [lon] = transform([500000, 0], projection, 'EPSG:4326');
      expect(lon).to.be.within(8.99, 9.01);
    });

    it('falls back to the default projection without projection metadata', async function () {
      const projection = await getProjection(fakeReference({}), 'EPSG:4326');
      expect(projection).to.equal('EPSG:4326');
    });
  });
});
