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

ol-stac works best with OpenLayers >= 10.9.0.

It should work with older versions >= 9.0.0, but certain features will be unavailable
or work less reliably, for example:

- Better per-band visualization of GeoTiff files (requires >= 10.9.0)
- Automatic loading of missing projections for GeoTiff files (EPSG code retrieval requires >= 10.0.0, other projection codes require >= 10.8.0)
- GeoZARR support (requires >= 10.8.0)

Generally, we highly recommend to use OpenLayers >= 10.9.0.
If you use an older version, please ensure it works well for your usecases.

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
