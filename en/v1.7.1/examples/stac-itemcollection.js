import { c as register, i as getStacObjectsForEvent, l as WebGLTileLayer, m as View, o as proj4, s as OSM, t as STACLayer, u as Map } from "./common.js";
//#region examples/stac-itemcollection.js
register(proj4);
var layer = new STACLayer({
	url: "https://earth-search.aws.element84.com/v1/search?bbox=-16.9,12.85,-14.9,13.97&collections=sentinel-2-c1-l2a&limit=12",
	displayPreview: true
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
map.on("singleclick", async (event) => {
	const objects = await getStacObjectsForEvent(event);
	if (objects.length > 0) {
		const ids = objects.map((obj) => obj.properties.productIdentifier);
		document.getElementById("ids").innerText = ids.join(", ");
	}
});
layer.on("sourceready", () => {
	map.getView().fit(layer.getExtent());
});
//#endregion

//# sourceMappingURL=stac-itemcollection.js.map