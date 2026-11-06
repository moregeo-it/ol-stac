# ol-stac

An "automagical" STAC LayerGroup for OpenLayers released under the [Apache 2.0 license](LICENSE.md).

![Test Status](https://github.com/moregeo-it/ol-stac/workflows/Test/badge.svg)

## Getting Started

Please read the Quick Start first:
<https://ol-stac.moregeo.it/doc/quickstart.html>

Explore the examples to get started with some more code:
<https://ol-stac.moregeo.it/en/latest/examples/>

Dig into the API documentation for all details:
<https://ol-stac.moregeo.it/en/latest/apidoc/>

### OpenLayers versions

ol-stac works best with OpenLayers >= 10.10.0.

It should work with older versions >= 9.0.0, but certain features will be unavailable
or work less reliably, for example:

- Better no-data/transparency handling (requires >= 10.10.0)
- Better per-band visualization of GeoTiff files (requires >= 10.9.0)
- Automatic loading of missing projections for GeoTiff files (EPSG code retrieval requires >= 10.0.0, other projection codes require >= 10.8.0)
- GeoZARR support (requires >= 10.8.0)

Generally, we highly recommend to use OpenLayers >= 10.9.0.
If you use an older version, please ensure it works well for your usecases.

Older versions of ol-stac (< 1.3.0) support OpenLayers >= 7.5.2.

### Point clouds

Point clouds in the Cloud Optimized Point Cloud (COPC) format are rendered with the
`COPCSource` and `COPCLayer`, which ol-stac uses for COPC assets automatically.
The points can be shown top-down or in a tilted view (see the `tilt` option).

- Requires WebGL 2, works with all supported OpenLayers versions (>= 9.0.0).
- The points are decompressed in web workers that are created from `blob:` URLs, as in OpenLayers.
  If you use a Content Security Policy, allow them with `worker-src blob:`.
- The projection of the point cloud and of the map must be registered with proj4 (`register(proj4)`).

## Sponsors

ol-stac appreciates contributions of all kinds.

The development of this package was financially supported by:

- [Planet Labs PBC](https://planet.com)
- [EOX IT Services GmbH](https://eox.at)

Many thanks also to OpenLayers and its contributors.

[If you need any help, please contact me.](https://moregeo.it)

## TypeScript support

The [ol-stac package](https://npmjs.com/package/ol-stac) includes auto-generated TypeScript declarations as `*.d.ts` files.

## Documentation

Check out the [hosted examples](https://ol-stac.moregeo.it/en/latest/examples/) or the [API documentation](https://ol-stac.moregeo.it/en/latest/apidoc/).

## Bugs

Please use the [GitHub issue tracker](https://github.com/moregeo-it/ol-stac/issues) for all bugs and feature requests. Before creating a new issue, do a quick search to see if the problem has been reported already.

## Related work

A similar package for Leaflet and authored by Daniel Dufour and Matthias Mohr is
[stac-layer](https://github.com/stac-utils/stac-layer).
It has a very similar interface and functionality.
