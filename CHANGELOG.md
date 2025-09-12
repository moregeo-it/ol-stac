# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.4] - 2025-09-12

- Avoid duplicate updating of layers
- Allow manual update of layers
- Flag to omit events

## [1.0.3] - 2025-08-12

- Avoid duplicate layers on first load
- Make WMTS handling more robust

## [1.0.2] - 2025-07-12

- Set `convertToRGB` option for GeoTIFF sources to `auto`

## [1.0.1] - 2025-07-09

- Only use the `url` option for non-stac-js objects
- Fix clipping outside of bbox

## [1.0.0] - 2025-07-05

- `childrenOptions` get lost when using `setChildren`
- Fixed various examples
- Updated ol-pmtiles and stac-js

## [1.0.0-rc.10] - 2025-03-06

- `getStacObjectsForEvent`: Detection works correctly for polygons without a fill

## [1.0.0-rc.9] - 2025-02-14

- Pass `useTileLayerAsFallback` and `buildTileUrlTemplate` options to the layer of childrens

## [1.0.0-rc.8] - 2025-02-03

- `getExtent`: Compute extent correctly when children are provided but no parent
- `buildTileUrlTemplate` supports async functions

## [1.0.0-rc.7] - 2025-01-29

- Parameter to retrieve the features through `getStacObjectsForEvent`
- Parameter to set the hit tolerance for `getStacObjectsForEvent`
- Properly visualize (GeoJSON) points and multi-points
- Don't import from barrel files, see <https://github.com/openlayers/openlayers/issues/16461>

## [1.0.0-rc.6] - 2025-01-28

- Fix adding children through `setChildren`

## [1.0.0-rc.5] - 2025-01-27

- Fix `isEmpty`

## [1.0.0-rc.4] - 2025-01-27

- Fix GeoJSON coordinates before projection
- Ensure bounding boxes are valid
- STAC Collection with Items example shows all items correctly
- Support for visualizing Items that implement the label extension (vector only)

## [1.0.0-rc.3] - 2025-01-26

- Support visualizing GeoJSON
- Replaced event `assetsready` with `layersready`
- Add methods `isEmpty`
- Make events always fire the earliest after the contstructor has been executed

## [1.0.0-rc.2] - 2025-01-25

- Fix setting the `stac` property for children
- Allow to set specific options for children
- Update stac-js to only return 2D bounding boxes
- Better prioritize what is shown from user input or by default

## [1.0.0-rc.1] - 2025-01-25

- Add `disableMigration` option
- Only show preview image if a single bbox is given
- Set `stac` property for the layer group
- Don't add children multiple times on subsequent `setChildren` calls

## [1.0.0-beta.12] - 2025-01-24

- STAC 1.1 support
- Handling of default GeoTiff and previews improved
- `displayPreview` and `displayOverview` have no influence on setting specific assets via `assets`
- Fallback mechanism to tile servers improved
- Doesn't filter previews with additional role `example` by default
- Fix PMTiles CORS errors in examples

## [1.0.0-beta.11] - 2025-01-23

- Allow to pass in children that are visualized as part of the Catalog/Collection
- Added parameter to `getStacObjectsForEvent` to exclude a STAC entity
- Default stroke width for children is 2 instead of 1
- Added methods `getChildren` and `setChildren`
- Added example that shows a collection with its children
- Add `getAttirbutions` to get attribution from STAC entity

## [1.0.0-beta.10] - 2024-04-10

- Correctly create WMS links if styles and/or layers are not provided

## [1.0.0-beta.9] - 2024-03-08

- Allow a list of web map links to be shown through the `displayWebMapLink` option,
  which includes selecting links by id.
- Require ol >= 7.5.2 (before: >= 7.0.0)

## [1.0.0-beta.8] - 2024-01-30

- Fixes the broken 1.0.0-beta.7 release
- Update stac-js dependency to 0.0.9

