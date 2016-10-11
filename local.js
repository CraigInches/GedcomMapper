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

