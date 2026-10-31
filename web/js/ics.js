/**
 * .ics 日历导出
 * ---------------------------------------------------------------
 * 网页版没法像小程序那样直接调 wx.addPhoneCalendar，
 * 所以改成导出一个标准 iCalendar 文件：手机点开就能把整学期课程
 * 导入系统日历，由操作系统负责在课前响铃——防误课最可靠的一环。
 */
(function (global) {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /** 秒级时间戳 -> iCalendar UTC 时间 */
  function toICSDate(ts) {
    var d = new Date(ts * 1000);
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
      pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  }

  /** 文本转义：反斜杠、分号、逗号、换行 */
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  /** 折叠超长行（iCalendar 规定每行不超过 75 字节） */
  function fold(line) {
    if (line.length <= 73) return line;
    var out = [];
    var rest = line;
    out.push(rest.slice(0, 73));
    rest = rest.slice(73);
    while (rest.length) {
      out.push(' ' + rest.slice(0, 72));
      rest = rest.slice(72);
    }
    return out.join('\r\n');
  }

  function uid(event, idx) {
    var seed = String(event.title) + '|' + event.startTime + '|' + idx;
    var h = 0;
    for (var i = 0; i < seed.length; i++) {
      h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36) + '-' + idx + '@smart-schedule';
  }

  /**
   * 生成 iCalendar 文本
   * @param {Array} events [{ title, startTime(秒), endTime(秒), description, location, alarmOffset(秒) }]
   */
  function build(events) {
    var now = toICSDate(Math.floor(Date.now() / 1000));
    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SmartSchedule//Course Table//CN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:我的课表',
      'X-WR-TIMEZONE:Asia/Shanghai',
    ];

    (events || []).forEach(function (e, idx) {
      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + uid(e, idx));
      lines.push('DTSTAMP:' + now);
      lines.push('DTSTART:' + toICSDate(e.startTime));
      lines.push('DTEND:' + toICSDate(e.endTime));
      lines.push('SUMMARY:' + esc(e.title));
      if (e.description) lines.push('DESCRIPTION:' + esc(e.description));
      if (e.location) lines.push('LOCATION:' + esc(e.location));
      lines.push('STATUS:CONFIRMED');
      lines.push('TRANSP:OPAQUE');

      if (e.alarmOffset && e.alarmOffset > 0) {
        lines.push('BEGIN:VALARM');
        lines.push('TRIGGER:-PT' + Math.max(1, Math.round(e.alarmOffset / 60)) + 'M');
        lines.push('ACTION:DISPLAY');
        lines.push('DESCRIPTION:' + esc(e.title + ' 即将开始'));
        lines.push('END:VALARM');
      }

      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  /** 触发浏览器下载 */
  function download(events, filename) {
    var text = build(events);
    var blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || '我的课表.ics';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    return text;
  }

  global.SS = global.SS || {};
  global.SS.ics = {
    build: build,
    download: download,
    toICSDate: toICSDate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
