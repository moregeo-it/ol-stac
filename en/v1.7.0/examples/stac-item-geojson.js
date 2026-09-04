import { c as register, l as WebGLTileLayer, m as View, o as proj4, s as OSM, t as STACLayer, u as Map } from "./common.js";
//#region examples/stac-item-geojson.js
register(proj4);
var layer = new STACLayer({
	url: "https://transfer.data.aad.gov.au/aadc-aerial-photography/casc8916/collection.json",
	assets: ["flightline-1", "flightline-2"]
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

//# sourceMappingURL=stac-item-geojson.js.map