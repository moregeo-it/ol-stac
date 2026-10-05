import { c as register, l as WebGLTileLayer, m as View, o as proj4, s as OSM, t as STACLayer, u as Map } from "./common.js";
//#region examples/stac-item-labels.js
register(proj4);
var layer = new STACLayer({
	url: "https://raw.githubusercontent.com/stac-extensions/label/refs/heads/main/examples/spacenet-roads/roads_item.json",
	displayGeoTiffByDefault: true
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

//# sourceMappingURL=stac-item-labels.js.map