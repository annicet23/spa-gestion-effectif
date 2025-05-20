// src/utils/date.js
const moment = require('moment-timezone');

const APP_TIMEZONE = 'Indian/Antananarivo';

module.exports = {
    getHistoricalDate,
    getHistoricalDayStartTime,
    getHistoricalDayEndTime,
    getCurrentPeriodDates
};

function getHistoricalDate(realTime) {
    const m = moment.tz(realTime, APP_TIMEZONE);
    return m.hour() >= 16 ? m.add(1, 'day').format('YYYY-MM-DD') : m.format('YYYY-MM-DD');
}

function getHistoricalDayStartTime(historicalDateLabel) {
    return moment.tz(historicalDateLabel, APP_TIMEZONE)
        .subtract(1, 'day')
        .hour(16).minute(0).second(0).millisecond(0)
        .toDate();
}

function getHistoricalDayEndTime(historicalDateLabel) {
    return moment.tz(historicalDateLabel, APP_TIMEZONE)
        .hour(15).minute(59).second(59).millisecond(999)
        .toDate();
}

function getCurrentPeriodDates() {
    const now = new Date();
    const historicalDate = getHistoricalDate(now);
    return {
        start: getHistoricalDayStartTime(historicalDate),
        end: getHistoricalDayEndTime(historicalDate)
    };
}