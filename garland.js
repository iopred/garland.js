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

function Garland(id, frameRate) {
  this.element = document.createElement("div");
  this.element.id = id || "Garland" + this.__index__++;
  this.element.style.position = "absolute";

  this.items = [];

  this.partElements = {};
  this.partGarlands = {};

  this.renderedParts = {};
  this.activeParts = {};

  this.animationName = null;

  this.currentFrame = 0;
  this.currentAnimationIndexes = [];

  this.frameRate = frameRate;
  this.frameTime = Math.round(1000 / this.frameRate);
  this.timer = 0;
  this.ms = 0;
}

// Private methods.

Garland.prototype.__index__ = 0;

Garland.prototype.getElement = function() {
  return this.element;
};

Garland.prototype.clear = function(element) {
  while (element.hasChildNodes()) {
    element.removeChild(element.lastChild);
  }
};

Garland.prototype.transformMatrix = function(matrix) {
  return "matrix(" + matrix.a + ", " + matrix.b + ", " + matrix.c + ", " + matrix.d + ", " + matrix.tx + ", " + matrix.ty + ")";
};

Garland.prototype.interpolateMatrix = function(start, end, perc) {
  return {a: this.interpolate(start.a, end.a, perc), b: this.interpolate(start.b, end.b, perc), c: this.interpolate(start.c, end.c, perc), d: this.interpolate(start.d, end.d, perc), tx: this.interpolate(start.tx, end.tx, perc), ty: this.interpolate(start.ty, end.ty, perc)};
};


Garland.prototype.interpolate = function(start, end, perc) {
  return start + (end - start) * perc;
};

Garland.prototype.getAnimation = function(name) {
  for (var i = this.items.length -1; i >= 0; i--) {
    var animations = this.items[i].animations;
    if (animations && animations[name]) {
      return animations[name];
    }
  }
  return null;
};

Garland.prototype.clearParts = function() {
  for (var partElementName in this.partElements) {
    var partElement = this.partElements[partElementName];
    this.clear(partElement);
  }
  for (var garland in this.partGarlands) {
    this.partGarlands[garland].clearParts();
  }
  this.renderedParts = {};
  this.activeParts = {};
};

Garland.prototype.getPartElementName = function(partName, layer) {
  return partName + "_" + layer;
};

Garland.prototype.getPartElement = function(partName, layer) {
  var partElementName = this.getPartElementName(partName, layer);

  if (partName.indexOf("_") == 0) {
    // The part is actually an animation, make a sub Garland.
    var garland = this.partGarlands[partElementName];

    if (!garland) {
      garland = new Garland(partElementName, this.frameRate);
      // Make a direct link to our items, that way when ours change, the sub garlands will too.
      garland.items = this.items;
      garland.play(partName.substring(1));

      this.partGarlands[partElementName] = garland;
    }

    this.partElements[partElementName] = garland.getElement();
    this.renderedParts[partElementName] = true;

    return garland.getElement();
  }

  var partElement = this.partElements[partElementName];
  if (!partElement) {
    partElement = document.createElement("div");
    partElement.id = partElementName;
    partElement.style.position = "absolute";
    this.partElements[partElementName] = partElement;
  }

  if (!this.renderedParts[partElementName]) {
    for (var i = 0; i < this.items.length; i++) {
      var item = this.items[i].parts;
      var itemSrc = this.items[i].src;
      var basePath = this.items[i].basePath || "";

      var itemPart = item[partName];
      if (itemPart) {
        var itemPartElement;
        if (itemPart.src) {
          itemPartElement = document.createElement("img");
          itemPartElement.src = basePath + itemPart.src;
          itemPartElement.width = itemPart.w;
          itemPartElement.height = itemPart.h;
        } else {
          itemPartElement = document.createElement("div");
          itemPartElement.style.backgroundImage = "url('" + basePath + itemSrc + "')";
          itemPartElement.style.backgroundPosition =  -itemPart.px + "px " + -itemPart.py + "px";
          itemPartElement.style.width = itemPart.w + "px";
          itemPartElement.style.height = itemPart.h + "px";
          itemPartElement.style.webkitBackfaceVisibility = "hidden";
        }
        itemPartElement.id = partElementName + "_" + i;
        itemPartElement.style.position = "absolute";
        if (itemPart.x != 0 || itemPart.y != 0) {
          itemPartElement.style.left = -itemPart.x + "px";
          itemPartElement.style.top = -itemPart.y + "px";
        }
        partElement.appendChild(itemPartElement);
      }

    }

    this.renderedParts[partElementName] = true;
  }

  return partElement;
};

