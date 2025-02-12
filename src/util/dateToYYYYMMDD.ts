/**
 * Convert a date to a string in YYYY-MM-DD format
 * @param date Date to convert
 * @returns Date in the format YYYY-MM-DD
 */
 export default function dateToYYYYMMDD(date:Date) {
    return date.toISOString().substring(0, 10);
}