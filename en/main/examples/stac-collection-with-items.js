import { c as register, i as getStacObjectsForEvent, l as WebGLTileLayer, m as View, o as proj4, s as OSM, t as STACLayer, u as Map } from "./common.js";
//#region examples/stac-collection-with-items.js
register(proj4);
var layer = new STACLayer({
	url: "https://planetarycomputer.microsoft.com/api/stac/v1/collections/esa-cci-lc",
	displayPreview: false
});
var background = new WebGLTileLayer({ source: new OSM() });
var map = new Map({
	target: "map",
	layers: [background, layer],
	view: new View({
		center: [0, 0],
		zoom: 0,
		showFullExtent: true
	})
});
map.on("singleclick", async (event) => {
	const objects = await getStacObjectsForEvent(event, layer.getData());
	if (objects.length > 0) {
		const ids = objects.map((obj) => obj.id);
		document.getElementById("ids").innerText = ids.join(", ");
	}
});
layer.on("sourceready", () => {
	map.getView().fit(layer.getExtent());
});
fetch("https://planetarycomputer.microsoft.com/api/stac/v1/collections/esa-cci-lc/items?datetime=2020-01-01T00%3A00%3A00.000Z%2F2020-12-31T00%3A00%3A00.000Z&limit=32").then((response) => response.json()).then((items) => {
	layer.setChildren(items, { displayPreview: true });
}).catch((error) => {
	alert("Error fetching items:" + error.message);
});
//#endregion

//# sourceMappingURL=stac-collection-with-items.js.map