// Thanks to Dom Pajak for his original Arduino BLE Sense connection demo:
// https://arduino.github.io/ArduinoAI/BLESense-test-dashboard/

var maxRecords = 64;
var STROKE_POINT_COUNT = 160;
var MESSAGE_COUNT = 1;
var API_ENDPOINT_URL = 'https://<ip-address>/api/<username>/lights/5/state'; //Need to fill out bridge ip and username for HUE Hub

// UI elements
const bigButton = document.getElementById('bigButton');
const BLEstatus = document.getElementById('bluetooth');

if ("bluetooth" in navigator) {
  bigButton.addEventListener('click', function(event) {
    connect();
  });
  // else the browser doesn't support bluetooth
} else {
  msg("Browser not supported"); bigButton.style.backgroundColor = "red";
  alert("Error: This browser doesn't support Web Bluetooth. Try using Chrome.");
}

//-----------------------------------------------------------------------------------//
// FUNCTIONS FOR CONNECTING TO BLUETOOTH AND GRABBING SENSOR DATA
function msg(m){
  BLEstatus.innerHTML = m;
}

async function connect() {
  bigButton.style.backgroundColor="grey";
  msg('Requesting device ...');

  const device = await navigator.bluetooth.requestDevice({
    filters: [
      {
        services: [SERVICE_UUID] // SERVICE_UUID
      }
    ]
  });

  msg('Connecting to device ...');
  device.addEventListener('gattserverdisconnected', onDisconnected);
  const server = await device.gatt.connect();

  msg('Getting primary service ...');
  const service = await server.getPrimaryService(SERVICE_UUID);

  // Set up the characteristics
  for (const sensor of sensors) {
    msg('Characteristic '+sensor+"...");
    BLEsense[sensor].characteristic = await service.getCharacteristic(BLEsense[sensor].uuid);
    // Set up notification
    if (BLEsense[sensor].properties.includes("BLENotify")){
      BLEsense[sensor].characteristic.addEventListener('characteristicvaluechanged',function(event){handleIncoming(BLEsense[sensor],event.target.value);});
      await BLEsense[sensor].characteristic.startNotifications();
    }
    // Set up polling for read
    if (BLEsense[sensor].properties.includes("BLERead")){
      BLEsense[sensor].polling = setInterval(function() {
        BLEsense[sensor].characteristic.readValue().then(function(data){handleIncoming(BLEsense[sensor],data);})}
        , 200);
      }

      BLEsense[sensor].rendered = false;
    }
    bigButton.style.backgroundColor = 'green';
    msg('Connected.');
  }

  //-----------------------------------------------------------------------------------//
  // HANDLE INCOMING DATA FROM THE ARDUINO
  function getStrokePoints(dataview, byteOffset, littleEndian) {
    var result = [];
    var currentOffset = byteOffset;
    for (var i = 0; i < STROKE_POINT_COUNT; ++i) {
      var entry = {};
      entry.x = dataview.getInt8(currentOffset, littleEndian) / 128.0;
      currentOffset += 1;
      entry.y = dataview.getInt8(currentOffset, littleEndian) / 128.0;
      currentOffset += 1;
      result.push(entry);
    }
    return result;
  }

  function handleIncoming(sensor, dataReceived) {
    const columns = Object.keys(sensor.data); // column headings for this sensor
    //console.log('columns: ' + columns);
    const typeMap = {
      "Uint8":    {fn:DataView.prototype.getUint8,    bytes:1}, // The index value from Arduino will use this type map
      "Uint16":   {fn:DataView.prototype.getUint16,   bytes:2},
      "Int32":    {fn:DataView.prototype.getInt32,   bytes:4},
      "Float32":  {fn:DataView.prototype.getFloat32,  bytes:4},
      "StrokePoints": {fn:getStrokePoints, bytes:(STROKE_POINT_COUNT * 2 * 1)}
    };
    var packetPointer = 0,i = 0;

    // Read each sensor value in the BLE packet and push into the data array
    sensor.structure.forEach(function(dataType){   
      //console.log('data type: ' + dataType);
      var unpackedValue;
      // Case for Stroke Points
      if (dataType === "StrokePoints") {
        var dataViewFn = typeMap[dataType].fn;
        unpackedValue = dataViewFn(dataReceived, packetPointer,true);
      } else {
        var dataViewFn = typeMap[dataType].fn.bind(dataReceived);
        unpackedValue = dataViewFn(packetPointer,true);
      }
      // Push sensor reading onto data array
      sensor.data[columns[i]].push(unpackedValue);
      //console.log('sensor data: ' + sensor.data[columns[i]]);
      // Keep array at buffer size
      if (sensor.data[columns[i]].length> maxRecords) {sensor.data[columns[i]].shift();}
      // move pointer forward in data packet to next value
      packetPointer += typeMap[dataType].bytes;
      bytesReceived += typeMap[dataType].bytes;
      i++;
    });
    sensor.rendered = false; // flag - vizualization needs to be updated
    if (typeof sensor.onUpdate != 'undefined') {
      sensor.onUpdate(); // Call function listed in struct below based on sent typeMap
    }
  }
  //---------------------------------------------------------------------------------------------//

  function onDisconnected(event) {
    let device = event.target;
    bigButton.style.backgroundColor="red";
    // clear read polling
    for (const sensor of sensors) {
      if(typeof BLEsense[sensor].polling !== 'undefined'){
        clearInterval(BLEsense[sensor].polling);
      }
    }
    msg('Device ' + device.name + ' is disconnected.');
  }

