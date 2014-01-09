/*
 * Copyright (c) 2014 Christopher Rhodes
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

var trace = flash.trace;

function include(filename) {
  var scriptPath = FLfile.uriToPlatformPath(fl.scriptURI);
  var scriptPathEnd = scriptPath.lastIndexOf("/");
  scriptPath = scriptPath.slice(0, scriptPathEnd + 1);
  fl.runScript(FLfile.platformPathToURI(scriptPath + filename));
}

include("JSON-js/json2.js");

var exportParts = {};

function libraryname(item) {
  var itemPath = item.name.toString().split("/");
  var itemName = itemPath[itemPath.length - 1];

  return itemName;
}

function elementname(element) {
  return libraryname(element.libraryItem);
}

function elementpartkey(element, layer) {
  return elementname(element) + "_" + layer;
}

function keyframe(f, frame, matrix) {
  var keyframe = {f: f}
  if (matrix) {
    keyframe.m = matrix;
  }
  if (frame && frame.tweenType == "motion") {
    keyframe.t = frame.tweenEasing / 100;
  }
  return keyframe;
}

function animation(item) {
  var animationPath = item.name.toString().split("/");
  var animationName = animationPath[animationPath.length - 1].substring(1);

  var timeline = item.timeline;

  var l;
  var totalFrames = 0;

  for (l = 0; l < timeline.layers.length; l++) {
    totalFrames = Math.max(totalFrames, timeline.layers[l].frames.length)
  }

  var lastFrame = -1;
  var firstFrame = true;
  var firstItem = true;

  var parts = []
  var partsMap = {};

  var active, current;

  var hasSize = false;

  for (l = 0; l < timeline.layers.length; l++) {
    var layer = timeline.layers[l];

    active = {};

    for (var f = 0; f < layer.frames.length; f++) {
      var frame = layer.frames[f];
      var key, part;

      if (f == frame.startFrame) {
        current = {};

        for (var e = 0; e < frame.elements.length; e++) {
          var element = frame.elements[e];
          if (element.libraryItem) {
            var name = elementname(element);
            if (!exportParts[name]) {
              exportParts[name] = element.libraryItem;
            }
            key = elementpartkey(element, l);
            var index = partsMap[key];
            if (index == undefined) {
              index = parts.length;
              partsMap[key] = index;
              parts[index] = {name: name, layer: l, keyframes: []};;
            }
            current[key] = element.matrix;

            if (element.width && element.height) {
              hasSize = true;
            }
          }
        }

        for (key in active) {
          part = parts[partsMap[key]];
          if (current[key]) {
            // The part has a keyframe on this frame
            part.keyframes.push(keyframe(f, frame, current[key]));
          } else {
            delete part.keyframes[part.keyframes.length - 1].t;
            // The part has been removed.
            part.keyframes.push(keyframe(f, null, null));
          }
        }

        for (key in current) {
          if (!active[key]) {
            // The part is new for this frame.
            part = parts[partsMap[key]];
            // The part has a keyframe on this frame
            part.keyframes.push(keyframe(f, frame, current[key]));
          }
        }

        active = current;
      }

      if (f == layer.frames.length - 1 && f != totalFrames - 1) {
        // Add a remove keyframe, as this layer is cut short.
        for (key in active) {
          delete part.keyframes[part.keyframes.length - 1].t;
          part.keyframes.push(keyframe(f + 1, null, null));
        }
      }

    }
  }

  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (part.keyframes.length && part.keyframes[0].f != 0) {
      part.keyframes.unshift(keyframe(0, null, null));
    }
  }

  if (!hasSize) {
    return null;
  }

  return {name: animationName, parts: parts, frames: totalFrames};
}

var doc = fl.getDocumentDOM();

var library = doc.library;

var animations = {};
var i;

for (i = 0; i < library.items.length; i++) {
  var item = library.items[i];
  // Make sure the item is an animation.
  if ((item.name.indexOf("_") == 0 || item.name.indexOf("/_") != -1) &&
      item.itemType == "movie clip") {
    var anim = animation(item);
    if (anim) {
      animations[anim.name] = anim;
      delete anim.name;
    }
  } else if (item.linkageClassName && (item.name.indexOf("_") != 0 && item.name.indexOf("/_") == -1) &&
            item.itemType == "movie clip") {
    exportParts[libraryname(item)] = item;
  }
}

var folderURI = fl.browseForFolderURL("Select a folder.");

var originalWidth = doc.width;
var originalHeight = doc.height;

doc.exitEditMode();
doc.addNewScene("__export__");

var parts = {};
var partsArray = [];
var items = {};

var minWidth = 0;

var PADDING = 1;

for (var key in exportParts) {
  if (key.indexOf("_") == 0) {
    continue;
  }

  doc.addItem({x: 0, y: 0}, exportParts[key]);

  var elements = doc.timelines[doc.currentTimeline].layers[0].frames[0].elements;

  var item = elements[elements.length - 1];

  item.x = 0;
  item.y = 0;

  var x = item.left;
  var y = item.top;

  item.x = Math.ceil(-x);
  item.y = Math.ceil(-y);

  var dx = item.x + x;
  var dy = item.y + y;

  var w = Math.ceil(dx) + Math.ceil(item.width);
  var h = Math.ceil(dy) + Math.ceil(item.height);

  minWidth = Math.max(w, minWidth);

  if (item.width != 0 && item.height != 0) {
    var d = w / h;
    if (d > 0) {
      d = 1 / d;
    }
    parts[key] = {src:key + ".png", x: -x + dx, y: -y + dy, w: w, h: h, area: w * h * d, key: key};
    partsArray.push(parts[key]);
    items[key] = item;
  }
}

partsArray.sort(function(a,b){ return b.area - a.area });


var maxWidth = partsArray[0].w;

var actualWidth;
var actualHeight;

var rectArray;

do {
  maxWidth = Math.max(maxWidth * 2, minWidth);

  actualWidth = 0;
  actualHeight = 0;

  var currX = 0;
  var currY = 0;

  var nextY = 0;

  rectArray = [];
  for (i = 0; i < partsArray.length; i++) {
    var part = partsArray[i];
    var rect = {x: currX, y: currY};

    currX += part.w + PADDING;

    if (currX >= maxWidth) {
      currX = part.w + PADDING;
      currY += nextY + PADDING;
      nextY = part.h + PADDING;

      rect.x = 0;
      rect.y = currY;
    } else {
      nextY = Math.max(nextY, part.h + PADDING);
    }

    actualWidth = Math.max(actualWidth, rect.x + part.w);
    actualHeight = Math.max(actualHeight, rect.y + part.h);

    rectArray[i] = rect;
  }
} while (actualHeight > actualWidth && nextY != 0);

for (i = 0; i < partsArray.length; i++) {
  part = partsArray[i];
  item = items[part.key];

  item.x = part.x + rectArray[i].x;
  item.y = part.y + rectArray[i].y;

  part.px = rectArray[i].x;
  part.py = rectArray[i].y;

  delete part.area;
  delete part.key;
  delete part.src;
}

doc.width = actualWidth + PADDING;
doc.height = actualHeight + PADDING;

doc.exportPNG(folderURI + "/item.png", true, true);

doc.deleteScene();

doc.width = originalWidth;
doc.height = originalHeight;

fl.outputPanel.clear();
fl.outputPanel.trace(JSON.stringify({animations: animations, parts: parts, src: "item.png"}));
fl.outputPanel.save(folderURI + "/item.json");
fl.outputPanel.clear();
