# -*- coding: utf-8 -*-
"""
生成课表导入测试样本（xlsx / docx / csv / txt）
运行：<python> tools/make-samples.py
输出目录：tools/samples/
"""
import os
import struct

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

try:
    import xlsxwriter
except ImportError:
    xlsxwriter = None

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "samples")
os.makedirs(OUT, exist_ok=True)


def path(name):
    return os.path.join(OUT, name)


def style_sheet(ws, wrap_cols=None):
    for col in range(1, ws.max_column + 1):
        ws.column_dimensions[get_column_letter(col)].width = 20
    for row in ws.iter_rows():
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="center")


# ---------------------------------------------------------------- 1. 列表式 Excel
def make_list_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.title = "我的课表"
    ws.append(["课程名称", "星期", "节次", "教室", "周次", "教师"])
    rows = [
        ["高等数学(上)", "星期一", "1-2", "A301", "1-16周", "张建国"],
        ["大学英语(II)", "周一", "3-4节", "A401", "1-16周", "李雯"],
        ["程序设计基础", "星期三", "5-6", "A301", "1-16", "刘伟"],
        ["大学物理", "星期四", "第7-8节", "A201", "1-16周(单)", "周立"],
        ["体育(羽毛球)", "周五", "9-10", "C105", "3-12周", "吴强"],
        ["线性代数", "星期二", "1-2", "B201", "1-16周", "赵敏"],
    ]
    for r in rows:
        ws.append(r)
    for c in ws[1]:
        c.font = Font(bold=True)
    style_sheet(ws)
    wb.save(path("sample-list.xlsx"))
    return "sample-list.xlsx"


# ---------------------------------------------------------------- 2. 网格式 Excel（含横向合并的节次列）
def make_grid_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.title = "课程表"

    ws.append(["节次", "星期一", "星期二", "星期三", "星期四", "星期五"])

    # 第 1-2 节（节次列合并）
    ws.append(["1-2节", "高等数学(上)\n张建国\nA301\n1-16周", "", "数据结构\n刘伟\nB301\n1-16周", "", ""])
    ws.append(["", "", "", "", "", ""])
    ws.merge_cells("A2:A3")
    ws.merge_cells("B2:B3")
    ws.merge_cells("D2:D3")

    # 第 3-4 节
    ws.append(["3-4节", "", "大学英语(II)\n李雯\nA401\n1-16周", "", "大学物理\n周立\nA201\n1-16周(单)", ""])
    ws.append(["", "", "", "", "", ""])
    ws.merge_cells("A4:A5")
    ws.merge_cells("C4:C5")
    ws.merge_cells("E4:E5")

    # 第 5-6 节
    ws.append(["5-6节", "程序设计基础\n刘伟\nA301\n1-16周", "", "", "", "计算机网络\n郑楠\nB201\n1-16周"])
    ws.append(["", "", "", "", "", ""])
    ws.merge_cells("A6:A7")
    ws.merge_cells("B6:B7")
    ws.merge_cells("F6:F7")

    for c in ws[1]:
        c.font = Font(bold=True)
    style_sheet(ws)
    wb.save(path("sample-grid.xlsx"))
    return "sample-grid.xlsx"


# ---------------------------------------------------------------- 3. 网格式 Excel（节次列不合并，靠合并单元格跨行表示连堂）
def make_grid_rows_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.title = "课表"
    ws.append(["节次", "星期一", "星期二", "星期三", "星期四", "星期五"])
    periods = ["第1节", "第2节", "第3节", "第4节", "第5节", "第6节", "第7节", "第8节"]
    data = {
        "第1节": {"星期一": "高等数学(上)\n张建国\nA301\n1-16周", "星期三": "数据结构\n刘伟\nB301\n1-16周"},
        "第2节": {},
        "第3节": {"星期二": "大学英语(II)\n李雯\nA401\n1-16周"},
        "第4节": {},
        "第5节": {"星期一": "程序设计基础\n刘伟\nA301\n1-16周"},
        "第6节": {},
        "第7节": {"星期四": "大学物理\n周立\nA201\n1-16周"},
        "第8节": {},
    }
    for p in periods:
        ws.append([p] + [data[p].get(day, "") for day in ["星期一", "星期二", "星期三", "星期四", "星期五"]])

    # 高等数学 / 数据结构 跨 1-2 节；英语跨 3-4 节；程序设计跨 5-6 节；物理跨 7-8 节
    ws.merge_cells("B2:B3")   # 周一 第1-2节
    ws.merge_cells("D2:D3")   # 周三 第1-2节
    ws.merge_cells("C4:C5")   # 周二 第3-4节
    ws.merge_cells("B6:B7")   # 周一 第5-6节
    ws.merge_cells("E8:E9")   # 周四 第7-8节

    for c in ws[1]:
        c.font = Font(bold=True)
    style_sheet(ws)
    wb.save(path("sample-grid-rows.xlsx"))
    return "sample-grid-rows.xlsx"


