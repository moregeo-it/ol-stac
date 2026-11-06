import { a as SourceType, c as register, l as WebGLTileLayer, m as View, o as proj4, s as OSM, t as STACLayer, u as Map } from "./common.js";
// examples/stac-item-data-sources.js
register(proj4);
var entries = [
	{
		title: "Labels (XYZ web map link)",
		shown: true,
		dataSource: {
			rel: "xyz",
			href: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
			type: "image/png",
			title: "Labels",
			attribution: "Labels © Esri"
		}
	},
	{
		title: "Scene classification (asset scl)",
		shown: false,
		dataSource: "scl"
	},
	{
		title: "Near infrared (asset nir)",
		shown: false,
		dataSource: "nir"
	},
	{
		title: "True color (asset visual)",
		shown: true,
		dataSource: "visual"
	}
];
function getDataSources() {
	return entries.filter((entry) => entry.shown).map((entry) => entry.dataSource).reverse();
}
var valueRanges = {
	nir: [0, 5e3],
	scl: [0, 11]
};
var layer = new STACLayer({
	url: "https://s3.us-west-2.amazonaws.com/sentinel-cogs/sentinel-s2-l2a-cogs/10/T/ES/2022/7/S2A_10TES_20220726_0_L2A/S2A_10TES_20220726_0_L2A.json",
	dataSources: getDataSources(),
	getSourceOptions(type, options, asset) {
		const range = asset.isAsset ? valueRanges[asset.getKey()] : null;
		if (type === SourceType.GeoTIFF && range) for (const source of options.sources) [source.min, source.max] = range;
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
var list = document.getElementById("data-sources");
function move(index, offset, control) {
	const [entry] = entries.splice(index, 1);
	entries.splice(index + offset, 0, entry);
	update(entry, control);
}
function createButton(text, title, disabled, onClick) {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "btn btn-sm btn-outline-secondary ms-1";
	button.textContent = text;
	button.title = title;
	button.disabled = disabled;
	button.addEventListener("click", onClick);
	return button;
}
/**
* @param {Object} [focusEntry] The entry whose control should keep the focus.
* @param {string} [focusControl] The control to focus: `checkbox`, `up` or `down`.
*/
function render(focusEntry, focusControl) {
	const controls = entries.map((entry, index) => {
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.className = "form-check-input me-2";
		checkbox.checked = entry.shown;
		checkbox.addEventListener("change", () => {
			entry.shown = checkbox.checked;
			update(entry, "checkbox");
		});
		return {
			entry,
			checkbox,
			up: createButton("▲", "Move up", index === 0, () => move(index, -1, "up")),
			down: createButton("▼", "Move down", index === entries.length - 1, () => move(index, 1, "down"))
		};
	});
	list.replaceChildren(...controls.map(({ entry, checkbox, up, down }) => {
		const item = document.createElement("li");
		item.className = "list-group-item d-flex align-items-center justify-content-between";
		const label = document.createElement("label");
		label.className = "form-check-label";
		label.append(checkbox, entry.title);
		const buttons = document.createElement("span");
		buttons.append(up, down);
		item.append(label, buttons);
		return item;
	}));
	const focused = controls.find(({ entry }) => entry === focusEntry);
	if (focused) {
		let control = focused[focusControl];
		if (control.disabled) control = focusControl === "up" ? focused.down : focused.up;
		control.focus();
	}
}
function update(focusEntry, focusControl) {
	render(focusEntry, focusControl);
	layer.setDataSources(getDataSources());
}
layer.on("sourceready", () => {
	map.getView().fit(layer.getExtent());
	render();
});

//# sourceMappingURL=stac-item-data-sources.js.map