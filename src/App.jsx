import React, { useState, useMemo } from 'react';
import { Printer, ChevronLeft, ChevronRight, Eraser, Info, Palette } from 'lucide-react';

// 定义高亮颜色选项
const COLORS = [
  { id: 'none', value: 'transparent', label: '无颜色', tailwind: 'bg-transparent' },
  { id: 'red', value: '#fee2e2', label: '红色', tailwind: 'bg-red-100' },
  { id: 'orange', value: '#ffedd5', label: '橙色', tailwind: 'bg-orange-100' },
  { id: 'yellow', value: '#fef9c3', label: '黄色', tailwind: 'bg-yellow-100' },
  { id: 'green', value: '#dcfce7', label: '绿色', tailwind: 'bg-green-100' },
  { id: 'blue', value: '#dbeafe', label: '蓝色', tailwind: 'bg-blue-100' },
  { id: 'purple', value: '#f3e8ff', label: '紫色', tailwind: 'bg-purple-100' },
  { id: 'pink', value: '#fce7f3', label: '粉色', tailwind: 'bg-pink-100' },
];

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export default function App() {
  const [year, setYear] = useState(2026);
  const [activeColor, setActiveColor] = useState('none');
  const [cellData, setCellData] = useState({}); // 格式: { "2026-0-15": { text: "开会", color: "bg-red-100" } }

  // 辅助函数：判断日期是否有效（比如2月30日是无效的）
  const isValidDate = (y, m, d) => {
    const date = new Date(y, m, d);
    return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d;
  };

  // 辅助函数：获取星期几
  const getDayOfWeek = (y, m, d) => {
    return new Date(y, m, d).getDay();
  };

  const handlePrint = () => {
    window.print();
  };

  const changeYear = (delta) => {
    setYear((prev) => prev + delta);
  };

  const handleCellClick = (month, day) => {
    if (activeColor === 'none') return;
    
    const key = `${year}-${month}-${day}`;
    const selectedColorTw = COLORS.find(c => c.id === activeColor)?.tailwind || 'bg-transparent';
    
    setCellData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        color: selectedColorTw === 'bg-transparent' ? undefined : selectedColorTw
      }
    }));
  };

  const handleTextChange = (month, day, text) => {
    const key = `${year}-${month}-${day}`;
    setCellData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        text: text
      }
    }));
  };

  const clearAll = () => {
    if (window.confirm(`确定要清空 ${year} 年的所有数据吗？`)) {
      setCellData({});
    }
  };

  // 渲染表头
  const renderHeader = () => (
    <thead>
      <tr>
        <th className="sticky top-0 left-0 z-30 bg-gray-100 border-b border-r border-gray-300 w-12 p-2 shadow-[2px_2px_0px_rgba(0,0,0,0.05)] print:shadow-none print:bg-gray-100">
          日期
        </th>
        {MONTHS.map((month, index) => (
          <th key={index} className="sticky top-0 z-20 bg-gray-100 border-b border-r border-gray-300 min-w-[140px] p-2 text-center text-gray-700 font-bold print:bg-gray-100">
            {month}
          </th>
        ))}
      </tr>
    </thead>
  );

  // 渲染日历主体
  const renderBody = () => {
    const rows = [];
    for (let day = 1; day <= 31; day++) {
      rows.push(
        <tr key={day} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
          {/* 左侧固定的天数 */}
          <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-300 text-center font-bold text-gray-600 shadow-[2px_0px_0px_rgba(0,0,0,0.05)] print:shadow-none print:bg-white">
            {day}
          </td>
          
          {/* 每月的单元格 */}
          {Array.from({ length: 12 }).map((_, month) => {
            const valid = isValidDate(year, month, day);
            const dow = valid ? getDayOfWeek(year, month, day) : -1;
            const isWeekend = dow === 0 || dow === 6;
            const isSunday = dow === 0;
            
            const key = `${year}-${month}-${day}`;
            const data = cellData[key] || {};
            const bgColorTw = data.color || (isWeekend ? 'bg-gray-50 print:bg-gray-100' : 'bg-white');

            if (!valid) {
              return <td key={month} className="border-b border-r border-gray-300 bg-gray-200 print:bg-gray-300"></td>;
            }

            return (
              <td 
                key={month} 
                className={`border-b border-r border-gray-300 relative cursor-text group ${bgColorTw}`}
                onClick={() => handleCellClick(month, day)}
              >
                <div className="flex items-center h-full w-full p-1 gap-1">
                  <span className={`text-xs w-4 flex-shrink-0 text-center select-none ${isSunday ? 'text-red-500 font-bold' : isWeekend ? 'text-blue-500 font-bold' : 'text-gray-400'}`}>
                    {DAY_NAMES[dow]}
                  </span>
                  <input
                    type="text"
                    className="flex-1 w-full bg-transparent outline-none text-sm text-gray-800 placeholder-gray-300 focus:placeholder-transparent"
                    placeholder="输入..."
                    value={data.text || ''}
                    onChange={(e) => handleTextChange(month, day, e.target.value)}
                    onClick={(e) => {
                      // 如果选中了画笔颜色，阻止输入框聚焦，优先涂色
                      if (activeColor !== 'none') {
                        e.preventDefault();
                        e.target.blur();
                      } else {
                        e.stopPropagation();
                      }
                    }}
                  />
                </div>
              </td>
            );
          })}
        </tr>
      );
    }
    return <tbody>{rows}</tbody>;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      {/* 打印时隐藏的全局打印样式 */}
      <style>
        {`
          @media print {
            @page { size: landscape; margin: 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            ::-webkit-scrollbar { display: none; }
            input::placeholder { color: transparent !important; }
          }
        `}
      </style>

      {/* 顶部控制栏 - 打印时隐藏 */}
      <div className="print:hidden bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-50">
        
        {/* 年份切换 & 标题 */}
        <div className="flex items-center gap-4">
          <button onClick={() => changeYear(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-2xl font-black text-gray-800 tracking-wider">
            {year} 线性日历 <span className="text-sm font-normal text-gray-500 ml-2">全局规划工具</span>
          </h1>
          <button onClick={() => changeYear(1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight size={20} className="text-gray-600" />
          </button>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center gap-6">
          {/* 画笔工具 */}
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
            <Palette size={16} className="text-gray-500 ml-1" />
            <div className="w-px h-4 bg-gray-300 mx-1"></div>
            {COLORS.map((c) => (
              <button
                key={c.id}
                title={c.label}
                onClick={() => setActiveColor(c.id)}
                className={`w-6 h-6 rounded-full border-2 transition-all duration-200 flex items-center justify-center
                  ${c.id === 'none' ? 'bg-white border-dashed border-gray-400' : 'border-transparent'} 
                  ${activeColor === c.id ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' : 'hover:scale-110'}
                `}
                style={c.id !== 'none' ? { backgroundColor: c.value } : {}}
              >
                {c.id === 'none' && <Eraser size={12} className="text-gray-500" />}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-gray-300"></div>

          {/* 常用按钮 */}
          <button 
            onClick={clearAll}
            className="text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors"
          >
            清空内容
          </button>
          
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-sm font-medium"
          >
            <Printer size={18} />
            <span>横向打印</span>
          </button>
        </div>
      </div>

      {/* 操作提示 - 打印时隐藏 */}
      <div className="print:hidden bg-blue-50 border-b border-blue-100 px-6 py-2 flex items-center gap-2 text-sm text-blue-700">
        <Info size={16} />
        <p><strong>使用技巧：</strong> 1. 直接在表格中输入文字做计划； 2. 在上方选择颜色，点击单元格可进行高亮标记（适合习惯打卡）； 3. 点击“横向打印”即可输出完美A4排版。</p>
      </div>

      {/* 日历主体内容区 */}
      <div className="flex-1 overflow-auto p-4 md:p-6 print:p-0 print:overflow-visible">
        <div className="bg-white border border-gray-300 rounded-xl overflow-hidden shadow-sm print:shadow-none print:border-none print:rounded-none mx-auto max-w-[1400px]">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full border-collapse min-w-[1200px] print:min-w-full text-sm">
              {renderHeader()}
              {renderBody()}
            </table>
          </div>
        </div>
      </div>
      
    </div>
  );
}