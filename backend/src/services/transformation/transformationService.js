const logger = require('../../config/logger');

class TransformationService {
  /**
   * Normalize SAP exchange rate payload into middleware format.
   * Applies "/" prefix conversion rule and basic validations.
   */
  transformExchangeRates(rawData = []) {
    const sourceRecords = this.extractRecords(rawData);
    const transformed = [];
    const errors = [];

    sourceRecords.forEach((record, idx) => {
      const lineNumber = idx + 1;
      const fromCurrency = record.FCURR || record.from_currency || record.fromCurrency;
      const toCurrency = record.TCURR || record.to_currency || record.toCurrency;
      const rateRaw = record.UKURS ?? record.rate_value ?? record.rateValue ?? record.rate;
      const rateDateRaw = record.GDATU || record.rate_date || record.rateDate;

      if (!fromCurrency || !toCurrency) {
        errors.push({
          line_number: lineNumber,
          field_name: 'CURRENCY',
          error_message: 'Missing from/to currency',
          raw_payload: record,
        });
        return;
      }

      if (rateRaw === undefined || rateRaw === null || rateRaw === '') {
        errors.push({
          line_number: lineNumber,
          field_name: 'RATE',
          error_message: 'Missing rate value',
          raw_payload: record,
        });
        return;
      }

      const parsedRate = this.parseRate(rateRaw);
      if (parsedRate === null) {
        errors.push({
          line_number: lineNumber,
          field_name: 'RATE',
          error_message: 'Invalid rate value',
          raw_payload: record,
        });
        return;
      }

      const rateDate = this.parseSapDate(rateDateRaw);
      if (!rateDate) {
        errors.push({
          line_number: lineNumber,
          field_name: 'RATE_DATE',
          error_message: 'Invalid rate date',
          raw_payload: record,
        });
        return;
      }

      transformed.push({
        from_currency: fromCurrency.trim(),
        to_currency: toCurrency.trim(),
        rate_value: parsedRate,
        rate_date: rateDate,
        status: 'NEW',
      });
    });

    return {
      records: transformed,
      errors,
      totalRecords: sourceRecords.length,
    };
  }

  /**
   * Build Coupa-compliant CSV for exchange rates.
   */
  buildExchangeRateCSV(records = []) {
    const header = ['From Currency', 'To Currency', 'Rate', 'Rate Date'];
    const rows = records.map(rec => {
      const rateDate = this.formatDateYYYYMMDD(rec.rate_date);
      const rate = Number(rec.rate_value).toFixed(8);
      return `"${rec.from_currency}","${rec.to_currency}","${rate}","${rateDate}"`;
    });
    return [header.join(','), ...rows].join('\n');
  }

  parseRate(rateRaw) {
    try {
      const normalized = typeof rateRaw === 'string' ? rateRaw.trim() : rateRaw;
      if (typeof normalized === 'string' && normalized.startsWith('/')) {
        const divisor = parseFloat(normalized.substring(1));
        if (!divisor || Number.isNaN(divisor) || divisor === 0) return null;
        return parseFloat((1 / divisor).toFixed(8));
      }

      const numeric = parseFloat(normalized);
      if (Number.isNaN(numeric) || numeric <= 0) return null;
      return parseFloat(numeric.toFixed(8));
    } catch (err) {
      logger.warn('Failed to parse rate', err);
      return null;
    }
  }

  parseSapDate(dateRaw) {
    if (!dateRaw) return null;
    const stringDate = String(dateRaw).trim();

    // SAP often sends YYYYMMDD; fallback to Date parsing
    if (/^\d{8}$/.test(stringDate)) {
      const year = Number(stringDate.slice(0, 4));
      const month = Number(stringDate.slice(4, 6)) - 1;
      const day = Number(stringDate.slice(6, 8));
      const date = new Date(Date.UTC(year, month, day));
      return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    }

    const date = new Date(stringDate);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  }

  extractRecords(rawData) {
    if (Array.isArray(rawData)) return rawData;
    if (rawData?.d?.results) return rawData.d.results;
    if (rawData?.results) return rawData.results;
    return [];
  }

  formatDateYYYYMMDD(dateInput) {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '';
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }
}

module.exports = new TransformationService();

