const axios = require('axios');

exports.getShortestRoute = async (start, end, blockedRoads) => {
  const apiKey = process.env.ORS_API_KEY;

  const coordinates = [start, end];  // [lng, lat]

  const body = {
    coordinates,
    instructions: false,
    format: "geojson"
  };

  if (blockedRoads && blockedRoads.length > 0) {
    body.options = {
      avoid_polygons: {
        type: "MultiPolygon",
        coordinates: blockedRoads
      }
    };
  }

  const response = await axios.post(
    'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
    body,
    {
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
};