//-----------------------------------------------------------------------------------//
// API FUNCTIONS FOR PHILIPS HUE LIGHT HUB
function switchLightOn() {
  // Define the API endpoint URL
  const apiUrl = API_ENDPOINT_URL;

  const request = new XMLHttpRequest();
  request.open('PUT', apiUrl, true); // Set method, URL, and async flag

  // Optional: Set headers (if needed)
  // request.setRequestHeader('Authorization', 'Bearer YOUR_API_KEY');
  // request.setRequestHeader('Content-Type', 'application/json');

  // Set request body (data to send)
  request.setRequestHeader('Content-Type', 'application/json');
  request.send(JSON.stringify({ "on": true }));
  var apiStatusDiv = document.getElementById("api_status");
  // Handle response
  request.onreadystatechange = function () {
    if (request.readyState === 4) { // Check if request is complete
      if (request.status === 200) {
        console.log('Light successfully turned on.');
        apiStatusDiv.innerHTML = 'Light successfully turned on. ' + request.statusText;
      } else {
        console.log(request.statusText);
        console.error('Error turning on light:' + request.statusText);
        apiStatusDiv.innerHTML = 'Error turning on light: ' + request.statusText;
      }
    }
  };
}

function switchLightOff() {
  // Define the API endpoint URL
  const apiUrl = API_ENDPOINT_URL;

  const request = new XMLHttpRequest();
  request.open('PUT', apiUrl, true); // Set method, URL, and async flag

  // Optional: Set headers (if needed)
  // request.setRequestHeader('Authorization', 'Bearer YOUR_API_KEY');
  // request.setRequestHeader('Content-Type', 'application/json');

  // Set request body (data to send)
  request.setRequestHeader('Content-Type', 'application/json');
  request.send(JSON.stringify({ "on": false }));
  var apiStatusDiv = document.getElementById("api_status");
  // Handle response
  request.onreadystatechange = function () {
    if (request.readyState === 4) { // Check if request is complete
      if (request.status === 200) {
        console.log('Light successfully turned off.');
        apiStatusDiv.innerHTML = 'Light successfully turned off. ' + request.statusText;
      } else {
        console.log(request.statusText);
        console.error('Error turning off light:' + request.statusText);
        apiStatusDiv.innerHTML = 'Error turning off light: ' + request.statusText;
      }
    }
  };
}

