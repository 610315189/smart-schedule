/**
 * 全校教室占用表（可选，但强烈建议导入真实数据）
 * ---------------------------------------------------------------
 * 只用"我的课表"反推空教室是不准的：你只能看到自己班的课，
 * 别的班级占用同一间教室你并不知道。
 *
 * 因此提供一个独立的全校占用数据源。获取方式（任选）：
 *  1) 教务系统导出的全校课表（含教室、周次、节次），提取这四个字段即可；
 *  2) 学校公开的教室借用 / 排课公示；
 *  3) 手动录入已知的长期占用（如"每周三 5-6 节 B401 有实验课"）。
 *
 * 字段与课程一致（不需要 teacher / color / note）：
 *  { id, name, roomId, day, start, end, weeks }
 *
 * 下方为演示用示例数据，请替换成本校真实数据。
 */
const OCCUPANCY = [
  // ---------- 周一 ----------
  { id: 'o101', name: '大学语文', roomId: 'A101', day: 1, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o102', name: '中国近现代史纲要', roomId: 'A102', day: 1, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o103', name: '离散数学', roomId: 'A201', day: 1, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o104', name: '英语听说', roomId: 'B301', day: 1, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o105', name: '工程制图', roomId: 'A301', day: 1, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o106', name: '管理学原理', roomId: 'B201', day: 1, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o107', name: '形势与政策', roomId: 'A302', day: 1, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o108', name: '数据库原理', roomId: 'B302', day: 1, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },

  // ---------- 周二 ----------
  { id: 'o201', name: '计算机导论', roomId: 'A101', day: 2, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o202', name: '大学物理实验', roomId: 'A201', day: 2, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o203', name: '操作系统', roomId: 'A202', day: 2, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o204', name: '数学分析', roomId: 'A301', day: 2, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o205', name: '大学英语(II)', roomId: 'B201', day: 2, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o206', name: '算法设计与分析', roomId: 'B301', day: 2, start: 9, end: 10, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o207', name: '羽毛球', roomId: 'C105', day: 2, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },

  // ---------- 周三 ----------
  { id: 'o301', name: '思想道德与法治', roomId: 'A101', day: 3, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o302', name: '高等数学(下)', roomId: 'A102', day: 3, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o303', name: '线性代数', roomId: 'A202', day: 3, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o304', name: '大学英语(I)', roomId: 'B201', day: 3, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o305', name: '数据结构', roomId: 'B301', day: 3, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o306', name: '软件工程', roomId: 'B401', day: 3, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o307', name: '概率论', roomId: 'A201', day: 3, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o308', name: '工程训练', roomId: 'C105', day: 3, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o309', name: '编译原理实验', roomId: 'C201', day: 3, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o310', name: '大学生心理健康', roomId: 'A302', day: 3, start: 9, end: 10, weeks: { start: 1, end: 16, parity: 'all' } },

  // ---------- 周四 ----------
  { id: 'o401', name: '高等数学(上)', roomId: 'A201', day: 4, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o402', name: '体育(篮球)', roomId: 'C202', day: 4, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o403', name: '大学物理实验', roomId: 'C201', day: 4, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o404', name: '财务管理', roomId: 'A102', day: 4, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o405', name: '计算机网络', roomId: 'B201', day: 4, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o406', name: '市场营销', roomId: 'A202', day: 4, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o407', name: '经济法', roomId: 'A101', day: 4, start: 9, end: 10, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o408', name: '移动应用开发', roomId: 'A301', day: 4, start: 9, end: 10, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o409', name: '大学英语(III)', roomId: 'B302', day: 4, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },

  // ---------- 周五 ----------
  { id: 'o501', name: '形势与政策', roomId: 'A101', day: 5, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o502', name: '概率论与数理统计', roomId: 'A202', day: 5, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o503', name: '高等数学(上)', roomId: 'A301', day: 5, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o504', name: '数据结构', roomId: 'B201', day: 5, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o505', name: '操作系统', roomId: 'A302', day: 5, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o506', name: '大学物理', roomId: 'A201', day: 5, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o507', name: '机器学习', roomId: 'B301', day: 5, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o508', name: '英语听说', roomId: 'A102', day: 5, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o509', name: '羽毛球', roomId: 'B302', day: 5, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o510', name: '工程训练', roomId: 'C105', day: 5, start: 9, end: 10, weeks: { start: 1, end: 16, parity: 'all' } },
];

module.exports = { OCCUPANCY };