## [1.0.0-beta.7] - 2024-01-26

- Added an option to hide footprints (geometry/bounding box) by default
- Added support for image formats in WMS and WMTS
- Expose `SourceType` as public API
- Removed note about Firefox issues in the examples

## [1.0.0-beta.6] - 2023-08-28

- OpenLayers is now a peer dependency
- Add support for PMTiles (via Web Map Links extension)
- New general purpose option `getSourceOptions(type, options, ref)` to customize source options.
   It also applies to all web-map-link source options now.
   It replaces:
   - `getGeoTIFFSourceOptions(options, ref)`
   - `getImageStaticSourceOptions(options, ref)`
   - `getXYZSourceOptions(options, ref)`
- Added `SourceType` enum for `getSourceOptions`

## [1.0.0-beta.5] - 2023-08-23

- Don't enforce the nodata value to be `NaN` if not present in STAC metadata

## [1.0.0-beta.4] - 2023-08-22

- Fix the default entry point (you can now really use `import STAC from 'ol-stac';`)

## [1.0.0-beta.3] - 2023-08-22

- Pass `properties` option to the LayerGroup.

## [1.0.0-beta.2] - 2023-08-22

- Move the `stacUtils.js` from `ol/layer` to `ol-stac/utils.js`
- Provide a default entry point (you can now use `import STAC from 'ol-stac';`)
- Documentation improvements

## [1.0.0-beta.1] - 2023-08-22

- First release

[Unreleased]: <https://github.com/stac-extensions/contacts/compare/v1.0.4...HEAD>
[1.0.4]: <https://github.com/stac-extensions/contacts/compare/v1.0.3...v1.0.4>
[1.0.3]: <https://github.com/stac-extensions/contacts/compare/v1.0.2...v1.0.3>
[1.0.2]: <https://github.com/stac-extensions/contacts/compare/v1.0.1...v1.0.2>
[1.0.1]: <https://github.com/stac-extensions/contacts/compare/v1.0.0...v1.0.1>
[1.0.0]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-rc.10...v1.0.0>
[1.0.0-rc.10]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-rc.9...v1.0.0-rc.10>
[1.0.0-rc.9]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-rc.8...v1.0.0-rc.9>
[1.0.0-rc.8]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-rc.7...v1.0.0-rc.8>
[1.0.0-rc.7]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-rc.6...v1.0.0-rc.7>
[1.0.0-rc.6]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-rc.5...v1.0.0-rc.6>
[1.0.0-rc.5]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-rc.4...v1.0.0-rc.5>
[1.0.0-rc.4]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-rc.3...v1.0.0-rc.4>
[1.0.0-rc.3]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-rc.2...v1.0.0-rc.3>
[1.0.0-rc.2]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-rc.1...v1.0.0-rc.2>
[1.0.0-rc.1]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-beta.12...v1.0.0-rc.1>
[1.0.0-beta.12]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-beta.11...v1.0.0-beta.12>
[1.0.0-beta.11]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-beta.10...v1.0.0-beta.11>
[1.0.0-beta.10]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-beta.9...v1.0.0-beta.10>
[1.0.0-beta.9]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-beta.8...v1.0.0-beta.9>
[1.0.0-beta.8]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-beta.7...v1.0.0-beta.8>
[1.0.0-beta.7]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-beta.6...v1.0.0-beta.7>
[1.0.0-beta.6]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-beta.5...v1.0.0-beta.6>
[1.0.0-beta.5]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-beta.4...v1.0.0-beta.5>
[1.0.0-beta.4]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-beta.3...v1.0.0-beta.4>
[1.0.0-beta.3]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-beta.2...v1.0.0-beta.3>
[1.0.0-beta.2]: <https://github.com/stac-extensions/contacts/compare/v1.0.0-beta.1...v1.0.0-beta.2>
[1.0.0-beta.1]: <https://github.com/stac-extensions/contacts/tree/v1.0.0-beta.1>
