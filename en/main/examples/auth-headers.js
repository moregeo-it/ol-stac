import { c as register, l as WebGLTileLayer, m as View, o as proj4, s as OSM, t as STACLayer, u as Map } from "./common.js";
//#region examples/auth-headers.js
register(proj4);
var trustedHosts = ["example.com"];
var layer = new STACLayer({
	url: "https://example.com/stac/item.json",
	getRequestHeaders(ref, url) {
		if (!trustedHosts.includes(new URL(url).host)) return null;
		return { Authorization: "Bearer get_your_own_token" };
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
layer.on("error", (event) => {
	console.error(event.error);
});
//#endregion

//# sourceMappingURL=auth-headers.js.map