/**
 * 节次时间表
 * ---------------------------------------------------------------
 * 直接按本校作息修改 start / end 即可，节次数量可增可减。
 * section 只用于界面分组显示：morning / afternoon / evening
 */
const DEFAULT_PERIODS = [
  { period: 1, start: '08:00', end: '08:45', section: 'morning' },
  { period: 2, start: '08:55', end: '09:40', section: 'morning' },
  { period: 3, start: '10:00', end: '10:45', section: 'morning' },
  { period: 4, start: '10:55', end: '11:40', section: 'morning' },
  { period: 5, start: '14:00', end: '14:45', section: 'afternoon' },
  { period: 6, start: '14:55', end: '15:40', section: 'afternoon' },
  { period: 7, start: '16:00', end: '16:45', section: 'afternoon' },
  { period: 8, start: '16:55', end: '17:40', section: 'afternoon' },
  { period: 9, start: '19:00', end: '19:45', section: 'evening' },
  { period: 10, start: '19:55', end: '20:40', section: 'evening' },
];

const SECTION_LABEL = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

module.exports = { DEFAULT_PERIODS, SECTION_LABEL };
