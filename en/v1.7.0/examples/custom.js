import { c as register, l as WebGLTileLayer, m as View, o as proj4, s as OSM, t as STACLayer, u as Map } from "./common.js";
//#region examples/custom.js
register(proj4);
var background = new WebGLTileLayer({ source: new OSM() });
var map = new Map({
	target: "map",
	layers: [background],
	view: new View({
		center: [0, 0],
		zoom: 0
	})
});
window.onload = function() {
	document.getElementById("load-btn").addEventListener("click", showUrl);
	document.getElementById("reset-btn").addEventListener("click", resetUrl);
	showUrl();
};
var layer;
function resetUrl() {
	document.getElementById("url-input").value = "";
	showUrl();
}
function showUrl() {
	if (layer) map.removeLayer(layer);
	const url = document.getElementById("url-input").value;
	if (!url) return;
	layer = new STACLayer({
		url,
		displayPreview: true,
		displayGeoTiffByDefault: true,
		displayWebMapLink: true
	});
	layer.on("sourceready", () => {
		map.getView().fit(layer.getExtent());
	});
	layer.on("layersready", () => {
		if (layer.isEmpty()) alert("No spatial information available in the data source");
	});
	layer.on("error", (event) => {
		console.trace(event);
		alert(`Error loading STAC data: ${event.error}`);
	});
	map.addLayer(layer);
}
//#endregion

//# sourceMappingURL=custom.js.map