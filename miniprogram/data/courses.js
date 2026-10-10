/**
 * 我的课表（示例数据，首次启动会写入本地存储，之后可在"课表-编辑"里改）
 * ---------------------------------------------------------------
 * 字段说明：
 *  id        唯一 id，导入时若重复会被覆盖
 *  name      课程名
 *  teacher   任课教师（可空）
 *  roomId    教室编号，必须与 data/classrooms.js 里的 id 对应
 *  day       星期几，1=周一 … 7=周日
 *  start     起始节次（含）
 *  end       结束节次（含）；单节课时 start === end
 *  weeks     周次规则 { start, end, parity }，parity: all | odd | even
 *  color     课程块颜色（可空，会自动分配）
 *  note      备注，如 "带实验报告"
 */
const COURSES = [
  {
    id: 'c01', name: '高等数学(上)', teacher: '张建国', roomId: 'A301',
    day: 1, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#2b5cff', note: '带教材与习题册',
  },
  {
    id: 'c02', name: '大学英语(II)', teacher: '李雯', roomId: 'A401',
    day: 1, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#12b886', note: '',
  },
  {
    id: 'c03', name: '机器学习导论', teacher: '王海涛', roomId: 'B401',
    day: 1, start: 9, end: 10, weeks: { start: 1, end: 8, parity: 'all' },
    color: '#7048e8', note: '机房上机，需带校园卡',
  },
  {
    id: 'c04', name: '概率论与数理统计', teacher: '陈默', roomId: 'A202',
    day: 2, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#f76707', note: '',
  },
  {
    id: 'c05', name: '线性代数', teacher: '赵敏', roomId: 'B201',
    day: 2, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#1098ad', note: '',
  },
  {
    id: 'c06', name: '程序设计基础', teacher: '刘伟', roomId: 'A301',
    day: 3, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#2b5cff', note: '记得交第 3 次作业',
  },
  {
    id: 'c07', name: '数据结构与算法', teacher: '刘伟', roomId: 'B301',
    day: 3, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#e64980', note: '',
  },
  {
    id: 'c08', name: 'Python 数据分析(选修)', teacher: '孙倩', roomId: 'B401',
    day: 3, start: 9, end: 10, weeks: { start: 3, end: 12, parity: 'all' },
    color: '#0ca678', note: '实验课，需自带电脑',
  },
  {
    id: 'c09', name: '大学物理', teacher: '周立', roomId: 'A201',
    day: 4, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#f59f00', note: '',
  },
  {
    id: 'c10', name: '体育(羽毛球)', teacher: '吴强', roomId: 'C105',
    day: 4, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#12b886', note: '穿运动鞋',
  },
  {
    id: 'c11', name: '计算机网络', teacher: '郑楠', roomId: 'B201',
    day: 5, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#7048e8', note: '',
  },
  {
    id: 'c12', name: '思想道德与法治', teacher: '何静', roomId: 'A101',
    day: 5, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#1098ad', note: '',
  },
];

module.exports = { COURSES };
