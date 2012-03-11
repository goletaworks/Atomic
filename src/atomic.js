var Atomic = {
	CONNECTOR_NODE_SEPARATOR : '-',	
	FONT_SIZE : 12,
	width : 0,
	height : 0,
	canvas : null,
	parent : null,

	/* contains the arrays of objects */
	objects : {
		circle : [],
		connector : [],
		ellipse : [],
		image : [],
		path : [],
		rect : [],
		text : []
	},

	/* constants */
	types : {
		CIRCLE : 'circle',
		CONNECTOR : 'connector',
		ELLIPSE : 'ellipse',
		IMAGE : 'image',
		PATH : 'path',
		RECT : 'rect',
		TEXT : 'text'
	},

	connectorTypes : {
		LINE : 'line',
		ARC : 'arc'
	},

	/* map for finding the object collection containing the object with a given id */
	idTypeMap : {},

	// --------------------------------------------------------------
	initialize : function(x, y, w, h, container) {
		this.width = w;
		this.height = h;
		
		
		if(container != null){
			this.canvas = Raphael(container, w, h);
		}
		else {
			this.canvas = Raphael(x, y, w, h);
		}
		this.canvas.top = y;
		this.canvas.left = x;
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		this.defineMarkers();
	},


	// --------------------------------------------------------
	// define the arrowheads
	defineMarkers : function(){
		// Unfortunately, can't use jQuery to add markers because it converts attributes to lower case
		// (for XHTML compatibility) which breaks SVG and Raphael doesn't natively support markers, so
		// creating my own, I guess
		Atomic.canvas.addMarker({
			id : 'Arrow',
			viewBox : '0 0 10 10',
			refX : 25,
			refY : 5,
			markerUnits : 'strokeWidth',
			markerWidth : 10,
			markerHeight : 10,
			orient : 'auto',
			polyline : {
				points : '0,0 10,5 0,10 1,5',
				fill : 'black'
			}
		});
	},

	// --------------------------------------------------------------
	setSize : function(w, h) {
		this.width = w;
		this.height = h;
		this.canvas.setSize(this.width, this.height);
		if(this.parent){
			this.parent.height(this.height);
			this.parent.width(this.width);
		}
	},

	// --------------------------------------------------------------
	/**
	 * Draws an object based on the properties in info. (See the Atomic.factories.)
	 */
	draw : function(info) {
		// details contains required: id, type, optional: text and others
		var id = info.id;
		var type = info.type;

		// delegate object creation
		var newObject = Atomic.factories[type](info);
		newObject.type = type;
		newObject.id = id;
		newObject.node.id = id;

		// add to the appropriate collection and register the id/type mapping
		Atomic.objects[type][id] = newObject;
		Atomic.idTypeMap[id] = type;

		// add the convenience methods
		if(type != Atomic.types.CONNECTOR){
			newObject.connectTo = function(targetObject, connectorType) { return Atomic.connect(newObject, targetObject, connectorType); };

			// the beforeConnect and onConnect events, called before and after a connector is connected to objects
			if(!newObject.beforeConnect){
				newObject.beforeConnect = function(object, pathPoints) { /* default do nothing */ };
			}
			if(!newObject.onConnect){
				newObject.onConnect = function(connector) { /* default do nothing */ };
			}
		}
		if(type == Atomic.types.CIRCLE){
			newObject.getX = function() { return this.attr('cx'); };
			newObject.getY = function() { return this.attr('cy'); };
			newObject.setX = function(x) { this.attr('cx', x); };
			newObject.setY = function(y) { this.attr('cy', y); };
			newObject.getW = function() { return this.attr('r') * 2; };
			newObject.getH = function() { return this.attr('r') * 2; };
		}
		else if(type == Atomic.types.RECT) {
			newObject.getX = function() { return this.attr('x'); };
			newObject.getY = function() { return this.attr('y'); };
			newObject.setX = function(x) { this.attr('x', x); };
			newObject.setY = function(y) { this.attr('y', y); };
			newObject.getW = function(x) { return this.attr('width'); };
			newObject.getH = function(y) { return this.attr('height'); };
		}
		else {
			newObject.getX = function() { return this.attr('x'); };
			newObject.getY = function() { return this.attr('y'); };
			newObject.setX = function(x) { this.attr('x', x); };
			newObject.setY = function(y) { this.attr('y', y); };
			newObject.getW = function(x) { return this.attr('width'); };
			newObject.getH = function(y) { return this.attr('height'); };
		}

		if(type != Atomic.types.TEXT && info.text != null){
			var x = type == Atomic.types.CIRCLE || type == Atomic.types.ELLIPSE ? info.x : info.x + newObject.getW();
			var y = type == Atomic.types.CIRCLE || type == Atomic.types.ELLIPSE ? info.y : info.y + newObject.getH();

			var t = Atomic.draw({
				type : 'text',
				id : info.id + '_text',
				x : x,
				y : y,
				text : info.text
			});
			t.parent = newObject;
			newObject.text = t;
			Atomic.setObjectDragDropHandlers(t);
		}
		
		// return the new object
		return newObject;
	},

	// --------------------------------------------------------------
	/**
	 * Gets the object with the specified ID.
	 */
	get : function(id){
		var type = Atomic.idTypeMap[id];
		if(typeof(type)=='undefined'){
			return false;
		}
		else {
			return Atomic.objects[type][id];
		}
	},

	// --------------------------------------------------------------
	setObjectDragDropHandlers : function(object){
		
		try {
			object.undrag();
			object.drag(Atomic.events.move, Atomic.events.start, Atomic.events.up);
		}
		catch(e){
			alert('Failed to add drag-drop handlers.');
		}
	},

	// --------------------------------------------------------------
	connect : function(object1, object2, connectorType) {

		var pathPoints = [];
		var objects = [object1, object2];

		if(connectorType == null){
			connectorType == Atomic.connectorTypes.LINE;
		}

		for(ndx in objects){
			var obj = objects[ndx];
			var x, y;
			if(obj.type == Atomic.types.CIRCLE || obj.type == Atomic.types.ELLIPSE){
				x = obj.getX();
				y = obj.getY();
			}
			else if(obj.type) {
				x = obj.getX() + obj.getW() / 2;
				y = obj.getY() + obj.getH() / 2;
			}
			else{
				// we have an invalid object, so it cannot be connected, exit now
				console.error('Atomic.connect() received an invalid object: ' + obj);
				return false;
			}
			pathPoints.push([x, y]);
		}

		object1.beforeConnect(object2, pathPoints);
		object2.beforeConnect(object1, pathPoints);
		var pathId = object1.id + Atomic.CONNECTOR_NODE_SEPARATOR + object2.id;
		var connector = Atomic.draw({
			type : Atomic.types.CONNECTOR,
			id : pathId,
			points : pathPoints,
			object1 : object1,
			object2 : object2,
			connectorType : connectorType
		});

		connector.toBack();
		
		object1.onConnect(connector);
		object2.onConnect(connector);
		document.getElementById(pathId).setAttribute('marker-end', 'url(#Arrow)');
		return connector;
	},

	// --------------------------------------------------------------
	updateConnectors : function(object) {	
		var connectors = Atomic.objects[Atomic.types.CONNECTOR];
		for(id in connectors){
			var origConnector = connectors[id];
			var cType = origConnector.connectorType;
			if(id.indexOf(object.id) > -1) {
				var objectIds = id.split(Atomic.CONNECTOR_NODE_SEPARATOR);
				origConnector.remove();
				var obj1 = Atomic.get(objectIds[0]);
				var obj2 = Atomic.get(objectIds[1]);
				if(!obj1){
					console.error('Atomic.updateConnectors(): Could not find an object with ID ' + objectIds[0]);
				}
				else if(!obj2){
					console.error('Atomic.updateConnectors(): Could not find an object with ID ' + objectIds[1]);
				}
				else {
					this.connect(obj1, obj2, cType);
				}
			}
		}
	}
};