# ---------------------------------------------------------------- 4. 多工作表（第一个表无关）
def make_multi_sheet_xlsx():
    wb = Workbook()
    ws0 = wb.active
    ws0.title = "说明"
    ws0.append(["本文件用于测试多工作表识别"])
    ws0.append(["第二个工作表才是真正的课表"])

    ws1 = wb.create_sheet("2026秋课表")
    ws1.append(["课程名称", "星期", "节次", "教室", "周次", "教师"])
    for r in [
        ["机器学习导论", "周一", "9-10", "B401", "1-8周", "王海涛"],
        ["Python数据分析", "周三", "9-10", "B401", "3-12周", "孙倩"],
        ["数据结构与算法", "周三", "7-8", "B301", "1-16周", "刘伟"],
    ]:
        ws1.append(r)
    style_sheet(ws1)
    wb.save(path("sample-multi-sheet.xlsx"))
    return "sample-multi-sheet.xlsx"


# ---------------------------------------------------------------- 5. inlineStr 工作簿（openpyxl 直接写单元格文本，不生成 sharedStrings.xml）
def make_inline_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.title = "课表"
    ws.append(["课程名称", "星期", "节次", "教室", "周次"])
    for r in [
        ["高等数学(上)", "周一", "1-2", "A301", "1-16周"],
        ["程序设计基础", "周三", "5-6", "A301", "1-16周"],
        ["机器学习导论", "周一", "9-10", "B401", "1-8周"],
    ]:
        ws.append(r)
    style_sheet(ws)
    wb.save(path("sample-inline.xlsx"))
    return "sample-inline.xlsx"


# ---------------------------------------------------------------- 5b. 使用 sharedStrings 的工作簿（XlsxWriter）
def make_shared_xlsx():
    if xlsxwriter is None:
        return None
    wb = xlsxwriter.Workbook(path("sample-shared.xlsx"))
    ws = wb.add_worksheet("课表")
    ws.write_row(0, 0, ["课程名称", "星期", "节次", "教室", "周次", "教师"])
    rows = [
        ["高等数学(上)", "周一", "1-2", "A301", "1-16周", "张建国"],
        ["程序设计基础", "周三", "5-6", "A301", "1-16周", "刘伟"],
        ["计算机网络", "周五", "1-2", "B201", "1-16周", "郑楠"],
    ]
    for i, r in enumerate(rows, start=1):
        ws.write_row(i, 0, r)
    wb.close()
    return "sample-shared.xlsx"


# ---------------------------------------------------------------- 6. 无课表结构的 Excel
def make_bad_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.append(["某某学院 2026 学年校历"])
    ws.append(["月份", "事项"])
    ws.append(["9 月", "开学"])
    ws.append(["1 月", "期末考试"])
    wb.save(path("sample-not-a-schedule.xlsx"))
    return "sample-not-a-schedule.xlsx"


# ---------------------------------------------------------------- 7. 列表式 Word 表格
def set_cell_lines(cell, lines):
    cell.text = lines[0]
    for ln in lines[1:]:
        cell.add_paragraph(ln)


def add_vmerge(cell, restart):
    tcPr = cell._tc.get_or_add_tcPr()
    vm = OxmlElement("w:vMerge")
    if restart:
        vm.set(qn("w:val"), "restart")
    tcPr.append(vm)


def make_list_docx():
    doc = Document()
    doc.add_heading("2026-2027 学年第一学期个人课表", level=1)

    table = doc.add_table(rows=1, cols=6)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, h in enumerate(["课程名称", "星期", "节次", "教室", "周次", "任课教师"]):
        hdr[i].text = h

    rows = [
        ["高等数学(上)", "星期一", "1-2节", "A301", "1-16周", "张建国"],
        ["程序设计基础", "周三", "5-6节", "A301", "1-16周", "刘伟"],
        ["大学物理", "周四", "7-8节", "A201", "1-16周(单)", "周立"],
        ["计算机网络", "周五", "1-2节", "B201", "1-16周", "郑楠"],
    ]
    for r in rows:
        cells = table.add_row().cells
        for i, v in enumerate(r):
            cells[i].text = v

    doc.save(path("sample-list.docx"))
    return "sample-list.docx"


