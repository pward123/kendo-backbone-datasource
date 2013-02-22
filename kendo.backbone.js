/*
 * Kendo Backbone DataSource v0.1.0
 * Copyright (C) 2013 Diem Technologies, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */
(function () {

// The default values for each field type
var defaultValues = {
    "string": "",
    "number": 0,
    "date": new Date(),
    "boolean": false,
    "default": "",
};

// Events
var CHANGE = "change",
    REQUESTSTART = "requestStart",
    PROGRESS = "progress",
    REQUESTEND = "requestEnd",
    SYNC = "sync";

// "Constants"
var DEBUG = true;   // Whether console.assert calls should be performed
var TRACE = true;   // Whether console.log calls should be performed

// Helper function to determine whether a value is an integer
if (DEBUG || TRACE) {
    var isInteger = function(obj) {
        return _.isNumber(obj) && (obj % 1 == 0);
    }
}

// Return true if the object is defined
var isDefined = function(obj) {
    return (typeof obj !== "undefined");
}

// Return true if the object is undefined or null
var isSpecified = function(obj) {
    return (typeof obj !== "undefined") && (obj != null);
}

//
// Wraps a Backbone Model in a Kendo Model
//
kendo.BackboneModel = kendo.data.Model.extend({
    _watchingBackbone: false,    // True if we're already watching the change events from backbone

    //
    // Constructor
    //
    init: function(options) {
        if (TRACE) console.log("BackboneModel.init called with " + JSON.stringify(arguments));
        var that = this;
        options = options || {};

        // Perform DEBUG checking
        if (DEBUG) {
            // options.backboneModel, if specified, should be a Backbone model
            console.assert(!isSpecified(options.backboneModel) || (options.backboneModel instanceof Backbone.Model),
                "options.backboneModel must be a Backbone model");

            // that.fields should be specified
            console.assert(isSpecified(that.fields),
                "that.fields must be specified");

            // options.fields should not be defined
            console.assert(!isDefined(options.fields),
                "options.fields must not be defined");
        }

        // Call super
        kendo.data.Model.fn.init.call(that);

        // If options.backboneModel is specified
        if (isSpecified(options.backboneModel)) {

            // Create a reference to it in that._backbone
            _.extend(that, {
                _backbone: options.backboneModel
            });

            // Copy fields from backbone to kendo
            that._valuesFromBackbone(true);

            // Listen to backbone changes
            that._backbone.on("change", that._onBackboneChange, that);
            that._watchingBackbone = true;
        }
    },

    destroy: function() {
        if (TRACE) console.log("BackboneModel.destroy called with " + JSON.stringify(arguments));
        var that = this;

        // Stop watching all backbone events
        if (that._backbone) {
            that._backbone.off(null, null, that);
        }

        // Call super
        kendo.data.Model.fn.destroy.apply(that, arguments);
    },

    //
    // cancelChanges
    // Revert the model's field values to the Backbone values (or defaults if backbone property values don't exist)
    //
    cancelChanges: function() {
        if (TRACE) console.log("BackboneModel.cancelChanges called with " + JSON.stringify(arguments));
        var that = this;

        // Perform DEBUG checking
        if (DEBUG) {
            // Model should have a backbone model
            console.assert(!that.isNew(),
                "cannot cancel changes on a new model");
        }

        // Copy fields from backbone to kendo
        that._valuesFromBackbone(true);
    },

    //
    // isNew
    // Returns true if the model is new (i.e. it doesn't have a Backbone reference)
    //
    isNew: function() {
        if (TRACE) console.log("BackboneModel.isNew called with " + JSON.stringify(arguments));
        return !isSpecified(this._backbone);
    },

    //
    // Sync
    // Copy the model's field values to Backbone
    //
    sync: function() {
        if (TRACE) console.log("BackboneModel.sync called with " + JSON.stringify(arguments));
        var that = this;
        that._valuesToBackbone(true);

        // If we're not already listening for backbone changes
        if (!that._watchingBackbone) {
            that._backbone.on("change", that._onBackboneChange, that);
            that._watchingBackbone = true;
        }
    },

    //
    // _onBackboneChange
    // Handler for Backbone "change" events
    //
    _onBackboneChange: function(model, options) {
        if (TRACE) console.log("BackboneModel._onBackboneChange called with " + JSON.stringify(arguments));
        var that = this;

        // Loop through all changed attributes
        _.each(model.changedAttributes(), function(value, key) {
            // If the attribute is one of our fields
            if (that.fields.hasOwnProperty(key)) {
                that._setInternal(key, value);
            }
        });
    },

    //
    // _set
    // Sets the model's field values
    //
    // kendo.data.Model will ignore any call to set a field that is not editable. This
    // function bypasses the call to super and triggers the change directly
    //
    _setInternal: function(field, value, initiator) {
        if (TRACE) console.log("BackboneModel._setInternal called with " + JSON.stringify(arguments));
        var that = this;
        if (!_.isEqual(value, that.get(field))) {
            that._set(field, value);
            that.trigger(CHANGE, { field: field });
        }
    },

    //
    // _valuesFromBackbone
    // Copy field values from that._backbone to our properties.
    //
    // If useDefaults is true, any fields defined in _this.fields that
    // are undefined in Backbone are set to the field's defaultValue
    //
    _valuesFromBackbone: function(useDefaults) {
        if (TRACE) console.log("BackboneModel._valuesFromBackbone called with " + JSON.stringify(arguments));
        var that = this,
            fieldValue;

        useDefaults = useDefaults || false;

        // Perform DEBUG checking
        if (DEBUG) {
            // We either need a backbone reference or set to use defaults
            console.assert(!that.isNew() || useDefaults,
                "cannot copy values from backbone to a new model");
        }

        // If we're not new. i.e. we have a backbone reference
        if (!that.isNew()) {

            // Copy values for fields in the fieldList from Backbone attributes
            _.each(that.fields, function(field, fieldName) {
                fieldValue = that._backbone.get(fieldName);

                // If the value is in backbone, copy it
                if (isDefined(fieldValue)) {
                    that._setInternal(fieldName, fieldValue);
                // Otherwise if useDefaults is set, use the default value
                } else if (useDefaults) {
                    that._setInternal(fieldName, (isDefined(field.defaultValue) ? field.defaultValue : defaultValues[field.type.toLowerCase()]));
                }
            });

            that.id = that._backbone.cid;
            that.dirty = false;
        } else if (useDefaults) {
            // Copy default values for all fields
            _.each(that.fields, function(field, fieldName) {
                that._setInternal(fieldName, (isDefined(field.defaultValue) ? field.defaultValue : defaultValues[field.type.toLowerCase()]));
            });
        }
    },

    //
    // _valuesToBackbone
    // Copy attributes from our properties to that._backbone
    //
    // If useDefaults is true, any fields defined in _this.fields that
    // are undefined in our properties are set to the field's
    // defaultValue
    //
    _valuesToBackbone: function(useDefaults) {
        if (TRACE) console.log("BackboneModel._valuesToBackbone called with " + JSON.stringify(arguments));
        var that = this,
            fieldValue;

        // Perform DEBUG checking
        if (DEBUG) {
            // Should have a backbone reference i.e. not a new model
            console.assert(!that.isNew(),
                "cannot copy values from a new model to backbone");
        }

        // If we're not new. i.e. we have a backbone reference
        if (!that.isNew()) {
            useDefaults = useDefaults || false;

            // Copy values for fields in the fieldList to Backbone attributes
            _.each(that.fields, function(field, fieldName) {
                fieldValue = that.get(fieldName);

                // If the value is in backbone, copy it
                if (typeof fieldValue !== "undefined") {
                    that._backbone.set(fieldName, fieldValue);
                // Otherwise if useDefaults is set, use the default value
                } else if (useDefaults) {
                    that._backbone.set(fieldName, (typeof field.defaultValue !== "undefined" ? field.defaultValue : defaultValues[field.type.toLowerCase()]));
                }
            });

            that.dirty = false;
        }
    },
});

//
// Wraps a Backbone Collection in a Kendo DataSource
//
// The following items are not currently supported: (Listed in order of planned future support)
//   - Sorting
//   - Querying
//   - Paging
//   - Filters
//   - Aggregates
//   - Grouping
//   - Setting of values through the data function
//   * Backbone models with attributes named "id" or "uid" due to conflicts
//     with Kendo's use of these properties.  The Kendo id property is alwayss
//     set to the Backbone's cid value.
//   * options.autoSync
//
//   key: * future support is not planned
//
// Assumptions:
//   - The read function is not implemented (the caller should use Backbone functions instead)
//   - Sync will not automatically call the Backbone sync
//
kendo.BackboneDataSource = kendo.data.DataSource.extend({

    _kendoModelsByID: {},   // Cache of Kendo models accessible by kendo id/backbone cid


                            // List of kendo.BackboneModel (equivalent to Kendo DataSource's _data member).
    _models: [],            // Kendo model elements without a _backbone property have no associated Backbone model
                            // and are new records.

    //
    // Constructor
    //
    init: function(options) {
        if (TRACE) console.log("BackboneDataSource.init called with " + JSON.stringify(arguments));
        var that = this;
        options = options || {};

        // Perform DEBUG checking
        if (DEBUG) {
            // options.backboneCollection should be a Backbone collection
            console.assert(options.backboneCollection instanceof Backbone.Collection,
                "options.backboneCollection must be a Backbone collection");

            // options.fields should be specified
            console.assert((typeof options.fields !== "undefined") && (options.fields !== null),
                "options.fields must be specified");

            // options.fields should not contain fields named 'id' or 'uid'
            console.assert(!isSpecified(options.fields.id) && !isSpecified(options.fields.uid),
                "fields named 'id' or 'uid' are prohibited");

            // options.backboneModelClass should be specified
            console.assert((typeof options.backboneModelClass !== "undefined") && (options.backboneModelClass !== null),
                "options.backboneModelClass must be a Backbone model class");
        }

        // Default options.kendoModelClass to a model based on the specified fields
        options = _.defaults(options, {
            kendoModelClass: kendo.data.Model.define(kendo.BackboneModel, {fields: options.fields})
        });

        // Set properties that are based on options properties
        _.extend(that, {
            _backboneModelClass: options.backboneModelClass,
            _collection: options.backboneCollection,
            _fields: options.fields,
            _kendoModelClass: options.kendoModelClass,
        })

        // Create kendo models for each backbone model and add them to that._models
        _.each(options.backboneCollection.models, function(bbModel) {
            that._models.push(that._createKendoModel(bbModel));
        });

        // Call super
        kendo.data.DataSource.fn.init.call(that, options);

        // Watch events from the backbone collection
        that._collection.on("add", that._onBackboneAdd, that);
        that._collection.on("remove destroy", that._onBackboneRemove, that);
        that._collection.on("reset", that._onBackboneReset, that);
        that._collection.on("sort", that._onBackboneSort, that);
    },

    destroy: function() {
        if (TRACE) console.log("BackboneDataSource.destroy called with " + JSON.stringify(arguments));
        var that = this;

        // Stop watching all backbone events
        that._collection.off(null, null, that);

        // Call super
        kendo.data.Model.fn.destroy.apply(that, arguments);
    },

    //
    // add
    // Adds a kendoModel to the end of this DataSource
    //
    add: function(kendoModel) {
        if (TRACE) console.log("BackboneDataSource.add called with " + JSON.stringify(arguments));

        var that = this;
        return that.insert(that._models.length, kendoModel);
    },

    //
    // aggregate
    // Get current aggregate descriptors or applies aggregates to the data.
    //
    aggregate: function() {
        if (TRACE) console.log("BackboneDataSource.aggregate called with " + JSON.stringify(arguments));
        if (DEBUG) {
            // TODO: finish this
            console.warn("aggregate not yet implemented");
        }
    },

    //
    // aggregates
    // Get result of aggregates calculation
    //
    aggregates: function() {
        if (TRACE) console.log("BackboneDataSource.aggregates called with " + JSON.stringify(arguments));
        if (DEBUG) {
            // TODO: finish this
            console.warn("aggregates not yet implemented");
        }
    },

    //
    // at
    // Returns the data item at the specified index
    //
    at: function(index) {
        if (TRACE) console.log("BackboneDataSource.at called with " + JSON.stringify(arguments));
        var that = this;

        // Perform DEBUG checking
        if (DEBUG) {
            // index should be an integer
            console.assert(isInteger(index),
                "index must be an integer");

            // index should be in range
            console.assert((index > 0) && (index < that._models.length),
                "index out of range");
        }

        // Return the matching model
        return _models[index];
    },

    //
    // cancelChanges
    // Cancel the changes made to the DataSource after the last sync. Any changes currently existing in the model will be discarded.
    //
    cancelChanges: function(kendoModel) {
        if (TRACE) console.log("BackboneDataSource.cancelChanges called with " + JSON.stringify(arguments));
        var that = this,
            target,
            targets,
            index;

        // Perform DEBUG checking
        if (DEBUG) {
            // kendoModel should either be undefined or an instance of the kendo model class we're using
            console.assert(!isDefined(kendoModel) || (kendoModel instanceof that._kendoModelClass),
                "kendoModel must be undefined or of the kendoModelClass type");
        }

        // If kendoModel is specified, set targets to an array containing just kendoModel
        if (isDefined(kendoModel)) {
            targets = [kendoModel];
        // Otherwise, set targets to an array of all kendo models
        } else {
            targets = that._models;
        }

        // Loop through all targets
        _.each(targets, function(model) {
            // If the model is new, remove it from that._models
            if (model.isNew()) {
                index = that.indexOf(model);
                that.remove(model);

                // Trying to get Kendo grid's inline editing to remove the row.
                // FYI, moving this to that.remove breaks some other stuff.
                that.trigger(CHANGE, {
                    action: "remove",
                    index: index,
                    items: model,
                });

            // Otherwise, tell the model to cancel it's changes
            } else {
                model.cancelChanges();
            }
        });
    },

    //
    // data
    // Gets or sets the data of the DataSource.
    //
    data: function(value) {
        if (TRACE) console.log("BackboneDataSource.data called with " + JSON.stringify(arguments));
        var that = this,
            result;

        // Perform DEBUG checking
        if (DEBUG) {
            // value should not be defined because we're not currently supporting setting the data array this way
            console.assert(!isDefined(value),
                "setting the data values through a call to data is not currently supported");
        }

        // If kendoModel isn't defined return the kendo version of all models
        if (!isDefined(value)) {
            result = that._models;
        }

        return result;
    },

    //
    // fetch
    // Fetches data using the current filter/sort/group/paging information. If data is not available
    // and remote operations are enabled data is requested through the transport, otherwise operations
    // are executed over the available data.
    //
    fetch: function(callback) {
        if (TRACE) console.log("BackboneDataSource.fetch called with " + JSON.stringify(arguments));
        var that = this;

        if (callback && isFunction(callback)) {
            that.one(CHANGE, callback);
        }

        that.query();
    },

    //
    // filter
    // Get current filters or filter the data.
    //
    filter: function(val) {
        if (TRACE) console.log("BackboneDataSource.filter called with " + JSON.stringify(arguments));
        if (DEBUG) {
            // TODO: finish this
            console.warn("filter not yet implemented");
        }
    },

    //
    // get
    // Returns the Kendo Model for a specific id
    //
    get: function(id) {
        if (TRACE) console.log("BackboneDataSource.get called with " + JSON.stringify(arguments));
        return this._collection.get(id)
    },

    //
    // getByUid
    // Retrieves a data item by its uid field.
    //
    getByUid: function(uid) {
        if (TRACE) console.log("BackboneDataSource.getByUid called with " + JSON.stringify(arguments));
        var that = this;

        return _.find(that._models, function(model) {
            return (model.uid === uid);
        });
    },

    //
    // group
    // Get current group descriptors or group the data.
    //
    group: function(val) {
        if (TRACE) console.log("BackboneDataSource.group called with " + JSON.stringify(arguments));
        if (DEBUG) {
            // TODO: finish this
            console.warn("group not yet implemented");
        }
        return [];
    },

    //
    // indexOf
    // Get the index of a kendo model in the data array (searches by uid)
    //
    indexOf: function(kendoModel) {
        if (TRACE) console.log("BackboneDataSource.indexOf called with " + JSON.stringify(arguments));
        var that = this,
            idx;

        // Perform DEBUG checking
        if (DEBUG) {
            console.assert(kendoModel instanceof that._kendoModelClass,
                "kendoModel must be of the kendoModelClass type");
        }

        // Loop through that._models looking for a kendo model with matching id
        for (idx = 0; idx < that._models.length; idx++) {
            if (that._models[idx].uid === kendoModel.uid) {
                return idx;
            }
        }

        // If we didn't find one, return -1
        return -1;
    },

    //
    // indexOf
    // Get the index of a backbone model in the data array (searches by cid)
    //
    indexOfBackbone: function(backboneModel) {
        if (TRACE) console.log("BackboneDataSource.indexOfBackbone called with " + JSON.stringify(arguments));
        var that = this,
            idx;

        // Perform DEBUG checking
        if (DEBUG) {
            console.assert(backboneModel instanceof that._backboneModelClass,
                "backboneModel must be of the backboneModelClass type");
        }

        // Loop through that._models looking for a Backbone model with matching cid
        for (idx = 0; idx < that._models.length; idx++) {
            if (that._models[idx].id === backboneModel.cid) {
                return idx;
            }
        }

        // If we didn't find one, return -1
        return -1;
    },

    //
    // insert
    // Inserts a model into the DataSource
    //
    // Kendo's grid calls this method as soon as the toolbar "create" button is clicked.  Therefore,
    // inserted models will not be copied to Backbone until sync is called.
    //
    insert: function(index, kendoModel) {
        if (TRACE) console.log("BackboneDataSource.insert called with " + JSON.stringify(arguments));
        var that = this;

        // If only the model is provided, we insert at the beginning of the array
        if (!kendoModel) {
            kendoModel = index;
            index = 0;
        }

        // Perform DEBUG checking
        if (DEBUG) {
            // index should be an integer
            console.assert(isInteger(index),
                "index must be an integer");

            // index should be in range
            console.assert((index > 0) && (index <= that._models.length),
                "index out of range");

            // kendoModel should be an empty object or an instance of that._kendoModelClass
            console.assert($.isEmptyObject(kendoModel) || (kendoModel instanceof that._kendoModelClass),
                "kendoModel must be of the kendoModelClass type");
        }

        // If the model is not specified, or is an empty object (sent by kendo when inserting a new grid record)
        if (!isSpecified(kendoModel) || $.isEmptyObject(kendoModel)) {
            // Create a new kendo model
            kendoModel = that._createKendoModel();
        }

        // Insert the model into our array (don't add it to backbone until sync is called)
        that._models.splice(index, 0, kendoModel);

        // Trigger a change event so kendo can update controls
        that.trigger(CHANGE, {
            action: "add",
            index: index,
            items: kendoModel,
        });

        // Return the model
        return kendoModel;
    },

    //
    // page
    // Get current page index or request a page with specified index.
    //
    page: function(val) {
        if (TRACE) console.log("BackboneDataSource.page called with " + JSON.stringify(arguments));
        if (DEBUG) {
            // TODO: finish this
            console.warn("page not yet implemented");
        }
    },

    //
    // pageSize
    // Get current pageSize or request a page with specified number of records.
    //
    pageSize: function(val) {
        if (TRACE) console.log("BackboneDataSource.pageSize called with " + JSON.stringify(arguments));
        var that = this;
        if (DEBUG) {
            // TODO: finish this
            console.warn("pageSize not yet implemented");
        }
    },

    //
    // query
    // Executes a query over the data. Available operations are paging, sorting, filtering,
    // grouping. If data is not available or remote operations are enabled, data is requested
    // through the transport. Otherwise operations are executed over the available data.
    //
    query: function(options) {
        if (TRACE) console.log("BackboneDataSource.query called with " + JSON.stringify(arguments));
        var that = this;

        if (DEBUG) {
            // TODO: finish this
            console.warn("query not yet implemented");
        }
        if (!that.trigger(REQUESTSTART)) {
            that.trigger(PROGRESS);
            //that._view = result.data;
            //that._aggregateResult = calculateAggregates(that._data, options);
            that.trigger(REQUESTEND, { });
            // Trigger a change event so kendo can update controls
            that.trigger(CHANGE, { items: that.data() });
        }
    },

    //
    // read
    // Read data into the DataSource (not currently supported - here to override default functionality with a noop)
    //
    read: function(data) {
        if (TRACE) console.log("BackboneDataSource.read called with " + JSON.stringify(arguments));
        if (DEBUG) {
            // TODO: finish this
            console.warn("read is not supported. Use the appropriate Backbone function");
        }
    },

    //
    // remove
    // Removes a Kendo model from this DataSource
    //
    // If the model has a backing Backbone model, the Backbone model is removed from the
    // backing Backbone collection
    //
    remove: function(kendoModel) {
        if (TRACE) console.log("BackboneDataSource.remove called with " + JSON.stringify(arguments));
        var that = this,
            index;

        // If the model is in our list
        index = that.indexOf(kendoModel);
        if (index > -1) {
            // Remove the model from _kendoModelsByID
            delete that._kendoModelsByID[kendoModel.id];

            // Remove the model from that._models
            that._models.splice(index,1);

            // Remove the backbone model from the that._collection
            if (isSpecified(kendoModel._backbone)) {
                that._collection.remove(kendoModel._backbone, {
                    ignoreBBEvent: true,
                });
            }
        }

        // Perform DEBUG checking
        if (DEBUG) {
            if (index < 0) {
                console.warn("attempted to remove a kendo model that didn't exist")
            }
        }
    },

    //
    // sort
    // Get current sort descriptors or sorts the data.
    //
    sort: function(val) {
        if (TRACE) console.log("BackboneDataSource.sort called with " + JSON.stringify(arguments));
        if (DEBUG) {
            // TODO: finish this
            console.warn("sort not yet implemented");
        }
    },

    //
    // sync
    // Synchronizes changes through the transport. Any pending CRUD operations will
    // be sent to the server. If the DataSource is in batch mode, only one call will
    // be made for each type of operation (Create, Update, Destroy). Otherwise, the
    // DataSource will send one request per item change and change type.
    //
    sync: function() {
        if (TRACE) console.log("BackboneDataSource.sync called with " + JSON.stringify(arguments));
        var that = this;

        // loop through models - anything that is a kendo model needs to be dealt with
        _.each(that._models, function(model, index) {
            if (model.isNew()) {
                // Create a new backbone model and copy the kendo fields to it
                model._backbone = new that._backboneModelClass();
                model.sync();

                // Add the model to our "by id" hash
                that._kendoModelsByID[model.id] = model;

                // Add the backbone model to the collection
                that._collection.add(model._backbone, {
                    at: index,
                    ignoreBBEvent: true,
                });

            } else if (model.dirty) {
                model.sync();
            }
        });

        // Trigger a change event so kendo can update controls
        that.trigger(CHANGE, { action: "sync", items: that.view() });

        // Inform everyone that we've finished syncing
        that.trigger(SYNC);
    },

    //
    // total
    // Get the total number of data items.
    //
    total: function() {
        if (TRACE) console.log("BackboneDataSource.total called with " + JSON.stringify(arguments));
        var that = this;
        return that._collection.length;
    },

    //
    // totalPages
    // Get the number of available pages.
    //
    totalPages: function() {
        if (TRACE) console.log("BackboneDataSource.totalPages called with " + JSON.stringify(arguments));
        if (DEBUG) {
            // TODO: finish this
            console.warn("totalPages not yet implemented");
        }
        return 1;
    },

    //
    // view
    // Returns a the current state of the data items - with applied paging, sorting, filtering and grouping.
    // To ensure that data is available this method should be use from within change event of the DataSource.
    //
    view: function() {
        if (TRACE) console.log("BackboneDataSource.view called with " + JSON.stringify(arguments));
        return this.data();
    },

    //
    // onBackboneAdd
    // Event handler for Backbone's add event
    //
    _onBackboneAdd: function(backboneModel, collection, options) {
        if (TRACE) console.log("BackboneDataSource.onBackboneAdd called with " + JSON.stringify(arguments));
        var that = this,
            bbIndex,
            ourIndex = that._models.length,
            loopIndex,
            priorCID,
            kendoModel;

        // Ignore this if the model was added as part of a that._sync
        options = options || {};
        if (options.ignoreBBEvent === true) {
            return;
        }

        // Perform DEBUG checking
        if (DEBUG) {
            console.assert(backboneModel instanceof that._backboneModelClass,
                "backboneModel must be of the backboneModelClass type");

            console.assert(collection === this._collection,
                "collection must be the same as our collection");
        }

        // Get the position of the backboneModel in the backbone collection
        bbIndex = that._collection.indexOf(backboneModel);

        // If the backboneModel was inserted at the beginning of the backbone collection
        if (bbIndex === 0) {

            // Set ourIndex to the first Backbone model in that._models
            for (loopIndex = 0; loopIndex < that._models.length; loopIndex++) {
                if (isSpecified(that._models[loopIndex]._backbone)) {
                    ourIndex = loopIndex;
                    break;
                }
            }

        } else {

            // Set priorCID to the cid of the Backbone model prior to ours in the backbone collection
            priorCID = that._collection.models[bbIndex-1].cid;

            // Set ourIndex to the (index of priorCID) + 1
            for (loopIndex = 0; loopIndex < that._models.length; loopIndex++) {
                if (that._models[loopIndex].id === priorCID) {
                    ourIndex = loopIndex + 1;
                    break;
                }
            }
        }

        // Place backboneModel in the right place and trigger an event
        kendoModel = that._createKendoModel(backboneModel);
        that._models.splice(ourIndex, 0, kendoModel);
        that.trigger(CHANGE, {
            action: "add",
            index: ourIndex,
            items: kendoModel
        });
    },

    //
    // onBackboneRemove
    // Event handler for Backbone's remove event
    //
    _onBackboneRemove: function(backboneModel, collection, options) {
        if (TRACE) console.log("BackboneDataSource.onBackboneRemove called with " + JSON.stringify(arguments));
        var that = this,
            index,
            kendoModel;

        // Ignore this if the model was removed as part of a that.remove
        options = options || {};
        if (options.ignoreBBEvent === true) {
            return;
        }

        // Perform DEBUG checking
        if (DEBUG) {
            console.assert(backboneModel instanceof that._backboneModelClass,
                "backboneModel must be of the backboneModelClass type");

            console.assert(collection === this._collection,
                "collection must be the same as our collection");
        }

        // Remove the matching kendo model and fire a change event
        index = that.indexOfBackbone(backboneModel);
        if (index > -1) {
            kendoModel = that._models[index];
            that._models.splice(index, 1);
            that.trigger(CHANGE, {
                action: "remove",
                index: index,
                model: kendoModel
            });
        }
    },

    //
    // onBackboneReset
    // Event handler for Backbone's reset event
    //
    _onBackboneReset: function() {
        if (TRACE) console.log("BackboneDataSource.onBackboneReset called with " + JSON.stringify(arguments));
        if (DEBUG) {
            // TODO: finish this
            console.warn("onBackboneReset not yet implemented");
        }
    },

    //
    // onBackboneSort
    // Event handler for Backbone's sort event
    //
    _onBackboneSort: function() {
        if (TRACE) console.log("BackboneDataSource.onBackboneSort called with " + JSON.stringify(arguments));
        if (DEBUG) {
            // TODO: finish this
            console.warn("onBackboneSort not yet implemented");
        }
    },

    //
    // _createKendoModel
    // Factory method that is used to create kendo models and start listening to change events
    //
    _createKendoModel: function(backboneModel) {
        if (TRACE) console.log("BackboneDataSource._createKendoModel called with " + JSON.stringify(arguments));
        var that = this,
            result,
            options = {};

        if (DEBUG) {
            // We should be called with a _backboneModelClass instance or no model at all
            console.assert(!isDefined(backboneModel) || (backboneModel instanceof that._backboneModelClass),
                "model must be an instance of the backbone model classes");
        }

        // Add the backbone model, if provided, to the options list
        if (backboneModel instanceof that._backboneModelClass) {
            _.extend(options, {
                backboneModel: backboneModel
            });
        }

        // Create the kendo model and set all of its events to bubble up
        result = new that._kendoModelClass(options);
        result.bind(CHANGE, function(e) {
            that.trigger(CHANGE, {
                field: e.field,
                node: e.node,
                index: e.index,
                items: e.items || [this],
                action: e.node ? (e.action || "itemchange") : "itemchange"
            });
        });

        return result;
    },

});

})();
