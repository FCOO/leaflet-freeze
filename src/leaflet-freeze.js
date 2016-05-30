/****************************************************************************
	leaflet-freeze.js,

	(c) 2016, FCOO

	https://github.com/FCOO/leaflet-freeze
	https://github.com/FCOO

Extend with two new functions: freeze and thaw.
map.freeze( options ) will prevent dragging, contextmenu, popup, click, zoom (optional) and pan (optional) on the map and all layers/object.

When the map is 'frozen' the <body>-element get a classname 'map-is-frozen'

map.thaw() will undo the locking done by map.freeze(..)

options:
	allowZoom		: boolean. If true zoom is allowed
	allowPan  	: boolean. If true pan is allowed
	allowClick	: boolean. If true click (on the map) is allowed
	beforeFreeze: function(map, options) (optional) to be called before the freezing
	afterThaw		: function(map, options) (optional) to be called after the thawing
****************************************************************************/

(function (L, window, document, undefined) {
	"use strict";

	var mapIsFrozen = false,
			defaultOptions = {
				allowZoom		: false,
				allowPan  	: false,
				allowClick	: false,
				hideControls: true,
				hidePopups	: true,
				beforeFreeze: null,
				afterThaw		: null
			};

	//Replace some common functions called by mouse-events
	var createAlteredFunction = function( originalFunc ){
		return function( e ){
			if (mapIsFrozen){ return false; }
			originalFunc.call(this, e);
		};
	};

	L.Marker.prototype._bringToFront = createAlteredFunction( L.Marker.prototype._bringToFront );
	L.Marker.prototype._resetZIndex = createAlteredFunction( L.Marker.prototype._resetZIndex );
	L.Marker.prototype._onMouseClick = createAlteredFunction( L.Marker.prototype._onMouseClick );
	L.Marker.prototype._onKeyPress  = createAlteredFunction( L.Marker.prototype._onKeyPress  );

	L.Map.include({
		/*********************************************
		freeze
		*********************************************/
		freeze: function( options ){

			L.DomUtil.addClass(window.document.body, 'map-is-frozen');

			options = L.Util.extend( defaultOptions, options );

			if (options.beforeFreeze)
				options.beforeFreeze(this, options);

			this._freezeOptions = {};
			this._freezeOptions.options = options;

			//Remove the cursor.grab if pan is frozen
			this._freezeOptions.map_cursor_style = this.getContainer().style.cursor;
			if (!options.allowPan)
				this.getContainer().style.cursor = 'default';

			//Block for zoom and remove the zoom-control if zoom isn't allowed
			if (!options.allowZoom){
				this._freezeOptions.getMinZoom = this.getMinZoom;
				this._freezeOptions.getMaxZoom = this.getMaxZoom;
				this.getMinZoom = function(){ return this.getZoom(); };
				this.getMaxZoom = this.getMinZoom;

				if (this.zoomControl){
				  this._freezeOptions.zoomControl_style_display = this.zoomControl._container.style.display;
				  this.zoomControl._container.style.display = 'none';
				}

			}

			//Hide all controls
			if (options.hideControls){
			  this._freezeOptions._controlContainer_style_display = this._controlContainer.style.display;
			  this._controlContainer.style.display = 'none';
			}



			this._freeze(options);

			mapIsFrozen = true;
console.log(this);

			if (options.afterThaw){
				this.once('afterThaw', options.afterThaw);
			}
		},

		/*********************************************
		thaw
		*********************************************/
		thaw: function(){
			//Reset cursor
				this.getContainer().style.cursor = this._freezeOptions.map_cursor_style;

			//Reset zoom
			if (!this._freezeOptions.options.allowZoom){
				this.getMinZoom = this._freezeOptions.getMinZoom;
				this.getMaxZoom = this._freezeOptions.getMaxZoom;

				if (this.zoomControl)
				  this.zoomControl._container.style.display = this._freezeOptions.zoomControl_style_display;
			}

			if (this._freezeOptions.options.hideControls)
			  this._controlContainer.style.display = this._freezeOptions._controlContainer_style_display;


			//Enable all events
			this._thaw();

			L.DomUtil.removeClass(window.document.body, 'map-is-frozen');

			mapIsFrozen = false;

			this.fire('afterThaw');
		}

	});

	L.Class.include({
		/*
		_freeze
		*/
		_freeze: function( options ){
			function freezeIHandler( iHandlers ) {
				for (var i=0; i<iHandlers.length; i++ ){
					var iHandler = iHandlers[i];
					if (iHandler){
						iHandler.enableOnThaw = iHandler._enabled || (iHandler.enabled && iHandler.enabled());
						iHandler.disable();
						iHandler.frozen = true;
					}
				}
			}

			//Remove class="leaflet-clickable" from the different variations  of 'container'
			this.clickableElementWhenThaw = this._icon || this._path || this._container;
			if (this.clickableElementWhenThaw){


				if ( L.DomUtil.hasClass(this.clickableElementWhenThaw, 'leaflet-clickable') ){
					L.DomUtil.removeClass(this.clickableElementWhenThaw, 'leaflet-clickable');
				} else {
					this.clickableElementWhenThaw = null;
				}
			}

			//Disable the different iHandlers
			freezeIHandler( [this.keyboard, this.tap]);
			if (!options.allowZoom){
				freezeIHandler( [this.touchZoom, this.doubleClickZoom, this.scrollWheelZoom, this.boxZoom]);
			}
			if (!options.allowPan){
				freezeIHandler( [this.dragging]);
			}

			if (options.hidePopups && this.closePopup){
				this.closePopup();
			}

			if (this.hasEventListeners){
				this.disabledEvents = {click:!options.allowClick, dblclick:true, preclick:true, contextmenu:true, mouseover:true, mouseout:true };

				this._save_hasEventListeners = this.hasEventListeners;
				this.hasEventListeners = this._hasEventListenersWhenDisabled;

				this._save_fireEvent = this.fireEvent;
				this.fireEvent = this._fireEventWhenDisabled;

				this._save_fire = this.fire;
				this.fire = this._fireEventWhenDisabled;
			}

			if (this.eachLayer)
				this.eachLayer( function(layer){
					layer._freeze({});
				});
		},

		/*
		_thaw
		*/
		_thaw: function( ){
			//Enabled any IHandler, that was disabled
			var iHandlers = [this.dragging, this.touchZoom, this.doubleClickZoom, this.scrollWheelZoom, this.boxZoom, this.keyboard, this.tap];
			for (var i=0; i<iHandlers.length; i++ ){
				var iHandler = iHandlers[i];
				if (iHandler && iHandler.frozen){
					if (iHandler.enableOnThaw)
					  iHandler.enable();
					iHandler.frozen = false;
				}
			}

			//Add class=leaflet-clicable again
			if (this.clickableElementWhenThaw)
				L.DomUtil.addClass(this.clickableElementWhenThaw,  'leaflet-clickable');


			if (this.disabledEvents){
				this.hasEventListeners = this._save_hasEventListeners;
				this.fireEvent	= this._save_fireEvent;
				this.fire				= this._save_fire;
				this.disabledEvents = null;
			}
			if (this.eachLayer)
				this.eachLayer( function(layer){ layer._thaw(); } );
		},

		/*
		_hasEventListenersWhenDisabled
		Internal new version of hasEventListeners filtering the type of events.
		Always allow 'contextmenu' because it is catched by _fireEventWhenDisabled
		*/
		_hasEventListenersWhenDisabled: function( type ){
			if ((type!='contextmenu') && this.disabledEvents && this.disabledEvents[type])
				return false;
			return L.Mixin.Events.hasEventListeners.call( this, type );
		},

		/*
		_fireEventWhenDisabled
		Internal new version of fireEvent to catch 'contextmenu' events
		*/
		_fireEventWhenDisabled: function( type, data ){
			if ((type=='contextmenu') && this.disabledEvents && this.disabledEvents[type]){
				//Prevent default browser contextmenu
				var event = L.Util.extend({}, data, { type: type, target: this });
				L.DomEvent.stop( event );
				return false;
			}
			return L.Mixin.Events.fireEvent.call( this, type, data );
		}
	});

})(L, this, document);
