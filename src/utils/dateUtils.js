/**
 * Utility for handling dates in a consistent timezone (Asia/Kuching, UTC+8)
 */

const TIMEZONE_OFFSET_HOURS = 8;
const MS_PER_HOUR = 3600000;

/**
 * Gets the current date in the target timezone as a Date object.
 * Note: The local time of this object corresponds to the target timezone's time.
 */
export const getNowInTargetTimezone = () => {
  const now = new Date();
  // We want to return a date object that represents the current time in +08
  // regardless of the local device timezone.
  // A simple way is to use the UTC time and manually add the offset.
  return new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (TIMEZONE_OFFSET_HOURS * MS_PER_HOUR));
};

/**
 * Returns true if the given timestamp (in seconds) falls on the same day as "now" 
 * in the target timezone (Asia/Kuching, UTC+8).
 */
export const isTimestampToday = (timestamp) => {
  if (!timestamp) return false;
  
  const options = { timeZone: 'Asia/Kuching', year: 'numeric', month: 'numeric', day: 'numeric' };
  const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD
  
  try {
    const s1 = formatter.format(new Date(timestamp * 1000));
    const s2 = formatter.format(new Date());
    return s1 === s2;
  } catch (e) {
    return false;
  }
};


/**
 * Formats a timestamp (in seconds) to a string in the target timezone.
 * Uses Intl.DateTimeFormat for robust timezone handling.
 */
export const formatInTargetTimezone = (timestamp, options = {}) => {
  if (!timestamp) return '--';
  const d = new Date(timestamp * 1000);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuching',
    ...options
  }).format(d);
};

/**
 * Formats time (hh:mm a) specifically for attendance records.
 */
export const formatTimeInTargetTimezone = (timestamp) => {
  if (!timestamp) return '--';
  return formatInTargetTimezone(timestamp, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Formats date (MMM dd, yyyy) specifically for attendance records.
 */
export const formatDateInTargetTimezone = (timestamp) => {
  if (!timestamp) return '--';
  return formatInTargetTimezone(timestamp, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Checks if a timestamp is before a certain time (e.g., 08:00 AM) in the target timezone.
 */
export const isPunctual = (timestamp, limitHour = 8, limitMinute = 0) => {
  if (!timestamp) return false;
  
  const d = new Date(timestamp * 1000);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuching',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(d);
  const hourPart = parts.find(p => p.type === 'hour');
  const minutePart = parts.find(p => p.type === 'minute');
  
  if (!hourPart || !minutePart) return false;
  
  const hours = parseInt(hourPart.value, 10);
  const minutes = parseInt(minutePart.value, 10);
  
  return hours < limitHour || (hours === limitHour && minutes <= limitMinute);
};

