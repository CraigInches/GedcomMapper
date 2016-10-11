(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
function hasTag(val) {
    return function(node) {
        return node.tag === val;
    };
}

function d3ize(tree) {
    var peopleNodes = tree
        .filter(hasTag('INDI'))
        .map(toNode);
    var families = tree.filter(hasTag('FAM'));
    var familyNodes = families.map(toNode);
    var links = families.reduce(function(memo, family) {
        return memo.concat(familyLinks(family));
    }, []);
    var allNodes = peopleNodes.concat(familyNodes);
    var indexedNodes = allNodes.reduce(function(memo, node, i) {
        memo[node.id] = i;
        return memo;
    }, {});
    links = links.map(idToIndex(indexedNodes));
    return {
        nodes: allNodes,
        links: links
    };
}

function getName(p) {
    if (p.tag === 'INDI') {
        var nameNode = (p.tree.filter(hasTag('NAME')) || [])[0];
        if (nameNode) {
            return nameNode.data.replace(/\//g, '');
        }
    } else {
        return 'Family';
    }
}

function toNode(p) {
    p.id = p.pointer;
    p.name = getName(p);
    return p;
}

function idToIndex(indexedNodes) {
    return function(link) {
        function getIndexed(id) {
            return indexedNodes[id];
        }
        return {
            source: getIndexed(link.source),
            target: getIndexed(link.target)
        };
    };
}

function familyLinks(family) {
    var memberLinks = family.tree.filter(function(member) {
        // avoid connecting MARR, etc: things that are not
        // people.
        return member.data && member.data[0] === '@';
    }).map(function(member) {
        return {
            source: family.pointer,
            target: member.data
        };
    });
    return memberLinks;
}

module.exports = d3ize;

},{}],2:[function(require,module,exports){
var traverse = require('traverse');

// from https://github.com/madprime/python-gedcom/blob/master/gedcom/__init__.py
// * Level must start with nonnegative int, no leading zeros.
// * Pointer optional, if it exists it must be flanked by '@'
// * Tag must be alphanumeric string
// * Value optional, consists of anything after a space to end of line
//   End of line defined by \n or \r
var lineRe = /\s*(0|[1-9]+[0-9]*) (@[^@]+@ |)([A-Za-z0-9_]+)( [^\n\r]*|)/;

function parse(input) {
    var start = { root: { tree: [] }, level: 0 };
    start.pointer = start.root;

    return traverse(input
        .split('\n')
        .map(mapLine)
        .filter(function(_) { return _; })
        .reduce(buildTree, start)
        .root.tree).map(function(node) {
            delete node.up;
            delete node.level;
            this.update(node);
        });

    // the basic trick of this module is turning the suggested tree
    // structure of a GEDCOM file into a tree in JSON. This reduction
    // does that. The only real trick is the `.up` member of objects
    // that points to a level up in the structure. This we have to
    // censor before JSON.stringify since it creates circular references.
    function buildTree(memo, data) {
        if (data.level === memo.level) {
            memo.pointer.tree.push(data);
        } else if (data.level > memo.level) {
            var up = memo.pointer;
            memo.pointer = memo.pointer.tree[
                memo.pointer.tree.length - 1];
                memo.pointer.tree.push(data);
                memo.pointer.up = up;
                memo.level = data.level;
        } else if (data.level < memo.level) {
            // the jump up in the stack may be by more than one, so ascend
            // until we're at the right level.
            while (data.level <= memo.pointer.level && memo.pointer.up) {
                memo.pointer = memo.pointer.up;
            }
            memo.pointer.tree.push(data);
            memo.level = data.level;
        }
        return memo;
    }

    function mapLine(data) {
        var match = data.match(lineRe);
        if (!match) return null;
        return {
            level: parseInt(match[1], 10),
            pointer: match[2].trim(),
            tag: match[3].trim(),
            data: match[4].trim(),
            tree: []
        };
    }
}

module.exports.parse = parse;
module.exports.d3ize = require('./d3ize');

},{"./d3ize":1,"traverse":3}],3:[function(require,module,exports){
var traverse = module.exports = function (obj) {
    return new Traverse(obj);
};

function Traverse (obj) {
    this.value = obj;
}

Traverse.prototype.get = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!node || !hasOwnProperty.call(node, key)) {
            node = undefined;
            break;
        }
        node = node[key];
    }
    return node;
};

