/**
 * Test cases for date helper utility functions.
 * Tests edge cases and boundary conditions for date calculations.
 */
import {
  getDefaultDay,
  getUpcomingDates,
  getDayName,
  getAlsoTonightLabel,
  getPartyDateLabel,
  pickSmartDefaultDay,
  displayDoorTime,
  parseDoorTimeParts,
  formatDoorTimeParts,
  isSaturdayPartyWindow,
  getSaturdayWindowISO,
  getPromptCadenceDay,
  getRolledDateISO,
} from '../utils/dateHelpers';

describe('dateHelpers', () => {
  describe('getDefaultDay', () => {
    const originalDate = global.Date;

    afterEach(() => {
      global.Date = originalDate;
    });

    // Use noon so the 6 AM "previous day" rule does not shift the weekday.
    const mockDate = (dayOfWeek: number, hour = 12) => {
      const date = new Date(2024, 0, 7 + dayOfWeek, hour, 0, 0); // Jan 2024, Sunday is 7th
      jest.spyOn(global, 'Date').mockImplementation(() => date as unknown as Date);
    };

    it('should return thursday on Monday', () => {
      mockDate(1);
      expect(getDefaultDay()).toBe('thursday');
    });

    it('should return thursday on Tuesday', () => {
      mockDate(2);
      expect(getDefaultDay()).toBe('thursday');
    });

    it('should return thursday on Wednesday', () => {
      mockDate(3);
      expect(getDefaultDay()).toBe('thursday');
    });

    it('should return thursday on Thursday', () => {
      mockDate(4);
      expect(getDefaultDay()).toBe('thursday');
    });

    it('should return friday on Friday', () => {
      mockDate(5);
      expect(getDefaultDay()).toBe('friday');
    });

    it('should return saturday on Saturday', () => {
      mockDate(6);
      expect(getDefaultDay()).toBe('saturday');
    });

    it('should return thursday on Sunday', () => {
      mockDate(0);
      expect(getDefaultDay()).toBe('thursday');
    });

    it('should treat Friday before 6 AM as Thursday', () => {
      mockDate(5, 3);
      expect(getDefaultDay()).toBe('thursday');
    });

    it('should treat Saturday before 6 AM as Friday', () => {
      mockDate(6, 3);
      expect(getDefaultDay()).toBe('friday');
    });

    it('should treat Sunday before 6 AM as Saturday', () => {
      mockDate(0, 3);
      expect(getDefaultDay()).toBe('saturday');
    });
  });

  describe('getPromptCadenceDay / getRolledDateISO', () => {
    const wed = new Date(2026, 8, 9, 15, 0, 0);
    const thu = new Date(2026, 8, 10, 15, 0, 0);
    const fri = new Date(2026, 8, 11, 15, 0, 0);
    const sat = new Date(2026, 8, 12, 15, 0, 0);
    const sun = new Date(2026, 8, 13, 15, 0, 0);
    const mon = new Date(2026, 8, 14, 15, 0, 0);
    const tue = new Date(2026, 8, 15, 15, 0, 0);

    it('is Wed–Sat after 6 AM, and null Sun–Tue', () => {
      expect(getPromptCadenceDay(wed)).toBe('wednesday');
      expect(getPromptCadenceDay(thu)).toBe('thursday');
      expect(getPromptCadenceDay(fri)).toBe('friday');
      expect(getPromptCadenceDay(sat)).toBe('saturday');
      expect(getPromptCadenceDay(sun)).toBeNull();
      expect(getPromptCadenceDay(mon)).toBeNull();
      expect(getPromptCadenceDay(tue)).toBeNull();
    });

    it('rolls before 6 AM onto the previous cadence day', () => {
      expect(getPromptCadenceDay(new Date(2026, 8, 9, 3, 0, 0))).toBeNull();
      expect(getPromptCadenceDay(new Date(2026, 8, 10, 3, 0, 0))).toBe('wednesday');
      expect(getPromptCadenceDay(new Date(2026, 8, 12, 3, 0, 0))).toBe('friday');
      expect(getPromptCadenceDay(new Date(2026, 8, 13, 3, 0, 0))).toBe('saturday');
    });

    it('keys the rolled calendar date, including Sunday 3 AM as Saturday', () => {
      expect(getRolledDateISO(sat)).toBe('2026-09-12');
      expect(getRolledDateISO(new Date(2026, 8, 13, 3, 0, 0))).toBe('2026-09-12');
      expect(getRolledDateISO(new Date(2026, 8, 12, 3, 0, 0))).toBe('2026-09-11');
    });
  });

  describe('isSaturdayPartyWindow / getSaturdayWindowISO', () => {
    // Saturday 12 Sep 2026. Pass the Date in — don't mock the constructor.
    const satAfternoon = new Date(2026, 8, 12, 15, 0, 0);
    const satBefore6am = new Date(2026, 8, 12, 3, 0, 0);
    const sunBefore6am = new Date(2026, 8, 13, 3, 0, 0);
    const sunAfternoon = new Date(2026, 8, 13, 15, 0, 0);
    const friday = new Date(2026, 8, 11, 21, 0, 0);

    it('is true Saturday afternoon through Sunday before 6 AM', () => {
      expect(isSaturdayPartyWindow(satAfternoon)).toBe(true);
      expect(isSaturdayPartyWindow(sunBefore6am)).toBe(true);
    });

    it('is false Friday night, Saturday before 6 AM, and Sunday afternoon', () => {
      expect(isSaturdayPartyWindow(friday)).toBe(false);
      expect(isSaturdayPartyWindow(satBefore6am)).toBe(false);
      expect(isSaturdayPartyWindow(sunAfternoon)).toBe(false);
    });

    it('keys dismissals to that Saturday, including Sunday 3 AM', () => {
      expect(getSaturdayWindowISO(satAfternoon)).toBe('2026-09-12');
      expect(getSaturdayWindowISO(sunBefore6am)).toBe('2026-09-12');
      expect(getSaturdayWindowISO(friday)).toBeNull();
    });
  });

  describe('getAlsoTonightLabel', () => {
    const originalDate = global.Date;

    afterEach(() => {
      global.Date = originalDate;
    });

    const mockDate = (dayOfWeek: number, hour = 12) => {
      const date = new Date(2024, 0, 7 + dayOfWeek, hour, 0, 0);
      jest.spyOn(global, 'Date').mockImplementation(() => date as unknown as Date);
    };

    it('says TONIGHT when the selected day is today', () => {
      mockDate(5);
      expect(getAlsoTonightLabel('friday', 5)).toBe('ALSO TONIGHT · 5');
    });

    it('says THURSDAY when browsing Thursday on a weekday', () => {
      mockDate(3);
      expect(getAlsoTonightLabel('thursday', 3)).toBe('ALSO THURSDAY · 3');
    });

    it('says TONIGHT for Thursday on Thursday', () => {
      mockDate(4);
      expect(getAlsoTonightLabel('thursday', 2)).toBe('ALSO TONIGHT · 2');
    });

    it('says FRIDAY when browsing Friday on a weekday', () => {
      mockDate(3);
      expect(getAlsoTonightLabel('friday', 3)).toBe('ALSO FRIDAY · 3');
    });

    it('says SATURDAY when browsing Saturday before the weekend', () => {
      mockDate(4);
      expect(getAlsoTonightLabel('saturday', 2)).toBe('ALSO SATURDAY · 2');
    });

    it('treats Saturday before 6 AM as Friday night', () => {
      mockDate(6, 3);
      expect(getAlsoTonightLabel('friday', 4)).toBe('ALSO TONIGHT · 4');
    });
  });

  describe('pickSmartDefaultDay', () => {
    it('keeps the default night when it has parties', () => {
      expect(pickSmartDefaultDay('thursday', { thursday: 2, friday: 1, saturday: 0 })).toBe('thursday');
    });

    it('falls forward to the first night that has parties', () => {
      expect(pickSmartDefaultDay('thursday', { thursday: 0, friday: 3, saturday: 1 })).toBe('friday');
      expect(pickSmartDefaultDay('friday', { thursday: 2, friday: 0, saturday: 1 })).toBe('thursday');
    });

    it('stays on the default when every night is empty', () => {
      expect(pickSmartDefaultDay('saturday', { thursday: 0, friday: 0, saturday: 0 })).toBe('saturday');
    });
  });

  describe('getPartyDateLabel', () => {
    it('formats an ISO date as the party-page date line', () => {
      expect(getPartyDateLabel('2026-10-15')).toBe('THU OCT 15');
      expect(getPartyDateLabel('2026-10-16')).toBe('FRI OCT 16');
      expect(getPartyDateLabel('2026-10-17')).toBe('SAT OCT 17');
    });

    it('parses as a local date (no UTC off-by-one)', () => {
      // new Date('2026-01-02') would be UTC midnight → Jan 1 in US timezones.
      expect(getPartyDateLabel('2026-01-02')).toBe('FRI JAN 2');
    });
  });

  describe('getUpcomingDates', () => {
    const originalDate = global.Date;

    afterEach(() => {
      global.Date = originalDate;
    });

    it('should return valid date strings', () => {
      const result = getUpcomingDates();
      expect(result.thursday).toBeDefined();
      expect(result.friday).toBeDefined();
      expect(result.saturday).toBeDefined();
      expect(typeof result.friday).toBe('string');
      expect(typeof result.saturday).toBe('string');
    });

    it('should return consecutive days', () => {
      const result = getUpcomingDates();
      const thursdayNum = parseInt(result.thursday);
      const fridayNum = parseInt(result.friday);
      const saturdayNum = parseInt(result.saturday);
      const friDiff = fridayNum - thursdayNum;
      const satDiff = saturdayNum - fridayNum;
      expect(friDiff === 1 || friDiff < -20).toBe(true);
      expect(satDiff === 1 || satDiff < -20).toBe(true);
    });

    it('should handle month boundaries', () => {
      const result = getUpcomingDates();
      expect(parseInt(result.friday)).toBeGreaterThan(0);
      expect(parseInt(result.friday)).toBeLessThanOrEqual(31);
    });

    it('should handle year boundaries', () => {
      const date = new Date(2024, 11, 31);
      jest.spyOn(global, 'Date').mockImplementation(() => date as unknown as Date);

      expect(() => getUpcomingDates()).not.toThrow();
    });
  });

  describe('getDayName', () => {
    it('should return Thursday for thursday', () => {
      expect(getDayName('thursday')).toBe('Thursday');
    });

    it('should return Friday for friday', () => {
      expect(getDayName('friday')).toBe('Friday');
    });

    it('should return Saturday for saturday', () => {
      expect(getDayName('saturday')).toBe('Saturday');
    });
  });

  describe('displayDoorTime', () => {
    it('drops :00 and keeps AM/PM', () => {
      expect(displayDoorTime('10:00 PM')).toBe('10 PM');
      expect(displayDoorTime('11:00 PM')).toBe('11 PM');
      expect(displayDoorTime('2:00 AM')).toBe('2 AM');
      expect(displayDoorTime('12:00 AM')).toBe('12 AM');
    });

    it('keeps minutes when they are not :00', () => {
      expect(displayDoorTime('10:30 PM')).toBe('10:30 PM');
      expect(displayDoorTime('9:15 PM')).toBe('9:15 PM');
    });

    it('leaves already-canonical times alone', () => {
      expect(displayDoorTime('10 PM')).toBe('10 PM');
      expect(displayDoorTime('11 PM')).toBe('11 PM');
    });
  });

  describe('parseDoorTimeParts / formatDoorTimeParts', () => {
    it('parses hour-only and with minutes', () => {
      expect(parseDoorTimeParts('10 PM')).toEqual({ hour: 10, minute: 0, period: 'PM' });
      expect(parseDoorTimeParts('9:30 AM')).toEqual({ hour: 9, minute: 30, period: 'AM' });
      expect(parseDoorTimeParts('12:05 AM')).toEqual({ hour: 12, minute: 5, period: 'AM' });
    });

    it('returns null for garbage', () => {
      expect(parseDoorTimeParts('')).toBeNull();
      expect(parseDoorTimeParts('whenever')).toBeNull();
      expect(parseDoorTimeParts('25 PM')).toBeNull();
    });

    it('round-trips through the canonical display format', () => {
      expect(formatDoorTimeParts({ hour: 10, minute: 0, period: 'PM' })).toBe('10 PM');
      expect(formatDoorTimeParts({ hour: 8, minute: 15, period: 'PM' })).toBe('8:15 PM');
      expect(formatDoorTimeParts({ hour: 12, minute: 0, period: 'AM' })).toBe('12 AM');
    });
  });
});
