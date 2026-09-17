window.DEMO = {
  updated: '2026-09-17T09:30:00+08:00',
  lists: [{id: 'list1', name: 'List 1（示意）'}, {id: 'list2', name: 'List 2（示意）'}],
  projects: [
    { id: 'p1', listId: 'list1', name: '工單整合平台', client: '示意客戶 A', owner: 'Alvin', start: '2026-09-01', due: '2026-10-08', status: '進行中', tasks: [
      { id: 'a1', name: '需求確認', status: '已完成', start: '2026-09-01', due: '2026-09-05', owner: 'Alvin', description: '訪談與範圍確認 | 截止：2026-09-05 | 已完成\n備註：第一階段以工單同步為範圍。' },
      { id: 'a2', name: '建置', status: '進行中', start: '2026-09-06', due: null, owner: '工程團隊', description: '同步工單 | 截止：2026-09-15 | 已完成\n確認工單 | 截止：2026-09-20 | 進行中\n系統設定 | 截止：2026-09-25 | 未開始\n備註：先確認工單編碼，再進行系統設定。' },
      { id: 'a3', name: '測試資料準備', status: '卡關', start: '2026-09-10', due: '2026-09-16', owner: '客戶窗口', reason: '等待客戶提供測試工單', description: '取得測試資料 | 截止：2026-09-16 | 卡關\n備註：需包含退單與異常工單各五筆。' },
      { id: 'a4', name: '驗證', status: '未開始', start: '2026-09-26', due: '2026-10-02', owner: '工程團隊', dependencies: ['a2', 'a3'], description: '測試工單流程 | 截止：2026-10-02 | 未開始' },
      { id: 'a5', name: '交付', status: '未開始', start: '2026-10-05', due: '2026-10-08', owner: 'Alvin', dependencies: ['a4'], description: '教育訓練 | 截止：2026-10-08 | 未開始' }
    ] },
    { id: 'p2', listId: 'list2', name: '營運數據儀表板', client: '示意客戶 B', owner: '專案團隊', start: '2026-09-03', due: '2026-09-30', status: '進行中', tasks: [
      { id: 'b1', name: '指標定義', status: '已完成', due: '2026-09-08', owner: '專案團隊', description: '確認計算口徑 | 截止：2026-09-08 | 已完成' },
      { id: 'b2', name: '資料整合', status: '進行中', start: '2026-09-09', due: '2026-09-22', owner: '工程團隊', description: '欄位對照 | 截止：2026-09-18 | 進行中\n資料清理 | 截止：2026-09-22 | 未開始' },
      { id: 'b3', name: '報表設計', status: '進行中', start: '2026-09-09', due: '2026-09-24', owner: '設計團隊', description: '版面草稿 | 截止：2026-09-19 | 進行中\n備註：可與資料整合同時進行。' },
      { id: 'b4', name: '上線', status: '未開始', due: '2026-09-30', owner: '專案團隊', dependencies: ['b2', 'b3'], description: '使用者確認 | 截止：2026-09-30 | 未開始' }
    ] },
    { id: 'p3', listId: 'list1', name: '知識庫 POC', client: '內部示意專案', owner: 'Alvin', start: '2026-08-20', due: '2026-09-12', status: '已完成', tasks: [
      { id: 'c1', name: '資料整理', status: '已完成', due: '2026-08-28', owner: '專案團隊', description: '文件整理 | 截止：2026-08-28 | 已完成' },
      { id: 'c2', name: '建置', status: '已完成', due: '2026-09-05', owner: '工程團隊', description: '檢索測試 | 截止：2026-09-05 | 已完成' },
      { id: 'c3', name: '驗收', status: '已完成', due: '2026-09-12', owner: 'Alvin', description: '成果展示 | 截止：2026-09-12 | 已完成\n備註：已完成示意驗收。' }
    ] },
    { id: 'p4', listId: 'list2', name: '設備監測規劃', client: '示意客戶 C', owner: '待指派', start: null, due: null, status: '未開始', tasks: [] }
  ]
};
