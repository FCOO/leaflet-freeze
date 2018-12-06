/****************************************************************************
7    leaflet-freeze.js,

    (c) 2016, FCOO

    https://github.com/FCOO/leaflet-freeze
    https://github.com/FCOO

Extend with two new functions: freeze and thaw.
map.freeze( options ) will prevent dragging, contextmenu, popup, click, zoom (optional) and pan (optional) on the map and all layers/object.

When the map is 'frozen' the <map>-element get a classname 'is-frozen'
When the map is 'thaw' the <map>-element get a classname 'not-is-frozen'

map.thaw() will undo the locking done by map.freeze(..)

options:
    allowZoomAndPan: false. If true zoom and pan is allowed
    disableMapEvents: "". Names of events on the map to be disabled
    hideControls   : false. If true all leaflet-controls are hidden
    hidePopups     : true. If true all open popups are closed on freeze
    beforeFreeze   : function(map, options) (optional) to be called before the freezing
    afterThaw      : function(map, options) (optional) to be called after the thawing
    dontFreeze     : null. leaflet-object, html-element or array of ditto with element or "leaflet-owner" no to be frozen

New method
L.Class.getHtmlElements: function() Return associated html-elements or array of Leaflet-elements


****************************************************************************/
(function ($, L/*, window, document, undefined*/) {
    "use strict";


    var modernizrFreezeTest = 'is-frozen',
        defaultOptions = {
            allowZoomAndPan : false,
            disableMapEvents: '',
            hideControls    : false,
            hidePopups      : true,
            beforeFreeze    : null,
            afterThaw       : null,
            dontFreeze      : null
        };


    L.Map.addInitHook(function () {
        $(this.getContainer()).modernizrOff( modernizrFreezeTest );
    });




    /*********************************************
    L.Class.getHtmlElements
    Extend with method to find associated html-elements or array of Leaflet-elements
    *********************************************/
    L.Class.include({
        getHtmlElements: function(){
            var result = null,
                _this = this;
            $.each(['_container', 'getContainer', '_path', '_icon', 'getLayers'], function(index, id){
                if (_this[id]){
                    result = $.isFunction(_this[id]) ? _this[id].call(_this) : _this[id];
                    return false;
                }
            });
            return result;
        }
    });

    /*********************************************
    getLeafletHtmlElements
    Add and return all html-elements for a given leaflet-object
    *********************************************/
    function getLeafletHtmlElements( leafletObj, result ){
        var partResult = leafletObj;
        if (leafletObj instanceof L.Class)
            partResult = leafletObj.getHtmlElements();

        if ($.isArray(partResult))
            $.each(partResult, function(index, elem){
                result = getLeafletHtmlElements( elem, result );
            });
        else
            result.push( partResult );

        return result;
    }

    /*********************************************
    L.Map
    *********************************************/
    L.Map.include({
        /*********************************************
        freeze
        *********************************************/
        freeze: function( options ){
            if (this._isFrozen)
              return;

            var $container = $(this.getContainer());

            $container.modernizrOn( modernizrFreezeTest );

            options = L.Util.extend( {}, defaultOptions, options );
            options.preventZoomAndPan = !options.allowZoomAndPan; //Typo pretty

            if (options.beforeFreeze)
                options.beforeFreeze(this, options);

            this._freezeOptions = {};
            this._freezeOptions.options = options;

            //Remove the cursor.grab if pan is frozen
            this._freezeOptions.map_cursor_style = this.getContainer().style.cursor;
            if (options.preventZoomAndPan)
                this.getContainer().style.cursor = 'default';

            //Block for zoom and remove the zoom-control if zoom isn't allowed
            if (options.preventZoomAndPan){
                this._freezeOptions.getMinZoom = this.getMinZoom;
                this.getMinZoom = function(){ return this.getZoom(); };

                this._freezeOptions.getMaxZoom = this.getMaxZoom;
                this.getMaxZoom = this.getMinZoom;

                this._freezeOptions.setZoom = this.setZoom;
                this.setZoom = function(){ return this; };

                if (this.zoomControl){
                    this._freezeOptions.zoomControl_style_display = this.zoomControl._container.style.display;
                    this.zoomControl._container.style.display = 'none';
                }
            }

            //Freeze all elements except the one in options.dontFreeze by removing class "leaflet-interactive"
            var dontFreezeList = getLeafletHtmlElements(options.dontFreeze, []);

            //Exclude the elements from freezing
            $.each(dontFreezeList, function(index, htmlElement){
                $(htmlElement)
                    .filter('.leaflet-interactive')
                    .addClass('not-to-freeze')
                    .removeClass('leaflet-interactive');
            });

            //'Freeze' all elements
            $container.find('.leaflet-interactive')
                .addClass('_leaflet-interactive')
                .removeClass('leaflet-interactive');

            //'Thaw' the excluded element
            $container.find('.not-to-freeze')
                .addClass('leaflet-interactive')
                .removeClass('not-to-freeze');


            //Hide all controls
            if (options.hideControls){
              this._freezeOptions._controlContainer_style_display = this._controlContainer.style.display;
              this._controlContainer.style.display = 'none';
            }

            //Disable the different iHandlers
            if (options.preventZoomAndPan){
                $.each([this.keyboard, this.dragging, this.tap, this.touchZoom, this.doubleClickZoom, this.scrollWheelZoom, this.boxZoom], function(index, iHandler){
                    if (iHandler){
                        iHandler.enableOnThaw = iHandler._enabled || (iHandler.enabled && iHandler.enabled());
                        iHandler.disable();
                        iHandler.frozen = true;
                    }
                });
            }

            if (options.hidePopups && this.closePopup)
                this.closePopup();

            if (this.hasEventListeners && options.disableMapEvents){
                this.disabledEvents = {};
                var _this = this;
                $.each(options.disableMapEvents.split(' '), function(id, eventName){
                    if (eventName)
                        _this.disabledEvents[eventName] = true;
                });

                this._save_hasEventListeners = this.hasEventListeners;
                this.hasEventListeners = this._hasEventListenersWhenDisabled;

                this._save_fireEvent = this.fireEvent;
                this.fireEvent = this._fireEventWhenDisabled;

                this._save_fire = this.fire;
                this.fire = this._fireEventWhenDisabled;
            }

            this._isFrozen = true;

            if (options.afterThaw)
                this.once('afterThaw', options.afterThaw);

            return this;
        },

        /*********************************************
        thaw
        *********************************************/
        thaw: function(){
            if (!this._isFrozen)
              return;

            var $container = $(this.getContainer());

            //Reset cursor
            this.getContainer().style.cursor = this._freezeOptions.map_cursor_style;

            //Reset zoom
            if (this._freezeOptions.options.preventZoomAndPan){

                this.getMinZoom = this._freezeOptions.getMinZoom;
                this.getMaxZoom = this._freezeOptions.getMaxZoom;
                this.setZoom    = this._freezeOptions.setZoom;

                if (this.zoomControl)
                    this.zoomControl._container.style.display = this._freezeOptions.zoomControl_style_display;
            }

            //Show controls
            if (this._freezeOptions.options.hideControls)
              this._controlContainer.style.display = this._freezeOptions._controlContainer_style_display;

            //Enabled any IHandler, that was disabled
            $.each( [this.keyboard, this.dragging, this.tap, this.touchZoom, this.doubleClickZoom, this.scrollWheelZoom, this.boxZoom], function(index, iHandler){
                if (iHandler && iHandler.frozen){
                    if (iHandler.enableOnThaw)
                      iHandler.enable();
                    iHandler.frozen = false;
                }
            });

            if (this.disabledEvents){
                this.hasEventListeners = this._save_hasEventListeners;
                this.fireEvent         = this._save_fireEvent;
                this.fire              = this._save_fire;
                this.disabledEvents    = null;
            }

            this._freezeOptions = {};

            //Thaw all elements by adding class "leaflet-interactive"
            $container.find('._leaflet-interactive')
                .addClass('leaflet-interactive')
                .removeClass('_leaflet-interactive');

            $container.modernizrOff( modernizrFreezeTest );

            this._isFrozen = false;

            this.fire('afterThaw');
        },

        /*********************************************
        _hasEventListenersWhenDisabled
        Internal new version of hasEventListeners filtering the type of events.
        Always allow 'contextmenu' because it is catched by _fireEventWhenDisabled
        *********************************************/
        _hasEventListenersWhenDisabled: function( type ){
            if ((type != 'contextmenu') && this.disabledEvents && this.disabledEvents[type])
                return false;
            return L.Mixin.Events.hasEventListeners.call( this, type );
        },

        /*********************************************
        _fireEventWhenDisabled
        Internal new version of fireEvent to catch 'contextmenu' events
        *********************************************/
        _fireEventWhenDisabled: function( type, data ){
            if ((type == 'contextmenu') && this.disabledEvents && this.disabledEvents[type]){
                //Prevent default browser contextmenu
                var event = L.Util.extend({}, data, { type: type, target: this });
                L.DomEvent.stop( event );
                return false;
            }
            return L.Mixin.Events.fireEvent.call( this, type, data );
        }
    });

})(jQuery, L, this, document);
