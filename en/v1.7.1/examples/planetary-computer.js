import { a as SourceType, c as register, l as WebGLTileLayer, m as View, o as proj4, s as OSM, t as STACLayer, u as Map } from "./common.js";
//#region examples/planetary-computer.js
register(proj4);
/**
* Get a Shared Access Signature Token to authorize asset requests.
* See https://planetarycomputer.microsoft.com/docs/concepts/sas/
* @param {string} href The unsigned URL.
* @return {Promise<string>} A promise for the signed URL.
*/
async function sign(href) {
	const params = new URLSearchParams({ href });
	return (await (await fetch(`https://planetarycomputer.microsoft.com/api/sas/v1/sign?${params}`)).json()).href;
}
var layer = new STACLayer({
	url: "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2B_MSIL2A_20220909T185929_R013_T10TES_20220910T222807",
	assets: ["visual"],
	async getSourceOptions(type, options) {
		if (type === SourceType.GeoTIFF) for (const source of options.sources) source.url = await sign(source.url);
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

//# sourceMappingURL=planetary-computer.js.map