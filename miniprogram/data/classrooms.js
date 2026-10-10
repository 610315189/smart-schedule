/**
 * 教室字典
 * ---------------------------------------------------------------
 * 空教室查询的"全集"。学校所有可用于上课/自习的教室都要登记在这里，
 * 课表里出现的教室若不在本表中，查询结果会漏（页面会给出提示）。
 *
 * 字段说明：
 *  id        唯一编号，必须与课表里的 roomId 完全一致
 *  name      显示名，如 "A301"
 *  building  楼栋名，用于分组筛选
 *  campus    校区（有多校区时使用）
 *  floor     楼层，用于就近推荐
 *  capacity  座位数
 *  type      教室类型：normal 普通 / multimedia 多媒体 / lab 机房 / language 语音室 / drawing 制图室
 *  openForStudy 是否允许学生自习（部分实验室、办公室不开放，设为 false）
 *  facilities 设施标签：projector 投影 / ac 空调 / socket 插座 / accessible 无障碍
 */
const CLASSROOMS = [
  // ---------- 综合楼 A 座 ----------
  { id: 'A101', name: 'A101', building: '综合楼A座', campus: '主校区', floor: 1, capacity: 120, type: 'multimedia', openForStudy: true, facilities: ['projector', 'ac'] },
  { id: 'A102', name: 'A102', building: '综合楼A座', campus: '主校区', floor: 1, capacity: 120, type: 'multimedia', openForStudy: true, facilities: ['projector', 'ac'] },
  { id: 'A201', name: 'A201', building: '综合楼A座', campus: '主校区', floor: 2, capacity: 90, type: 'normal', openForStudy: true, facilities: ['socket'] },
  { id: 'A202', name: 'A202', building: '综合楼A座', campus: '主校区', floor: 2, capacity: 90, type: 'normal', openForStudy: true, facilities: ['socket'] },
  { id: 'A301', name: 'A301', building: '综合楼A座', campus: '主校区', floor: 3, capacity: 180, type: 'multimedia', openForStudy: true, facilities: ['projector', 'ac', 'socket'] },
  { id: 'A302', name: 'A302', building: '综合楼A座', campus: '主校区', floor: 3, capacity: 60, type: 'normal', openForStudy: true, facilities: [] },
  { id: 'A401', name: 'A401', building: '综合楼A座', campus: '主校区', floor: 4, capacity: 60, type: 'language', openForStudy: false, facilities: ['projector', 'ac'] },

  // ---------- 综合楼 B 座 ----------
  { id: 'B201', name: 'B201', building: '综合楼B座', campus: '主校区', floor: 2, capacity: 200, type: 'multimedia', openForStudy: true, facilities: ['projector', 'ac'] },
  { id: 'B301', name: 'B301', building: '综合楼B座', campus: '主校区', floor: 3, capacity: 100, type: 'normal', openForStudy: true, facilities: ['socket', 'ac'] },
  { id: 'B302', name: 'B302', building: '综合楼B座', campus: '主校区', floor: 3, capacity: 100, type: 'normal', openForStudy: true, facilities: ['socket'] },
  { id: 'B401', name: 'B401', building: '综合楼B座', campus: '主校区', floor: 4, capacity: 48, type: 'lab', openForStudy: false, facilities: ['projector', 'ac', 'socket'] },

  // ---------- 图书馆 ----------
  { id: 'LIB-201', name: '图书馆201自习室', building: '图书馆', campus: '主校区', floor: 2, capacity: 240, type: 'normal', openForStudy: true, facilities: ['ac', 'socket'] },
  { id: 'LIB-202', name: '图书馆202自习室', building: '图书馆', campus: '主校区', floor: 2, capacity: 160, type: 'normal', openForStudy: true, facilities: ['ac', 'socket'] },

  // ---------- 实验楼 ----------
  { id: 'C105', name: 'C105', building: '实验楼', campus: '主校区', floor: 1, capacity: 64, type: 'drawing', openForStudy: true, facilities: ['projector'] },
  { id: 'C201', name: 'C201', building: '实验楼', campus: '主校区', floor: 2, capacity: 40, type: 'lab', openForStudy: false, facilities: ['projector', 'ac', 'socket'] },
  { id: 'C202', name: 'C202', building: '实验楼', campus: '主校区', floor: 2, capacity: 40, type: 'lab', openForStudy: false, facilities: ['projector', 'ac', 'socket'] },
];

const TYPE_LABEL = {
  normal: '普通教室',
  multimedia: '多媒体',
  lab: '机房/实验室',
  language: '语音室',
  drawing: '制图室',
};

const FACILITY_LABEL = {
  projector: '投影',
  ac: '空调',
  socket: '插座',
  accessible: '无障碍',
};

module.exports = { CLASSROOMS, TYPE_LABEL, FACILITY_LABEL };
