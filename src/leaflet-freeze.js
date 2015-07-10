/****************************************************************************
LEATLET.FREEZE

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

	var mapIsFrozen = false;
	
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
			
			if (options.beforeFreeze)
				options.beforeFreeze(this, options);

			//Remove the cursor.grab if pan is frozen
			this.save_style_cursor = this.getContainer().style.cursor;
			if (!options.allowPan)
				this.getContainer().style.cursor = 'default';

			//Remove the zoom-control
			if (this.zoomControl && (!options.allowZoom)){
				this._addZoomControlWhenThaw = true;
				this.zoomControl.removeFrom( this );				  
			}

			this._freeze(options);

			mapIsFrozen = true;
			
			if (options.afterThaw){
				this.once('afterThaw', options.afterThaw);  
			}
		},

		/*********************************************
		thaw
		*********************************************/
		thaw: function(){
			this.getContainer().style.cursor = this.save_style_cursor;

			//Reset cursor
			if (this.save_style_cursor){
				this.getContainer().style.cursor = this.save_style_cursor;
				this.save_style_cursor = null;
			}

			//Add zoom-control
			if (this._addZoomControlWhenThaw){
				this.zoomControl.addTo( this );				  
				this._addZoomControlWhenThaw = false;
			}

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

			if (options.popup && this.closePopup){
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
