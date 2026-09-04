import { c as register, d as Style, f as Stroke, h as fromLonLat, l as WebGLTileLayer, m as View, n as LayerType, o as proj4, p as Fill, s as OSM, t as STACLayer, u as Map } from "./common.js";
//#region examples/stac-collection-pmtiles-vector.js
register(proj4);
var layer = new STACLayer({
	displayWebMapLink: "pmtiles",
	displayFootprint: false,
	getLayerOptions(type, options) {
		if (type === LayerType.VectorTile) options.style = new Style({
			fill: new Fill({ color: "rgba(255, 0, 0, 0.8)" }),
			stroke: new Stroke({
				color: "#990000",
				width: 1
			})
		});
		return options;
	},
	data: {
		"stac_version": "1.1.0",
		"stac_extensions": ["https://stac-extensions.github.io/web-map-links/v1.2.0/schema.json"],
		"type": "Collection",
		"id": "Overture Maps Buildings",
		"description": "The Overture Maps buildings theme describes human-made structures with roofs or interior spaces that are permanently or semi-permanently in one place. Hosted on Source Cooperative.",
		"license": "ODbL",
		"attribution": "© Overture Maps Foundation",
		"extent": {
			"spatial": { "bbox": [[
				-180,
				-83.66,
				180,
				82.53
			]] },
			"temporal": { "interval": [["2023-07-26T00:00:00Z", null]] }
		},
		"links": [{
			"href": "https://data.source.coop/cholmes/overture/overture-buildings.pmtiles",
			"rel": "pmtiles",
			"type": "application/vnd.pmtiles",
			"title": "Buildings"
		}]
	}
});
var background = new WebGLTileLayer({ source: new OSM() });
new Map({
	target: "map",
	layers: [background, layer],
	view: new View({
		center: fromLonLat([7.6261, 51.9607]),
		zoom: 15
	})
});
//#endregion

//# sourceMappingURL=stac-collection-pmtiles-vector.js.map