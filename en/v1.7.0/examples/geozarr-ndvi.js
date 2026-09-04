import { c as register, l as WebGLTileLayer, m as View, n as LayerType, o as proj4, s as OSM, t as STACLayer, u as Map } from "./common.js";
//#region examples/geozarr-ndvi.js
register(proj4);
var selectedBands = ["b04", "b08"];
/**
* Creates an NDVI style for the given asset. Which of the selected bands is
* red and which is near-infrared is derived from the band metadata of the
* STAC asset (`eo:common_name`) instead of being hard-coded.
* @param {import('stac-js').Asset} asset The STAC asset.
* @return {import('ol/layer/WebGLTile.js').Style|undefined} The style.
*/
function createNdviStyle(asset) {
	const bands = asset.getBands();
	const bandIndex = (commonName) => {
		const band = bands.find((candidate) => candidate.getMetadata("eo:common_name") === commonName);
		return band ? selectedBands.indexOf(band.name) + 1 : 0;
	};
	const red = bandIndex("red");
	const nir = bandIndex("nir");
	if (!red || !nir) return;
	return { color: [
		"interpolate",
		["linear"],
		[
			"/",
			[
				"-",
				["band", nir],
				["band", red]
			],
			[
				"+",
				["band", nir],
				["band", red]
			]
		],
		-.2,
		"#a50026",
		0,
		"#f46d43",
		.2,
		"#fee08b",
		.4,
		"#a6d96a",
		.6,
		"#1a9850",
		.8,
		"#006837"
	] };
}
var layer = new STACLayer({
	url: "https://api.explorer.eopf.copernicus.eu/stac/collections/sentinel-2-l2a/items/S2C_MSIL2A_20260414T114351_N0512_R123_T30VVK_20260414T164110",
	assets: ["reflectance"],
	bands: selectedBands,
	async getLayerOptions(type, options, asset) {
		if (type === LayerType.WebGLTile) {
			const style = createNdviStyle(asset);
			if (style) options.style = style;
		}
		return options;
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

//# sourceMappingURL=geozarr-ndvi.js.map