Traverse.prototype.has = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!node || !hasOwnProperty.call(node, key)) {
            return false;
        }
        node = node[key];
    }
    return true;
};

Traverse.prototype.set = function (ps, value) {
    var node = this.value;
    for (var i = 0; i < ps.length - 1; i ++) {
        var key = ps[i];
        if (!hasOwnProperty.call(node, key)) node[key] = {};
        node = node[key];
    }
    node[ps[i]] = value;
    return value;
};

Traverse.prototype.map = function (cb) {
    return walk(this.value, cb, true);
};

Traverse.prototype.forEach = function (cb) {
    this.value = walk(this.value, cb, false);
    return this.value;
};

Traverse.prototype.reduce = function (cb, init) {
    var skip = arguments.length === 1;
    var acc = skip ? this.value : init;
    this.forEach(function (x) {
        if (!this.isRoot || !skip) {
            acc = cb.call(this, acc, x);
        }
    });
    return acc;
};

Traverse.prototype.paths = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.path); 
    });
    return acc;
};

Traverse.prototype.nodes = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.node);
    });
    return acc;
};

Traverse.prototype.clone = function () {
    var parents = [], nodes = [];
    
    return (function clone (src) {
        for (var i = 0; i < parents.length; i++) {
            if (parents[i] === src) {
                return nodes[i];
            }
        }
        
        if (typeof src === 'object' && src !== null) {
            var dst = copy(src);
            
            parents.push(src);
            nodes.push(dst);
            
            forEach(objectKeys(src), function (key) {
                dst[key] = clone(src[key]);
            });
            
            parents.pop();
            nodes.pop();
            return dst;
        }
        else {
            return src;
        }
    })(this.value);
};

function walk (root, cb, immutable) {
    var path = [];
    var parents = [];
    var alive = true;
    
    return (function walker (node_) {
        var node = immutable ? copy(node_) : node_;
        var modifiers = {};
        
        var keepGoing = true;
        
        var state = {
            node : node,
            node_ : node_,
            path : [].concat(path),
            parent : parents[parents.length - 1],
            parents : parents,
            key : path.slice(-1)[0],
            isRoot : path.length === 0,
            level : path.length,
            circular : null,
            update : function (x, stopHere) {
                if (!state.isRoot) {
                    state.parent.node[state.key] = x;
                }
                state.node = x;
                if (stopHere) keepGoing = false;
            },
            'delete' : function (stopHere) {
                delete state.parent.node[state.key];
                if (stopHere) keepGoing = false;
            },
            remove : function (stopHere) {
                if (isArray(state.parent.node)) {
                    state.parent.node.splice(state.key, 1);
                }
                else {
                    delete state.parent.node[state.key];
                }
                if (stopHere) keepGoing = false;
            },
            keys : null,
            before : function (f) { modifiers.before = f },
            after : function (f) { modifiers.after = f },
            pre : function (f) { modifiers.pre = f },
            post : function (f) { modifiers.post = f },
            stop : function () { alive = false },
            block : function () { keepGoing = false }
        };
        
        if (!alive) return state;
        
        function updateState() {
            if (typeof state.node === 'object' && state.node !== null) {
                if (!state.keys || state.node_ !== state.node) {
                    state.keys = objectKeys(state.node)
                }
                
                state.isLeaf = state.keys.length == 0;
                
                for (var i = 0; i < parents.length; i++) {
                    if (parents[i].node_ === node_) {
                        state.circular = parents[i];
                        break;
                    }
                }
            }
            else {
                state.isLeaf = true;
                state.keys = null;
            }
            
            state.notLeaf = !state.isLeaf;
            state.notRoot = !state.isRoot;
        }
        
        updateState();
        
        // use return values to update if defined
        var ret = cb.call(state, state.node);
        if (ret !== undefined && state.update) state.update(ret);
        
        if (modifiers.before) modifiers.before.call(state, state.node);
        
        if (!keepGoing) return state;
        
        if (typeof state.node == 'object'
        && state.node !== null && !state.circular) {
            parents.push(state);
            
            updateState();
            
            forEach(state.keys, function (key, i) {
                path.push(key);
                
                if (modifiers.pre) modifiers.pre.call(state, state.node[key], key);
                
                var child = walker(state.node[key]);
                if (immutable && hasOwnProperty.call(state.node, key)) {
                    state.node[key] = child.node;
                }
                
                child.isLast = i == state.keys.length - 1;
                child.isFirst = i == 0;
                
                if (modifiers.post) modifiers.post.call(state, child);
                
                path.pop();
            });
            parents.pop();
        }
        
        if (modifiers.after) modifiers.after.call(state, state.node);
        
        return state;
    })(root).node;
}