# ---------------------------------------------------------------- 8. 网格式 Word 表格（含纵向合并）
def make_grid_docx():
    doc = Document()
    doc.add_heading("课程表", level=1)

    table = doc.add_table(rows=1, cols=6)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, h in enumerate(["节次", "星期一", "星期二", "星期三", "星期四", "星期五"]):
        hdr[i].text = h

    # 第 1-2 节
    r1 = table.add_row().cells
    set_cell_lines(r1[0], ["1-2节"])
    set_cell_lines(r1[1], ["高等数学(上)", "张建国", "A301", "1-16周"])
    set_cell_lines(r1[3], ["数据结构", "刘伟", "B301", "1-16周"])
    add_vmerge(r1[0], True)
    add_vmerge(r1[1], True)
    add_vmerge(r1[3], True)

    r2 = table.add_row().cells
    add_vmerge(r2[0], False)
    add_vmerge(r2[1], False)
    add_vmerge(r2[3], False)

    # 第 3-4 节
    r3 = table.add_row().cells
    set_cell_lines(r3[0], ["3-4节"])
    set_cell_lines(r3[2], ["大学英语(II)", "李雯", "A401", "1-16周"])
    add_vmerge(r3[0], True)
    add_vmerge(r3[2], True)

    r4 = table.add_row().cells
    add_vmerge(r4[0], False)
    add_vmerge(r4[2], False)

    # 第 5-6 节
    r5 = table.add_row().cells
    set_cell_lines(r5[0], ["5-6节"])
    set_cell_lines(r5[1], ["程序设计基础", "刘伟", "A301", "1-16周"])
    add_vmerge(r5[0], True)
    add_vmerge(r5[1], True)

    r6 = table.add_row().cells
    add_vmerge(r6[0], False)
    add_vmerge(r6[1], False)

    doc.save(path("sample-grid.docx"))
    return "sample-grid.docx"


# ---------------------------------------------------------------- 9. 纯段落式 Word
def make_text_docx():
    doc = Document()
    doc.add_heading("课程安排", level=1)
    for line in [
        "高等数学(上),周一,1,2,A301,1-16",
        "大学英语(II),周一,3,4,A401,1-16",
        "程序设计基础,周三,5,6,A301,1-16",
        "大学物理,周四,7,8,A201,1-16单",
        "计算机网络,周五,1,2,B201,1-16",
    ]:
        doc.add_paragraph(line)
    doc.save(path("sample-text.docx"))
    return "sample-text.docx"


