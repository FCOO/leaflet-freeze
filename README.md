# leaflet-freeze
Plugin for leaflet that freeze and thaw the leaflet map and all layers/objects on it
## Usage
```map.freeze( [options] )``` will prevent popup, contextmenu, click (optional), pan (optional) and zoom (optional) on the map and prevent popup, contextmenu, mouseover, mouseout, and dragging on the layers/objects on the map

```map.thaw();``` will reset the map and the layers/objects

### options
`allowZoom` (boolean) Allows zooming on the map

`allowPan` (boolean) Allows panning on the map

`allowClick` (boolean) Allows click on the map (but not on the layers)

`beforeFreeze` (function) Called before the map is 'freezed'

`afterThaw` (function) Called after the map is 'thawed'