function copy (src) {
    if (typeof src === 'object' && src !== null) {
        var dst;
        
        if (isArray(src)) {
            dst = [];
        }
        else if (isDate(src)) {
            dst = new Date(src.getTime ? src.getTime() : src);
        }
        else if (isRegExp(src)) {
            dst = new RegExp(src);
        }
        else if (isError(src)) {
            dst = { message: src.message };
        }
        else if (isBoolean(src)) {
            dst = new Boolean(src);
        }
        else if (isNumber(src)) {
            dst = new Number(src);
        }
        else if (isString(src)) {
            dst = new String(src);
        }
        else if (Object.create && Object.getPrototypeOf) {
            dst = Object.create(Object.getPrototypeOf(src));
        }
        else if (src.constructor === Object) {
            dst = {};
        }
        else {
            var proto =
                (src.constructor && src.constructor.prototype)
                || src.__proto__
                || {}
            ;
            var T = function () {};
            T.prototype = proto;
            dst = new T;
        }
        
        forEach(objectKeys(src), function (key) {
            dst[key] = src[key];
        });
        return dst;
    }
    else return src;
}

var objectKeys = Object.keys || function keys (obj) {
    var res = [];
    for (var key in obj) res.push(key)
    return res;
};

function toS (obj) { return Object.prototype.toString.call(obj) }
function isDate (obj) { return toS(obj) === '[object Date]' }
function isRegExp (obj) { return toS(obj) === '[object RegExp]' }
function isError (obj) { return toS(obj) === '[object Error]' }
function isBoolean (obj) { return toS(obj) === '[object Boolean]' }
function isNumber (obj) { return toS(obj) === '[object Number]' }
function isString (obj) { return toS(obj) === '[object String]' }

var isArray = Array.isArray || function isArray (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

var forEach = function (xs, fn) {
    if (xs.forEach) return xs.forEach(fn)
    else for (var i = 0; i < xs.length; i++) {
        fn(xs[i], i, xs);
    }
};

forEach(objectKeys(Traverse.prototype), function (key) {
    traverse[key] = function (obj) {
        var args = [].slice.call(arguments, 1);
        var t = new Traverse(obj);
        return t[key].apply(t, args);
    };
});

var hasOwnProperty = Object.hasOwnProperty || function (obj, key) {
    return key in obj;
};

},{}],4:[function(require,module,exports){
var gedcom = require('parse-gedcom');

window.onload = function(){
if (window.File && window.FileReader && window.FileList && window.Blob) {
      var gedcomFile = document.getElementById('gedcomFile');
      gedcomFile.addEventListener('change', function(e) {
          var file = gedcomFile.files[0];
          var reader = new FileReader();
          var map;
          reader.onload = function(e){
              json = gedcom.parse(reader.result);
              parseJson(json);
          }
      reader.readAsText(file);
      });
  }
  else {
      alert('The File APIs are not fully supported by your browser.');
  };
};
window.initMap = function() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: 51.747615, lng: -1.314017},
     zoom: 6 
    });
}