# ---------------------------------------------------------------- 10. CSV / TXT
def make_text_files():
    csv_lines = [
        "课程名称,星期,节次,教室,周次,教师",
        "高等数学(上),星期一,1-2,A301,1-16周,张建国",
        "程序设计基础,周三,5-6,A301,1-16周,刘伟",
        "计算机网络,周五,1-2,B201,1-16周,郑楠",
    ]
    with open(path("sample-list.csv"), "w", encoding="utf-8-sig", newline="") as f:
        f.write("\r\n".join(csv_lines) + "\r\n")

    txt_lines = [
        "# 每行一条课程",
        "高等数学(上),周一,1,2,A301,1-16",
        "程序设计基础,周三,5,6,A301,1-16",
        "大学物理 周四 7-8节 A201 1-16周单",
    ]
    with open(path("sample-list.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(txt_lines) + "\n")
    return ["sample-list.csv", "sample-list.txt"]


# ---------------------------------------------------------------- 11. 伪造旧版 .xls（OLE2 头）
def make_fake_xls():
    header = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 504
    with open(path("sample-legacy.xls"), "wb") as f:
        f.write(header)
    return "sample-legacy.xls"


# ---------------------------------------------------------------- 12. 引号包裹含逗号的 CSV
def make_quoted_csv():
    with open(path("sample-quoted.csv"), "w", encoding="utf-8", newline="") as f:
        f.write("课程名称,星期,节次,教室,周次\n")
        f.write('"高等数学(上),含实验",星期一,1-2,A301,1-16周\n')
        f.write('"程序设计基础,上机",周三,5-6,A301,1-16周\n')
    return "sample-quoted.csv"


# ---------------------------------------------------------------- 13. 交叉验证：同样的课表，一个列表式一个网格式
CROSS_ROWS = [
    ("高等数学(上)", 1, 1, 2, "A301", "张建国", "1-16周"),
    ("大学英语(II)", 1, 3, 4, "A401", "李雯", "1-16周"),
    ("数据结构", 3, 1, 2, "B301", "刘伟", "1-16周"),
    ("程序设计基础", 3, 5, 6, "A301", "刘伟", "1-16周"),
    ("大学物理", 4, 7, 8, "A201", "周立", "1-16周(单)"),
]
DAY_CN = {1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五"}


def make_cross_samples():
    # (a) 列表式
    wb = Workbook()
    ws = wb.active
    ws.title = "课表"
    ws.append(["课程名称", "星期", "节次", "教室", "周次", "教师"])
    for name, day, s, e, room, teacher, weeks in CROSS_ROWS:
        ws.append([name, DAY_CN[day], "%d-%d" % (s, e), room, weeks, teacher])
    for c in ws[1]:
        c.font = Font(bold=True)
    style_sheet(ws)
    wb.save(path("sample-cross-list.xlsx"))

    # (b) 网格式（同样的课程，用合并单元格表达连堂）
    wb2 = Workbook()
    ws2 = wb2.active
    ws2.title = "课表"
    ws2.append(["节次", "星期一", "星期二", "星期三", "星期四", "星期五"])

    # 每个不同的"起始节"占两行（表示连堂）
    slot_row = {}
    row = 2
    for _, _, s, _, _, _, _ in CROSS_ROWS:
        if s not in slot_row:
            slot_row[s] = row
            row += 2

    for r in sorted(slot_row.values()):
        period_label = ""
        for _, _, s, e, _, _, _ in CROSS_ROWS:
            if slot_row[s] == r:
                period_label = "%d-%d节" % (s, e)
                break
        ws2.cell(row=r, column=1, value=period_label)
        ws2.cell(row=r + 1, column=1, value="")
        ws2.merge_cells(start_row=r, start_column=1, end_row=r + 1, end_column=1)

        for name, day, s, _, room, teacher, weeks in CROSS_ROWS:
            if slot_row[s] != r:
                continue
            col = 1 + day  # 星期 day -> 第 day+1 列（B 列是周一）
            ws2.cell(row=r, column=col, value="%s\n%s\n%s\n%s" % (name, teacher, room, weeks))
            ws2.cell(row=r + 1, column=col, value="")
            ws2.merge_cells(start_row=r, start_column=col, end_row=r + 1, end_column=col)

    for c in ws2[1]:
        c.font = Font(bold=True)
    style_sheet(ws2)
    wb2.save(path("sample-cross-grid.xlsx"))
    return ["sample-cross-list.xlsx", "sample-cross-grid.xlsx"]


# ---------------------------------------------------------------- 14. 智能识别：脏文件（标题 + 说明 + 空行 + 表头别名 + 备注）
def make_messy_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.append(["XX大学 2026-2027 学年 第一学期 学生个人课表"])
    ws.append(["学号：2026001    姓名：张三    专业：计算机科学与技术    班级：计科2601"])
    ws.append(["打印时间：2026-09-01    打印人：教务处"])
    ws.append([])
    ws.append([])
    # 表头故意全部使用别名：科目 / 上课时间 / 教学地点 / 授课教师
    ws.append(["序号", "科目", "星期", "上课时间", "教学地点", "周次", "授课教师", "学分"])
    rows = [
        [1, "高等数学(上)", "星期一", "1-2", "A301", "1-16周", "张建国", 5],
        [2, "大学英语(II)", "周一", "3-4", "A401", "1-16周", "李雯", 3],
        [3, "程序设计基础", "星期三", "5-6", "A301", "1-16周", "刘伟", 4],
        [4, "大学物理", "星期四", "7-8", "A201", "1-16周(单)", "周立", 3],
        [5, "计算机网络", "星期五", "1-2", "B201", "1-16周", "郑楠", 3],
    ]
    for r in rows:
        ws.append(r)
    ws.append([])
    ws.append(["注：以上课程如有调整，以教务处最新通知为准。"])
    ws.append(["选课系统导出于 2026-09-01"])
    for c in ws[6]:
        c.font = Font(bold=True)
    style_sheet(ws)
    wb.save(path("sample-messy.xlsx"))
    return "sample-messy.xlsx"


# ---------------------------------------------------------------- 15. 智能识别：完全没有表头
def make_headerless_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.title = "课表"
    for r in [
        ["高等数学(上)", "周一", "1-2", "A301", "1-16周", "张建国"],
        ["大学英语(II)", "周一", "3-4", "A401", "1-16周", "李雯"],
        ["程序设计基础", "周三", "5-6", "A301", "1-16周", "刘伟"],
        ["大学物理", "周四", "7-8", "A201", "1-16周(单)", "周立"],
        ["计算机网络", "周五", "1-2", "B201", "1-16周", "郑楠"],
    ]:
        ws.append(r)
    style_sheet(ws)
    wb.save(path("sample-no-header.xlsx"))
    return "sample-no-header.xlsx"


# ---------------------------------------------------------------- 16. 智能识别：两行复合表头
def make_two_row_header_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.title = "课表"
    ws.append(["课程信息", "", "上课时间", "", "上课地点", "周次"])
    ws.append(["课程名称", "教师", "星期", "节次", "教室", ""])
    ws.merge_cells("A1:B1")
    ws.merge_cells("C1:D1")
    for r in [
        ["高等数学(上)", "张建国", "星期一", "1-2", "A301", "1-16周"],
        ["大学英语(II)", "李雯", "周一", "3-4", "A401", "1-16周"],
        ["程序设计基础", "刘伟", "星期三", "5-6", "A301", "1-16周"],
    ]:
        ws.append(r)
    for c in ws[2]:
        c.font = Font(bold=True)
    style_sheet(ws)
    wb.save(path("sample-two-row-header.xlsx"))
    return "sample-two-row-header.xlsx"


# ---------------------------------------------------------------- 17. 智能识别：同一 sheet 多块，课表在下半部分
def make_multi_block_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.title = "综合报表"
    ws.append(["班级学生名单"])
    ws.append(["姓名", "学号", "班级"])
    for n, sid in [("张三", "2026001"), ("李四", "2026002"), ("王五", "2026003")]:
        ws.append([n, sid, "计科2601"])
    ws.append([])
    ws.append([])
    ws.append(["课程名称", "星期", "节次", "教室", "周次", "教师"])
    for r in [
        ["高等数学(上)", "周一", "1-2", "A301", "1-16周", "张建国"],
        ["数据结构", "周三", "7-8", "B301", "1-16周", "刘伟"],
        ["大学物理", "周四", "3-4", "A201", "1-16周", "周立"],
    ]:
        ws.append(r)
    style_sheet(ws)
    wb.save(path("sample-multi-block.xlsx"))
    return "sample-multi-block.xlsx"


# ---------------------------------------------------------------- 18. 智能识别：表格前有大量说明的 Word
def make_messy_docx():
    doc = Document()
    doc.add_heading("2026-2027 学年第一学期课程表", level=0)
    doc.add_paragraph("学院：计算机学院")
    doc.add_paragraph("专业：计算机科学与技术")
    doc.add_paragraph("姓名：张三    学号：2026001")
    doc.add_paragraph("说明：本表为个人课表，如有调整以教务系统为准。")

    table = doc.add_table(rows=1, cols=5)
    table.style = "Table Grid"
    for i, h in enumerate(["科目", "星期", "上课时间", "教学地点", "周次"]):
        table.rows[0].cells[i].text = h
    for r in [
        ["高等数学(上)", "周一", "1-2节", "A301", "1-16周"],
        ["程序设计基础", "周三", "5-6节", "A301", "1-16周"],
        ["大学物理", "周四", "7-8节", "A201", "1-16周(单)"],
    ]:
        cells = table.add_row().cells
        for i, v in enumerate(r):
            cells[i].text = v

    doc.add_paragraph("备注：实验课地点以实验室通知为准。")
    doc.save(path("sample-messy.docx"))
    return "sample-messy.docx"


# ---------------------------------------------------------------- 19. 智能识别：无表头且列顺序被打乱
def make_shuffled_columns_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.title = "课表"
    # 顺序：教室 / 课程名 / 周次 / 星期 / 节次
    for r in [
        ["A301", "高等数学(上)", "1-16周", "周一", "1-2"],
        ["A401", "大学英语(II)", "1-16周", "周一", "3-4"],
        ["B301", "数据结构", "1-16周", "周三", "7-8"],
        ["A201", "大学物理", "1-16周(单)", "周四", "3-4"],
    ]:
        ws.append(r)
    style_sheet(ws)
    wb.save(path("sample-shuffled.xlsx"))
    return "sample-shuffled.xlsx"


if __name__ == "__main__":
    made = []
    for fn in [
        make_list_xlsx, make_grid_xlsx, make_grid_rows_xlsx, make_multi_sheet_xlsx,
        make_inline_xlsx, make_shared_xlsx, make_bad_xlsx, make_list_docx, make_grid_docx,
        make_text_docx, make_text_files, make_fake_xls, make_quoted_csv, make_cross_samples,
        make_messy_xlsx, make_headerless_xlsx, make_two_row_header_xlsx, make_multi_block_xlsx,
        make_messy_docx, make_shuffled_columns_xlsx,
    ]:
        r = fn()
        if isinstance(r, list):
            made.extend(r)
        elif r:
            made.append(r)

    print("生成样本 %d 个：" % len(made))
    for m in made:
        p = path(m)
        print("  %-34s %8d bytes" % (m, os.path.getsize(p) if os.path.exists(p) else -1))
