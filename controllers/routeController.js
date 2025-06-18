const orsService = require('../services/orsService');

exports.getRoute = async (req, res) => {
  try {
    const { start, end, blockedRoads } = req.body;
    const routeGeoJSON = await orsService.getShortestRoute(start, end, blockedRoads);
    res.json(routeGeoJSON);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Failed to calculate route' });
  }
};