function switchLightOnAndBrighten() {
  // Define the API endpoint URL
  const apiUrl = API_ENDPOINT_URL;

  const request = new XMLHttpRequest();
  request.open('PUT', apiUrl, true); // Set method, URL, and async flag

  // Optional: Set headers (if needed)
  // request.setRequestHeader('Authorization', 'Bearer YOUR_API_KEY');
  // request.setRequestHeader('Content-Type', 'application/json');
  // Set request body (data to send)
  request.setRequestHeader('Content-Type', 'application/json');
  request.send(JSON.stringify({"on":true, "bri":254}));
  var apiStatusDiv = document.getElementById("api_status");
  // Handle response
  request.onreadystatechange = function () {
    if (request.readyState === 4) { // Check if request is complete
      if (request.status === 200) {
        console.log('Light successfully turned on and brightened.');
        apiStatusDiv.innerHTML = 'Light  turned on and brightened. ' + request.statusText;
      } else {
        console.error('Error turning off on and brightening:' + request.statusText);
        apiStatusDiv.innerHTML = 'Error turning on and brightening: ' + request.statusText;
      }
    }
  };
}

function switchLightOnAndDim() {
  // Define the API endpoint URL
  const apiUrl = API_ENDPOINT_URL;

  const request = new XMLHttpRequest();
  request.open('PUT', apiUrl, true); // Set method, URL, and async flag

  // Optional: Set headers (if needed)
  // request.setRequestHeader('Authorization', 'Bearer YOUR_API_KEY');
  // request.setRequestHeader('Content-Type', 'application/json');

  // Set request body (data to send)
  request.setRequestHeader('Content-Type', 'application/json');
  request.send(JSON.stringify({"on":true, "bri":100}));
  var apiStatusDiv = document.getElementById("api_status");
  // Handle response
  request.onreadystatechange = function () {
    if (request.readyState === 4) { // Check if request is complete
      if (request.status === 200) {
        console.log('Light successfully turned on and Dimmed.');
        apiStatusDiv.innerHTML = 'Light successfully turned on and Dimmed.' + request.statusText;
      } else {
        console.error('Error turning on light and dimming:' + request.statusText);
        apiStatusDiv.innerHTML = 'Error turning on light and dimming: ' + request.statusText;
      }
    }
  };
}


//-----------------------------------------------------------------------------------//
// FUNCTIONS FOR DRAWING GESTURE
function initStrokeGraph() {
  var canvas = document.getElementById('stroke');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawStrokeGraph(canvas, strokePoints, strokeDataLength) {
  const ctx = canvas.getContext('2d');

  var canvasWidth = canvas.width;
  var canvasHeight = canvas.height;
  var halfHeight = canvasHeight / 2;
  var halfWidth = canvasWidth / 2;
  
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  for (var i = 0; i < strokeDataLength; ++i) {
    var x = strokePoints[i].x;
    var y = strokePoints[i].y;
    
    var xCanvas = halfWidth + (x * halfWidth);
    var yCanvas = halfHeight - (y * halfHeight);
    
    if (i === 0) {
      ctx.moveTo(xCanvas, yCanvas);
    } else if (i == (strokeDataLength - 1)) {
      ctx.lineTo(xCanvas+5, yCanvas+5);
      ctx.lineTo(xCanvas-5, yCanvas-5);
      ctx.moveTo(xCanvas+5, yCanvas-5);
      ctx.moveTo(xCanvas-5, yCanvas+5);      
    } else {
      ctx.lineTo(xCanvas, yCanvas);
    }
  }
  ctx.stroke();  
}
  
var previousStrokeState = 0;
  
function updateStrokeGraph() {
  //console.log('Calling updateStrokeGraph....');
  var strokeData = BLEsense['stroke'].data;
  var strokeDataLength = strokeData.length.latest();
  var strokeState = strokeData.state.latest();
  var strokePoints = strokeData.strokePoints.latest();
  strokePoints = strokePoints.slice(0, strokeDataLength);
  
  // if ((strokeState == 2) && (previousStrokeState != 2)) {
  //   storeStroke(strokePoints); 
  // }
  previousStrokeState = strokeState;
  
  var label = document.getElementById('stroke_label');
  if (strokeState == 0) {
    label.innerText = "Waiting for gesture";
  } else if (strokeState == 1) {
    label.innerText = "Drawing";    
  } else {
    label.innerText = "Done";    
  }
  
  var canvas = document.getElementById('stroke');
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);  

  if (strokeState === 1) {
    drawStrokeGraph(canvas, strokePoints, strokeDataLength);
  }
}

