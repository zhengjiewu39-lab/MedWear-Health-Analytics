const { findNearbyFacilities, getDemoFacilities, FACILITY_DB } = require('../data/medicalFacilities');

function findNearbyHospitals(lat, lng, limit = 15, maxKm = 800) {
  return findNearbyFacilities(lat, lng, { limit, maxKm });
}

module.exports = { HOSPITAL_DB: FACILITY_DB, findNearbyHospitals, getDemoFacilities };