Garland.prototype.render = function() {
  var animation = this.getAnimation(this.animationName) || this.getAnimation("Idle");
  // If we are rendering an invalid animation, use the first animation possible, or bail.
  if (!animation) {
    for (var i = 0; i < this.items.length; i++) {
      if (animation) {
        break;
      }
      for (var a in this.items[i].animations) {
        animation = this.items[i].animations[a];
        break;
      }
    }
    if (!animation) {
      return;
    }
  }

  while (this.currentFrame >= animation.frames) {
    this.currentFrame -= animation.frames;
  }

  var currentParts = {};
  var last;

  for (var i = animation.parts.length - 1; i >= 0; i--) {
    var part = animation.parts[i];
    var keyframes = part.keyframes;
    var frame = null;
    var nextFrame = null;

    // Try to pick up where we left off, this will save time on long animations.
    var j = this.currentAnimationIndexes[i] || 0;
    if (j >= keyframes.length || keyframes[j].f > this.currentFrame) {
      j = 0;
    }
    for (; j < keyframes.length; j++) {
      if (keyframes[j].f <= this.currentFrame) {
        frame = keyframes[j];
        if (frame.t != null) {
          nextFrame = keyframes[j + 1]
        } else {
          nextFrame = null;
        }
      }
    }
    this.currentAnimationIndexes[i] = j;

    // If this frame has a valid matrix, we are visible.
    if (frame && frame.m) {
      var partElement = this.getPartElement(part.name, part.layer);

      if (nextFrame) {
        var tweenTime = ((this.currentFrame - frame.f) * this.frameTime) + this.timer;
        var totalTime = (nextFrame.f - frame.f) * this.frameTime;
        var ratio = tweenTime / totalTime;
        var ease = 0;
        if (frame.t > 0) {
          ease = ratio * ratio;
        } else if (frame.t < 0) {
          ease = ratio * (2 - ratio);
        }
        if (ease) {
          ratio = ratio + (ratio - ease) * Math.abs(frame.t);
        }
        partElement.style.webkitTransform = this.transformMatrix(this.interpolateMatrix(frame.m, nextFrame.m, ratio));
      } else {
        partElement.style.webkitTransform = this.transformMatrix(frame.m);
      }

      currentParts[partElement.id] = partElement;
      if (!this.activeParts[partElement.id]) {
        // If a garland is newly added, reset its frame so it restarts at 0.
        if (this.partGarlands[partElement.id]) {
          this.partGarlands[partElement.id].restart();
        }
        if (!last) {
          // If this is the first thing to be added, add it.
          this.element.appendChild(partElement);
        } else {
          // Otherwise add it directly after the last part.
          this.element.insertBefore(partElement, last.nextSibling);
        }
      }

      // If this part is a garland, then update it so it animates in step.
      if (this.partGarlands[partElement.id]) {
        this.partGarlands[partElement.id].update(this.ms);
      }

      last = partElement;
    }
  }

  // Step through all our previously active parts, if they are no longer active, remove them.
  for (var k in this.activeParts) {
    if (!currentParts[k]) {
      this.element.removeChild(this.activeParts[k]);
    }
  }
  this.activeParts = currentParts;
};

// Public methods.

Garland.prototype.addItem = function(item) {
  if (!item) {
    return;
  }

  this.items.push(item);

  this.clearParts();
  this.render();
};

Garland.prototype.removeItem = function(item) {
  if (!item) {
    return;
  }

  for (var i = 0; i < this.items.length; i++) {
    if (this.items[i] == item) {
      this.items.splice(i, 1);
      break;
    }
  }

  this.clearParts();
  this.render();
};

Garland.prototype.toggleItem = function(item) {
  var index = this.items.indexOf(item);
  if (index == -1) {
    this.items.push(item);
  } else {
    this.items.splice(index, 1);
  }

  this.clearParts();
  this.render();
};

Garland.prototype.play = function(animationName) {
  this.animationName = animationName;
  this.currentFrame = 0;
  this.currentAnimationIndexes = [];
  // We must re-add all the parts as orders may have changed.
  this.clear(this.element);
  this.activeParts = {};
  this.render();
};

Garland.prototype.update = function(ms) {
  this.ms = ms;
  this.timer += ms;

  while (this.timer > this.frameTime) {
    this.timer -= this.frameTime;
    this.currentFrame++;
  }
  this.render();
};

Garland.prototype.restart = function() {
  this.currentFrame = 0;
  for (var garland in this.partGarlands) {
    this.partGarlands[garland].restart();
  }
};