//-----------------------------------------------------------------------------------//
// FUNCTION FOR OUTPUTING CLASS INDEX ON WEBPAGE AND MAKING API CALL
function updateIndex() {
  console.log('Calling updateIndex.....');
  // Get the received message from BLEsense.stroke.data.message
  var indexDisplayDiv = document.getElementById("index_display");
  var indexClassDiv = document.getElementById("index_class");
  var prevIndex = Number(indexDisplayDiv.innerHTML); // Grab value that is stored in Div -> change to number type
  var index = Number(BLEsense['prediction'].data.index.latest()); // Grab latest index value -> change to number type
  console.log('prevIndex: ' + prevIndex);
  console.log('index: ' + index);
  // If Div value of previous stored index did not change, don't do anything
  // Otherwise, update previous stored index at div with new index value
  if (index !== prevIndex) { 
    //Update the HTML element to display the message (replace with your element ID)
    var message = 'none'
    if (index == 0) {
      message = 'Swipe Up';
      switchLightOn();
    } else if (index == 1) {
      message = 'Swipe Down';
      switchLightOff();
    } else if (index == 2) {
      message = 'Hand Wave';
      //PLACEHODLER FOR API CALL -> TBD
    } else if (index == 3) {
      message = 'Clockwise';
      switchLightOnAndBrighten();
    } else if (index == 4) {
      message = 'Counter-Clockwise';
      switchLightOnAndDim();
    }
    console.log('message: ' + message);
    indexDisplayDiv.innerHTML = index;
    indexClassDiv.innerHTML = message;
    console.log('New Index from Prediction: ' + index);
    // var strokeLabel = document.querySelector('#store_0 > .label');
    // strokeLabel.innerText = index;
  }

}

//-----------------------------------------------------------------------------------//
// Struct for BLE sensors 
var BLEsense =
{
  stroke:
  {
    uuid: '4798e0f2-300a-4d68-af64-8a8f5258404e',
    properties: ['BLERead'], // BLENotify only gives use the first 20 bytes.
    structure: [
      'Int32', 'Int32',
      'StrokePoints',
    ],
    data: {
      'state': [], 'length': [],
      'strokePoints': [],
    },
    onUpdate: updateStrokeGraph,
  },
  prediction:
  {
    uuid: '4798e0f2-300b-4d68-af64-8a8f5258404e',
    properties: ['BLERead'], // BLENotify only gives use the first 20 bytes.
    structure: [
      'Uint8',
    ],
    data: {
      'index': [],
    },
    onUpdate: updateIndex,
  }
};
const sensors = Object.keys(BLEsense);
const SERVICE_UUID = '4798e0f2-0000-4d68-af64-8a8f5258404e'; // This should match the .ino file
var bytesReceived = 0;
var bytesPrevious = 0;
    
// return last item of array
Array.prototype.latest = function(){return this[this.length - 1];};

  function bytes(){
    if (bytesReceived > bytesPrevious){
      bytesPrevious= bytesReceived;
      msg(bytesReceived+" bytes received");
    }
  }

  var skip_frame = false;
  function draw(){
    function updateViz(sensor,fns){
      if (BLEsense[sensor].rendered == false) { // only render if new values are received
        fns.forEach(function(fn){
          fn(sensor);
        });
        BLEsense[sensor].rendered = true;
      }
    }
    if (skip_frame == false){ // TODO update with fuction to iterate object with viz function as a property      
      skip_frame = true; // render alternate frames = 30fps
    } else {skip_frame=false;}
    //requestAnimationFrame(draw);
  }
  
  initStrokeGraph();
    
  //requestAnimationFrame(draw);
