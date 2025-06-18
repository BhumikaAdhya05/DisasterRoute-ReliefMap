const map = L.map('map').setView([22.7, 88.4], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

let routeLayer, blockedLayer, originalRouteLayer;

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

  // Step 1: Get original route (no blockage)
  const originalRes = await fetch('/api/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start, end })
  });

  const originalRoute = await originalRes.json();

  // Step 2: Get rerouted route (with block)
  const reroutedRes = await fetch('/api/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start, end, blockedRoads: blocked })
  });

  const reroutedRoute = await reroutedRes.json();

  // Clear existing layers
  if (routeLayer) map.removeLayer(routeLayer);
  if (blockedLayer) map.removeLayer(blockedLayer);
  if (originalRouteLayer) map.removeLayer(originalRouteLayer);

  // Original route (gray)
  originalRouteLayer = L.geoJSON(originalRoute, {
    style: { color: 'red', dashArray: '5,5', weight: 4 }
  }).addTo(map);

  // Rerouted route (blue)
  routeLayer = L.geoJSON(reroutedRoute, {
    style: { color: 'blue', weight: 4 }
  }).addTo(map);

  // Blocked area (red)
  if (blocked.length) {
    blockedLayer = L.geoJSON({
      type: "MultiPolygon",
      coordinates: blocked
    }, {
      style: { color: 'red', fillOpacity: 0.4 }
    }).addTo(map);
  }

  map.fitBounds(routeLayer.getBounds());
}