function onClick() {
    var serverUrl = "https://services.xayto.net/Tree.json";
    var request = new XMLHttpRequest();
    request.open('GET', serverUrl, false);
    request.send();
    if(request.readyState == 4 && request.status == 200){
        var serverResult= request.responseText;
        parseJson(serverResult);
    }
} 

function parseJson (json, jsonFlag){
    if(jsonFlag == 0){
        try{
            var tree = JSON.parse(json);
        }
        catch(err){
            console.log(err);
        }
    }
    else{
        var tree = json;
    }
    var birthplace = "doh";
    var b;
    var a;
    var btree;
    var ptree;
    var i;
    var name;
        for(i = 0; i <= tree.length  ; i++){
            try{
                if( tree[i].tag == "INDI"){
                    ptree = null;
                    try{
                        ptree = tree[i].tree
                        for(b = 0; b <= ptree.length; b++){
                            try{
                                if(ptree[b].tag == "BIRT"){
                                    btree = null;
                                    birthplace = null;
                                    btree = ptree[b].tree;
                                    for(a = 0; a <= btree.length; a++){
                                        try{
                                            if(btree[a].tag == "PLAC"){
                                                birthplace = btree[a].data;
                                            }
                                        }
                                        catch (err){
                                            console.log(err);
                                        }
                                    }
                                }
                                else{
                                    if(ptree[b].tag == "NAME"){
                                        name = null;
                                        name = ptree[b].data;
                                    }
                                }
                            }
                            catch (err){
                                console.log(err);
                            }
                        }
                }
                catch (err){
                    console.log(err);
                }
            }
                if(birthplace != null){
                    var placeId = coOrds(birthplace);
                    createMarker(name, placeId, birthplace);
                    updatetable(name, placeId, birthplace);
                }
            }
            catch(err){
                console.log(err)
            }
        }
};
function updatetable(name, placeId, birthplace){
    var table = document.getElementById("resultsList"      );
    var newRow = table.insertRow(0);
    var nameCell = newRow.insertCell(0);
    var birthplaceCell = newRow.insertCell(1);
    var placeCell = newRow.insertCell(2);
    var nameText = document.createTextNode(name);
    nameCell.appendChild(nameText);
    var birthplaceText = document.createTextNode(birthplace);
    birthplaceCell.appendChild(birthplaceText);
    var placeIdText = document.createTextNode(JSON.stringify(placeId));
    placeCell.appendChild(placeIdText);
}

function coOrds(birthplace){
    var url="https://maps.googleapis.com/maps/api/geocode/json?address=" + birthplace + "&key=AIzaSyAI0_rYDWsCtuIf3vQRYDk6YxCmEI445dY";
    var request = new XMLHttpRequest();
    var response = 1;
    var location = 1;
    request.open('GET', url, false);
    request.send();
    if(request.readyState == 4 && request.status == 200){
        try{
            response = JSON.parse(request.responseText);
            location = response.results[0].geometry.location;
        }
        catch(err){
            console.log(err)    
        }
        }
    return location; 
}

function createMarker(name, locale, birthplace){
    var marker = new google.maps.Marker({
        map: map,
        position: locale,
        title: name});
    var infowindow = new google.maps.InfoWindow({
        content: name + "<br>" + birthplace});
    marker.setMap(map);
    marker.addListener('click', function() {
        infowindow.open(map, marker);});
}

},{"parse-gedcom":2}]},{},[4]);