/**
 * Events that can be attached to draggable object.
 */
Atomic.events = {
	start : function(ev) {
		this.ox = this.getX();
		this.oy = this.getY();


		if(this.parent && this.parent.toFront){
			this.parent.toFront();
		}
		this.toFront();
		if(this.text && this.text.toFront) {					
			this.text.toFront();
		}
	},
	
	move : function(dx, dy, x, y, ev) {
		// if it's a text item, fire on the "parent" instead
		var idParts = this.id.split('_');
		if(idParts.length==2 && idParts[1]=='text'){
			console.log('**** REDIRECT TO ' + idParts[0]);
			console.log(ev);
			var par = Atomic.get(idParts[0]);			
			par.move(dx, dy, x, y, ev);
		}
		
		this.setX(this.ox + dx);
		this.setY(this.oy + dy);
		Atomic.updateConnectors(this);

		console.log('after move: ' + this.id + ' ' + this.getX() + ',' + this.getY());		
		if(this.text){
			this.text.setX(this.getX());
			this.text.setY(this.getY());
		}		
		
		if(this.parent){			
			this.parent.setX(this.getX());
			this.parent.setY(this.getY());
			Atomic.updateConnectors(this.parent);
		}		
	},
	
	up : function(ev) {
		// on iPhone 3, handlers get removed during DOM removeChild/appendChild of _tofront, so reset them here
		Atomic.setObjectDragDropHandlers(this);
	}
};



