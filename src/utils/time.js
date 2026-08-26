/**
 * Parse time string "HH:MM" to minutes since midnight for comparison.
 */
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Check if two time ranges overlap.
 * Both ranges are [start, end) — end is exclusive.
 */
const doTimesOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && start2 < end1;
};

module.exports = { timeToMinutes, doTimesOverlap };
