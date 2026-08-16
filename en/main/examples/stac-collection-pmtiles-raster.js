import { c as register, l as WebGLTileLayer, m as View, o as proj4, s as OSM, t as STACLayer, u as Map } from "./common.js";
//#region examples/stac-collection-pmtiles-raster.js
register(proj4);
var layer = new STACLayer({
	displayWebMapLink: "pmtiles",
	data: {
		"stac_version": "1.0.0",
		"stac_extensions": ["https://stac-extensions.github.io/web-map-links/v1.2.0/schema.json"],
		"type": "Collection",
		"id": "dem",
		"description": "DEM of the world",
		"license": "proprietary",
		"attribution": "see <a href=\"https://github.com/tilezen/joerd/blob/master/docs/attribution.md\">tilezen/joerd</a>",
		"extent": {
			"spatial": { "bbox": [[
				-180,
				-90,
				180,
				90
			]] },
			"temporal": { "interval": [[null, null]] }
		},
		"links": [{
			"href": "https://r2-public.protomaps.com/protomaps-sample-datasets/terrarium_z9.pmtiles",
			"rel": "pmtiles",
			"type": "application/vnd.pmtiles",
			"pmtiles:layers": ["dem"]
		}]
	}
});
var background = new WebGLTileLayer({ source: new OSM() });
var map = new Map({
	target: "map",
	layers: [background, layer],
	view: new View({
		center: [0, 0],
		zoom: 0
	})
});
layer.on("sourceready", () => {
	map.getView().fit(layer.getExtent());
});
//#endregion

//# sourceMappingURL=stac-collection-pmtiles-raster.js.map