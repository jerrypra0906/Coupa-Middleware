import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

// Set default timezone to Jakarta, Indonesia (Asia/Jakarta - UTC+7)
dayjs.tz.setDefault('Asia/Jakarta');

// Helper function to format dates in Jakarta timezone
export const formatJakartaTime = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return '-';
  return dayjs(date).tz('Asia/Jakarta').format(format);
};

// Helper function to get current Jakarta time
export const getJakartaTime = () => {
  return dayjs().tz('Asia/Jakarta');
};

export default dayjs;

