import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';
import SourceType from '../src/ol/source/type.js';

register(proj4); // required to support source reprojection

// Listed in the order shown in the list, i.e. the first entry is rendered on top
const entries = [
  {
    title: 'Labels (XYZ web map link)',
    shown: true,
    dataSource: {
      rel: 'xyz',
      href: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      type: 'image/png',
      title: 'Labels',
      attribution: 'Labels © Esri',
    },
  },
  {title: 'Scene classification (asset scl)', shown: false, dataSource: 'scl'},
  {title: 'Near infrared (asset nir)', shown: false, dataSource: 'nir'},
  {title: 'True color (asset visual)', shown: true, dataSource: 'visual'},
];

function getDataSources() {
  return entries
    .filter((entry) => entry.shown)
    .map((entry) => entry.dataSource)
    .reverse();
}

// The item doesn't provide statistics, so the value ranges are set manually.
// Otherwise the whole range of the data type would be used, which renders almost black.
const valueRanges = {
  nir: [0, 5000],
  scl: [0, 11],
};

const layer = new STAC({
  url: 'https://s3.us-west-2.amazonaws.com/sentinel-cogs/sentinel-s2-l2a-cogs/10/T/ES/2022/7/S2A_10TES_20220726_0_L2A/S2A_10TES_20220726_0_L2A.json',
  dataSources: getDataSources(),
  getSourceOptions(type, options, asset) {
    const range = asset.isAsset ? valueRanges[asset.getKey()] : null;
    if (type === SourceType.GeoTIFF && range) {
      for (const source of options.sources) {
        [source.min, source.max] = range;
      }
    }
    return options;
  },
});

const background = new TileLayer({
  source: new OSM(),
});

const map = new Map({
  target: 'map',
  layers: [background, layer],
  view: new View({
    center: [0, 0],
    zoom: 0,
  }),
});

layer.on('sourceready', () => {
  const view = map.getView();
  view.fit(layer.getExtent());
});

const list = document.getElementById('data-sources');

function move(index, offset) {
  const [entry] = entries.splice(index, 1);
  entries.splice(index + offset, 0, entry);
  update();
}

function createButton(text, title, disabled, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-sm btn-outline-secondary ms-1';
  button.textContent = text;
  button.title = title;
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}

function render() {
  list.replaceChildren(
    ...entries.map((entry, index) => {
      const item = document.createElement('li');
      item.className =
        'list-group-item d-flex align-items-center justify-content-between';

      const label = document.createElement('label');
      label.className = 'form-check-label';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'form-check-input me-2';
      checkbox.checked = entry.shown;
      checkbox.addEventListener('change', () => {
        entry.shown = checkbox.checked;
        update();
      });
      label.append(checkbox, entry.title);

      const buttons = document.createElement('span');
      buttons.append(
        createButton('▲', 'Move up', index === 0, () => move(index, -1)),
        createButton('▼', 'Move down', index === entries.length - 1, () =>
          move(index, 1),
        ),
      );

      item.append(label, buttons);
      return item;
    }),
  );
}

function update() {
  render();
  layer.setDataSources(getDataSources());
}

render();
