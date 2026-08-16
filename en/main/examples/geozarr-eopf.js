import { c as register, l as WebGLTileLayer, m as View, o as proj4, s as OSM, t as STACLayer, u as Map } from "./common.js";
//#region examples/geozarr-eopf.js
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
var select = document.getElementById("url-select");
var input = document.getElementById("custom-url");
var button = document.getElementById("load-url");
var min = document.getElementById("min");
var max = document.getElementById("max");
var layer;
updateLayer();
function getUrl() {
	return select.value === "custom" ? input.value : select.value;
}
function getStyle() {
	return { color: [
		"color",
		[
			"interpolate",
			["linear"],
			["band", 1],
			parseFloat(min.value),
			0,
			parseFloat(max.value),
			255
		],
		[
			"interpolate",
			["linear"],
			["band", 2],
			parseFloat(min.value),
			0,
			parseFloat(max.value),
			255
		],
		[
			"interpolate",
			["linear"],
			["band", 3],
			parseFloat(min.value),
			0,
			parseFloat(max.value),
			255
		]
	] };
}
function updateLayer() {
	if (layer) map.removeLayer(layer);
	layer = new STACLayer({
		url: getUrl(),
		style: getStyle()
	});
	layer.on("sourceready", () => {
		map.getView().fit(layer.getExtent());
	});
	layer.on("error", (event) => {
		alert("An unexpected error occurred: " + event.error.message);
	});
	map.addLayer(layer);
	return layer;
}
button.addEventListener("click", updateLayer);
select.addEventListener("change", () => {
	if (select.value === "custom") {
		input.style.display = "";
		input.focus();
	} else input.style.display = "none";
});
min.addEventListener("change", () => {
	layer.setStyle(getStyle());
});
max.addEventListener("change", () => {
	layer.setStyle(getStyle());
});
//#endregion

//# sourceMappingURL=geozarr-eopf.js.map