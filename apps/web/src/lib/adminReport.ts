/* Báo cáo cho admin khi một nhiệm vụ kết thúc.
   Dữ liệu thật đã được máy chủ ghi khi gọi /complete hoặc /quit (và máy chủ cũng ghi dòng "admin_report" vào log của nó).
   Hàm này in cùng bản tổng hợp ra console trình duyệt để tiện theo dõi khi phát triển. */
import type { TaskStats } from '@tptl/shared';

export type TaskStatus = 'success' | 'failed';

export interface AdminReport {
  userId: string;
  taskStatus: TaskStatus;
  at: string;
  totalTasks: number;
  successTasks: number;
  failedTasks: number;
  /** Tỷ lệ hoàn thành (%), null khi chưa có nhiệm vụ nào. */
  completionRate: number | null;
  currentStreak: number;
  gold: number;
  wood: number;
}

export function sendDataToAdmin(userId: string, taskStatus: TaskStatus, stats: TaskStats): AdminReport {
  const total = stats.tasksDone + stats.tasksFailed;
  const report: AdminReport = {
    userId,
    taskStatus,
    at: new Date().toISOString(),
    totalTasks: total,
    successTasks: stats.tasksDone,
    failedTasks: stats.tasksFailed,
    completionRate: total ? Math.round((stats.tasksDone / total) * 1000) / 10 : null,
    currentStreak: stats.currentStreak,
    gold: stats.gold,
    wood: stats.wood,
  };
  console.log('[sendDataToAdmin]', report);
  return report;
}
