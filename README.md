# leaflet-freeze
>


## Description
Plugin for leaflet that freeze and thaw the leaflet map and all layers/objects on it

## Installation
### bower
`bower install https://github.com/FCOO/leaflet-freeze.git --save`

## Demo
http://FCOO.github.io/leaflet-freeze/demo/ 

## Usage

	map.freeze( [options] )
will prevent popup, contextmenu, click (optional), pan (optional) and zoom (optional) on the map and prevent popup, contextmenu, mouseover, mouseout, and dragging on the layers/objects on the map


	map.thaw();
will reset the map and the layers/objects



### options
| Id | Type | Default | Description |
| :--: | :--: | :-----: | --- |
| `allowZoomAndPan` | boolean | false | Allows zooming and panning on the map. If false the zoom-control is hidden
| `allowClick` | boolean | false | Allows click on the map (but not on the layers) |
| `hideControls` | boolean | false | Hide all controls incl. zoom-control even if `options.allowZoomAndPan == true`|
| `hidePopups` | boolean | true | Close all open popups |
| `beforeFreeze` | function| null | Called before the map is 'freezed'
| `afterThaw` | function| null | Called after the map is 'thawed'


## Copyright and License
This plugin is licensed under the [MIT license](https://github.com/FCOO/leaflet-freeze/LICENSE).

Copyright (c) 2015 [FCOO](https://github.com/FCOO)

## Contact information

[Niels Holt](http://github.com/NielsHolt)

