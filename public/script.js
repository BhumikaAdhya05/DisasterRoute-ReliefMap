const map = L.map('map').setView([22.7, 88.4], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

let routeLayer, blockedLayer, originalRouteLayer;

// ✅ Simulation state variables
let simulationInterval;
let simulationIndex = 0;
let isRerouted = false;
let reroutePath = [];
let movingMarker;
let blockedPolygons = [];

async function getRoute() {
  const start = document.getElementById("start").value.split(',').map(Number);
  const end = document.getElementById("end").value.split(',').map(Number);
  const blockedRaw = document.getElementById("blocked").value;

  let blocked = [];
  try {
    if (blockedRaw.trim()) {
      blocked = JSON.parse(blockedRaw);
    }
  } catch {
    alert("Invalid blocked roads JSON format.");
    return;
  }

  blockedPolygons = blocked;

  try {
    const originalRes = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end })
    });
    const originalRoute = await originalRes.json();

    const reroutedRes = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end, blockedRoads: blocked })
    });
    const reroutedRoute = await reroutedRes.json();

    if (!originalRoute.features || !reroutedRoute.features) {
      alert("Error: Invalid route response");
      return;
    }

    if (routeLayer) map.removeLayer(routeLayer);
    if (blockedLayer) map.removeLayer(blockedLayer);
    if (originalRouteLayer) map.removeLayer(originalRouteLayer);
    if (movingMarker) map.removeLayer(movingMarker);

    originalRouteLayer = L.geoJSON(originalRoute, {
      style: { color: 'red', dashArray: '5,5', weight: 4 }
    }).addTo(map);

    routeLayer = L.geoJSON(reroutedRoute, {
      style: { color: 'blue', weight: 4 }
    }).addTo(map);

    if (blocked.length) {
      blockedLayer = L.geoJSON({
        type: "MultiPolygon",
        coordinates: blocked.map(p => [p])
      }, {
        style: { color: 'red', fillOpacity: 0.4 }
      }).addTo(map);
    }

    map.fitBounds(routeLayer.getBounds());

    const originalCoords = originalRoute.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
    simulateMovement(originalCoords, blocked, end);

  } catch (err) {
    console.error("Route fetching failed:", err);
    alert("Route generation failed. Check console for details.");
  }
}

// ✅ Simulation: move marker, detect blockage, reroute if needed
function simulateMovement(routeCoords, blockedZones, finalDestination) {
  if (simulationInterval) clearInterval(simulationInterval);

  simulationIndex = 0;
  isRerouted = false;
  reroutePath = [];

  if (movingMarker) map.removeLayer(movingMarker);

  movingMarker = L.marker(routeCoords[0]).addTo(map);

  simulationInterval = setInterval(() => {
    if (simulationIndex >= routeCoords.length) {
      clearInterval(simulationInterval);
      return;
    }

    const currentCoord = routeCoords[simulationIndex];
    movingMarker.setLatLng(currentCoord);

    const point = turf.point([currentCoord[1], currentCoord[0]]);
    const isBlocked = blockedZones.some(poly => {
      try {
        if (poly.length >= 4) {
        return turf.booleanPointInPolygon(point, turf.polygon([poly]));
      }
    } catch (err) {
      console.error("Invalid polygon:", poly, err);
    }
    return false;
  });


    console.log("Checking blockage at:", currentCoord, "Blocked:", isBlocked);

    if (isBlocked && !isRerouted) {
      clearInterval(simulationInterval);
      isRerouted = true;
      fetchReroute(currentCoord, finalDestination);
      return;
    }

    simulationIndex++;
  }, 500);
}

// ✅ Reroute on block detection
async function fetchReroute(currentCoord, endCoord) {
  try {
    const res = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: [currentCoord[1], currentCoord[0]],
        end: [endCoord[1], endCoord[0]],
        blockedRoads: blockedPolygons,
      }),
    });

    const data = await res.json();

    if (!data.features) {
      alert("Reroute failed: No valid route returned");
      return;
    }

    const newCoords = data.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
    reroutePath = newCoords;

    L.geoJSON(data, { style: { color: 'green', weight: 4 } }).addTo(map);

    simulationIndex = 0;
    simulateMovement(newCoords, blockedPolygons, endCoord);

  } catch (err) {
    console.error("Rerouting error:", err);
    alert("Rerouting failed. See console for error.");
  }
}

