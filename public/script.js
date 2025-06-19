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
let reroutedRouteCoords = []; // add globally

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

    reroutedRouteCoords = reroutedRoute.features[0].geometry.coordinates.map(c => [c[1], c[0]]);

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

    const originalCoords = (originalRoute.features && originalRoute.features[0])
  ? originalRoute.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]])
  : [];

  if (!originalCoords.length) {
    alert("Original route could not be generated. Check coordinates or blocked region.");
    return;
  }
    simulateMovement(originalCoords, blocked, end);

    console.log("Original route API response:", originalRoute);

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

    // ✅ Fallback: If reroute fails or is empty, retrace the original blue line
    if (!data.features || !data.features[0]) {
      alert("Reroute failed. Retracing original path from blocked point.");

      // Get remaining path from currentCoord onward on original route
      const originalCoords = routeLayer.toGeoJSON().features?.[0]?.geometry?.coordinates;
      if (!originalCoords) {
        console.error("No original route to fall back on.");
        return;
      }

      // Transform to [lat, lng]
      const allLatLng = originalCoords.map(coord => [coord[1], coord[0]]);

      // Find index of currentCoord in the route (or closest)
      // Find nearest point index in original route
      let minDist = Infinity;
      let startIdx = 0;
      for (let i = 0; i < allLatLng.length; i++) {
         const dLat = allLatLng[i][0] - currentCoord[0];
         const dLng = allLatLng[i][1] - currentCoord[1];
         const dist = dLat * dLat + dLng * dLng;
         if (dist < minDist) {
           minDist = dist;
           startIdx = i;
          }
      }

      const fallbackCoords = startIdx >= 0 ? allLatLng.slice(startIdx) : [];

      if (fallbackCoords.length > 1) {
        L.polyline(fallbackCoords, { color: 'green', weight: 4 }).addTo(map);
        simulationIndex = 0;
        simulateMovement(fallbackCoords, blockedPolygons, endCoord);
      } else {
        alert("No fallback path available.");
      }

      return;
    }

    // ✅ Successful reroute case
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
