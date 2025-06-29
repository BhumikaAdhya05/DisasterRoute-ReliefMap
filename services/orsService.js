// const axios = require('axios');

// exports.getShortestRoute = async (start, end, blockedRoads) => {
//   const apiKey = process.env.ORS_API_KEY;
//   const coordinates = [start, end]; // [lng, lat]

//   const body = {
//     coordinates,
//     instructions: false,
//     format: "geojson",
//   };

//   // 🔁 Fix: Validate and wrap blockedRoads correctly
//   if (blockedRoads && blockedRoads.length > 0) {
//     body.options = {
//       avoid_polygons: {
//         type: "MultiPolygon",
//         coordinates: blockedRoads.map(poly => [poly]) // Wrap each polygon in a single array
//       }
//     };
//   }

//   const response = await axios.post(
//     'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
//     body,
//     {
//       headers: {
//         Authorization: apiKey,
//         'Content-Type': 'application/json'
//       }
//     }
//   );

//   return response.data;
// };


const axios = require('axios');

exports.getShortestRoute = async (start, end, blockedRoads) => {
  const apiKey = process.env.ORS_API_KEY;
  const coordinates = [start, end];

  const body = {
    coordinates,
    instructions: false,
    format: "geojson"
  };

  if (blockedRoads && blockedRoads.length > 0) {
    const validPolygons = blockedRoads.map(poly => {
      if (poly.length >= 4 && poly[0][0] !== poly[poly.length - 1][0]) poly.push(poly[0]);
      return [poly];
    });

    body.options = {
      avoid_polygons: {
        type: "MultiPolygon",
        coordinates: validPolygons
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
