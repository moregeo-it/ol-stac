import { c as register, l as WebGLTileLayer, m as View, o as proj4, s as OSM, t as STACLayer, u as Map } from "./common.js";
//#region examples/stac-item.js
register(proj4);
var layer = new STACLayer({ url: "https://s3.us-west-2.amazonaws.com/sentinel-cogs/sentinel-s2-l2a-cogs/10/T/ES/2022/7/S2A_10TES_20220726_0_L2A/S2A_10TES_20220726_0_L2A.json" });
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
layer.on("layersready", () => {
	for (const sublayer of layer.getLayersArray()) {
		const stac = sublayer.get("stac");
		let title;
		if (stac.isAsset) title = stac.getMetadata("title") || stac.getKey();
		else if (stac.isLink) title = stac.getMetadata("title") || stac.rel || "Unnamed";
		else title = "Footprint";
		sublayer.set("title", title);
	}
});
//#endregion

//# sourceMappingURL=stac-item.js.map