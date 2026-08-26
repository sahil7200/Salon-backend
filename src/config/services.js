const Service = require('../models/Appointment').SERVICE_DURATIONS;

// Hardcoded salon services with fixed durations
const SALON_SERVICES = [
  { name: 'Haircut', durationMinutes: Service['Haircut'] },
  { name: 'Facial', durationMinutes: Service['Facial'] },
  { name: 'Hair Color', durationMinutes: Service['Hair Color'] },
];

module.exports = { SALON_SERVICES };