// ---------------------------------------------------------------------------------
/**
 * The factory functions for creating different object types.
 */
Atomic.factories = {

	/**
	 * Draws a cricle.
	 * @info an object that must contain id, type, x, y, radius properties.
	 * If a text property is present, the text is rendered at the center
	 * of the circle and the text object will be returned as a property
	 * of the circle.
	 */
	circle : function(info) {
		var c = Atomic.canvas.circle(info.x, info.y, info.radius);
		c.attr(info);
		c.id = info.id;
		Atomic.setObjectDragDropHandlers(c);
		return c;
	},

	ellipse : function(info) {
		var ell = Atomic.canvas.ellipse(info.x, info.y, info.width, info.height);
		ell.attr(info);
		ell.id = info.id;
		Atomic.setObjectDragDropHandlers(ell);
		return ell;
	},

	image : function(info) {
		var img = Atomic.canvas.image(info.src, info.x, info.y, info.width, info.height);
		img.attr(info);
		img.id = info.id;
		Atomic.setObjectDragDropHandlers(img);
		return img;
	},

	/**
	 * Draws a connector. (The same as a path except it's stored in the connectors
	 * object collection and it keeps track of the X/Y coordinates of the two sides.)
	 */
	connector : function(info) {
		var connector = Atomic.factories.path(info);
		connector.points = info.points;
		connector.object1 = info.object1;
		connector.object2 = info.object2;
		connector.connectorType = info.connectorType;
		return connector;
	},

	/**
	 * Draws a line.
	 * @info an object that must contain id, type, and points properties.
	 * Points is an array of x-y coordinates.
	 * {
	 *	points : [ {x,y},{x,y} ]
	 * }
	 */
	path : function(info) {
		var path = '';
		var linePointsStr = '';
		var points = info.points;
		var size = points.length;
		linePointsStr += 'M' + points[0][0] + ' ' + points[0][1];

		if(typeof(info.connectorType)=='undefined'){
			info.connectorType = Atomic.connectorTypes.LINE;
		}

		switch(info.connectorType){		
			case Atomic.connectorTypes.LINE:
				for(var i=1; i<size; i++){
					var point = points[i];
					linePointsStr += ' L' + point[0] + ' ' + point[1];
				}
				path = Atomic.canvas.path(linePointsStr);
				break;

			case Atomic.connectorTypes.ARC:
				for(var i=1; i<size; i++){
					var point = points[i];
					var refPt = points[i - 1];
					var refX = refPt[0];
					var refY = refPt[1] + (point[1] - refPt[1] - ((point[1] - refPt[1]) / 3));
					linePointsStr += 'Q' + refX + ' ' + refY + ' ' + point[0] + ' ' + point[1];
				}
				path = Atomic.canvas.path(linePointsStr);
				break;

			default:
				console.error('Failed to create path for connector. Invalid connectorType: "' + info.connectorType + '"');
				break;
		}
		path.attr(info);
		return path;
	},


	rect : function(info) {
		var rect = Atomic.canvas.rect(info.x, info.y, info.width, info.height);
		rect.attr(info);
		Atomic.setObjectDragDropHandlers(rect);
		return rect;
	},



	/**
	 * Draws text.
	 * @info an object that must contain id, type, x, y, and text properties.
	 */
	text : function(info) {
		var t = Atomic.canvas.text(info.x, info.y, info.text);
		t.attr({'font-size' : Atomic.FONT_SIZE});
		t.attr(info);
		var textId = info.text + '_' + info.x + '_' + info.y;
		t.id = textId;
		return t;
	}
}


// ---------------------------------------------------------------------------------
// Raphael extension to add markers
/* E.g.:
		id : 'Arrow',
		viewBox : '0 0 10 10',
		refX : -7,
		refY : -7,
		markerUnits : 'strokeWidth',
		markerWidth : 10,
		markerHeight : 10,
		orient : 'auto',
		polyline : {
			points : '0,0 10,5 0,10 1,5',
			fill : 'black'
		}
*/
Raphael.fn.addMarker = function(markerInfo){
	var marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
	var ndx, ndx2;
	for(ndx in markerInfo){
		var value = markerInfo[ndx];
		if('|function|object|'.indexOf(typeof(value))==-1){
			marker.setAttribute(ndx, value);
		}
		else if(ndx=='polyline'){
			var polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
			for(ndx2 in value){
				var value2 = value[ndx2];
				if('|function|object|'.indexOf(typeof(value2))==-1){
					polyline.setAttribute(ndx2, value2);
				}
			}
			marker.appendChild(polyline);
		}
	}
	this.defs.appendChild(marker);
};
