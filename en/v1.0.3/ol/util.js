/**
 * @module ol/util
 */
import Circle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import VectorLayer from 'ol/layer/Vector.js';
import { STAC } from 'stac-js';
import { fromEPSGCode, isRegistered as isProj4Registered, } from 'ol/proj/proj4.js';
/**
 * @typedef {import('ol/colorlike.js').ColorLike} ColorLike
 */
/**
 * @typedef {import('ol/Collection.js').default} Collection
 * @template T
 */
/**
 * @typedef {import('ol/Feature.js').default} Feature
 */
/**
 * The pattern for the supported versions of the label extension.
 * @type {string}
 */
export const LABEL_EXTENSION = 'https://stac-extensions.github.io/label/v1.*/schema.json';
const transparentFill = new Fill({ color: 'rgba(0,0,0,0)' });
/**
 * Creates a style for visualization.
 *
 * @param {ColorLike} strokeColor Stroke color
 * @param {number} strokeWidth Stroke with
 * @param {ColorLike} fillColor Fill color
 * @param {number} circleRadius Circle/Point radius
 * @return {Style} The style for visualization.
 * @api
 */
export function getStyle(strokeColor, strokeWidth, fillColor = 'rgba(255,255,255,0.4)', circleRadius = 5) {
    let fill = transparentFill;
    if (fillColor) {
        fill = new Fill({
            color: fillColor,
        });
    }
    const stroke = new Stroke({
        color: strokeColor,
        width: strokeWidth,
    });
    return new Style({
        image: new Circle({
            fill,
            stroke,
            radius: circleRadius,
        }),
        fill,
        stroke,
    });
}
/**
 * The default style for rendering bounds of the STAC main entities.
 * @type {Style}
 * @api
 */
export const defaultBoundsStyle = getStyle('#3399CC', 3);
/**
 * The default style for rendering collection list children.
 * @type {Style}
 * @api
 */
export const defaultCollectionStyle = getStyle('#ff9933', 2, null);
/**
 * Get the STAC objects associated with this event, if any. Excludes API Collections.
 * @param {import('ol/MapBrowserEvent.js').default} event The asset to read the information from.
 * @param {STAC} [exclude=null] Excludes the given STAC entity from the list.
 * @param {Collection<Feature>} [selectedFeatures=null] A collection to add the selected features to.
 * @param {number} [hitTolerance=0] The hit tolerance in pixels.
 * @return {Promise<Array<STAC>>} A list of STAC objects
 * @api
 */
export async function getStacObjectsForEvent(event, exclude = null, selectedFeatures = null, hitTolerance = 0) {
    const objects = new Set();
    event.map.forEachFeatureAtPixel(event.pixel, 
    // Callback for all features that were found
    (feature, layer) => {
        if (selectedFeatures) {
            selectedFeatures.push(feature);
        }
        objects.add(layer.get('stac'));
    }, {
        // Options for forEachFeatureAtPixel
        hitTolerance,
        // Filter the layers upfront, this ensures the presence of a STAC object
        // so that we don't need to check in the callback above
        layerFilter(layer) {
            if (layer instanceof VectorLayer && layer.get('bounds') === true) {
                const stac = layer.get('stac');
                if (stac instanceof STAC && (!exclude || !stac.equals(exclude))) {
                    return true;
                }
            }
            return false;
        },
    });
    return [...objects];
}
/**
 * Get the source info for the GeoTiff from the asset.
 * @param {import('stac-js').Asset} asset The asset to read the information from.
 * @param {Array<number>} bands The (one-based) bands to show.
 * @return {import('ol/source/GeoTIFF.js').SourceInfo} The source info for the GeoTiff asset
 */
export function getGeoTiffSourceInfoFromAsset(asset, bands) {
    const sourceInfo = {
        url: asset.getAbsoluteUrl(),
    };
    let source = asset;
    // If there's just one band, we can also read the information from there.
    if (asset.getBands().length === 1) {
        source = asset.getBand(0);
    }
    // TODO: It would be useful if OL would allow min/max values per band
    const { minimum, maximum } = source.getMinMaxValues();
    if (typeof minimum === 'number') {
        sourceInfo.min = minimum;
    }
    if (typeof maximum === 'number') {
        sourceInfo.max = maximum;
    }
    // TODO: It would be useful if OL would allow multiple no-data values
    const nodata = source.getNoDataValues();
    if (nodata.length > 0) {
        sourceInfo.nodata = nodata[0];
    }
    if (bands.length > 0) {
        sourceInfo.bands = bands;
    }
    return sourceInfo;
}
/**
 * Gets the projection from the asset or link.
 * @param {import('stac-js').STACReference} reference The asset or link to read the information from.
 * @param {import('ol/proj.js').ProjectionLike} defaultProjection A default projection to use.
 * @return {Promise<import('ol/proj.js').ProjectionLike>} The projection, if any.
 */
export async function getProjection(reference, defaultProjection = undefined) {
    let projection = defaultProjection;
    if (isProj4Registered()) {
        // TODO: It would be great to handle WKT2 and PROJJSON, but is not supported yet by proj4js.
        const code = reference.getMetadata('proj:code');
        if (code) {
            try {
                if (code.startsWith('EPSG:')) {
                    const id = parseInt(code.replace('EPSG:', ''), 10);
                    projection = await fromEPSGCode(id);
                }
            }
            catch (_) {
                // pass
            }
        }
    }
    return projection;
}
/**
 * Returns the style for the footprint.
 * Removes the fill if anything is meant to be shown in the bounds.
 *
 * @param {Style} [originalStyle] The original style for the footprint.
 * @param {import('./layer/STAC.js').default} [layerGroup] The associated STAC layergroup to check.
 * @return {Style} The adapted style for the footprint.
 * @api
 */
export function getBoundsStyle(originalStyle, layerGroup) {
    const style = originalStyle.clone();
    if (!layerGroup.hasOnlyBounds()) {
        style.setFill(transparentFill);
    }
    return style;
}
/**
 * Get a URL from a web-map-link that is specific enough, i.e.
 * replaces any occurances of {s} if possible, otherwise returns null.
 * @param {import('./layer/STAC.js').Link} link The web map link.
 * @return {string|null} Specific URL
 */
export function getSpecificWebMapUrl(link) {
    let url = link.href;
    if (url.includes('{s}')) {
        if (Array.isArray(link['href:servers']) &&
            link['href:servers'].length > 0) {
            const i = (Math.random() * link['href:servers'].length) | 0;
            url = url.replace('{s}', link['href:servers'][i]);
        }
        else {
            return null;
        }
    }
    return url;
}
//# sourceMappingURL=util.js.map