# ZBGIS waterway names downloader

Script downloads names of OSM waterways without name tag from ZBGIS WMS using GetFeatureInfo.

## Installation

Install Node 14, clone the repository and install libraries with `npm i`.

### Usage

```
node . left bottom right top > output.geojson
```

Example:

```
node . 20.51 48.52 21.23 49.45 > snv.geojson
```

Process writes its progress to stderr and GeoJSON output to stdout.

Resulting GeoJSON will contain points (nodes) located in the middle of the waterway segments and will have a name property.
