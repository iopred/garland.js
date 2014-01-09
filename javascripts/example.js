var item;
var armor;
var sword;

var garland = new Garland("ChubbyPuppet", 24);
document.getElementById("garland").appendChild(garland.getElement());

garland.play("Idle");

garland.getElement().style.position = "relative";
garland.getElement().style.left = "100%";
garland.getElement().style.top = "100%";

function loadItem(url, callback) {
  var req = new XMLHttpRequest;
  req.overrideMimeType("application/json");
  req.open('GET', url);
  req.onload = function() {
    callback(JSON.parse(req.responseText));
  };
  req.send(null);
}

loadItem("items/chubbypuppet/item.json", function(json) {
  item = json;
  item.basePath = "items/chubbypuppet/";
  garland.addItem(item);
});

loadItem("items/armor/item.json", function(json) {
  armor = json;
  armor.basePath = "items/armor/";
});

loadItem("items/sword/item.json", function(json) {
  sword = json;
  sword.basePath = "items/sword/";
});

var last = 0;
function update(timestamp) {
  var ms = timestamp - last;
  last = timestamp;

  garland.update(ms);
  window.requestAnimationFrame(update);
}
update(0);
