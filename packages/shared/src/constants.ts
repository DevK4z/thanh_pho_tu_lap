/* Dữ liệu cố định của game, dùng chung cho API và giao diện. */

export type ActKey = 'read' | 'deep' | 'write' | 'move' | 'plant';
export type Mode = 'screen' | 'offline';

export interface Activity {
  n: string;
  mode: Mode;
  /** Mô tả ngắn hiển thị khi chọn hoạt động. */
  d: string;
  /** Nhãn ô mục tiêu và gợi ý. */
  gl: string;
  ph: string;
  /** Cần ghi chú ít nhất MIN_NOTE_WORDS từ khi xác nhận. */
  needNote: boolean;
}

export const ACTS: Record<ActKey, Activity> = {
  read: { n: 'Đọc sách giấy', mode: 'offline', d: 'Cất điện thoại, đọc sách giấy. Quay lại khi hết giờ để trả lời câu hỏi xác nhận.', gl: 'Sách và phần sẽ đọc', ph: 'Tên sách, chương hoặc số trang', needNote: true },
  deep: { n: 'Học sâu trên máy', mode: 'screen', d: 'Học hoặc làm bài trên máy tính. Rời trang sẽ được ghi nhận là xao nhãng.', gl: 'Việc cần hoàn thành', ph: 'Ví dụ: làm xong 20 câu bài tập', needNote: false },
  write: { n: 'Viết và suy ngẫm', mode: 'screen', d: 'Viết nhật ký hoặc bài luận trên máy. Rời trang sẽ được ghi nhận.', gl: 'Chủ đề sẽ viết', ph: 'Một dòng về chủ đề', needNote: true },
  move: { n: 'Vận động', mode: 'offline', d: 'Chạy bộ, tập thể dục, đạp xe. Cất điện thoại và quay lại khi hết giờ.', gl: 'Bài tập', ph: 'Ví dụ: chạy bộ quanh sân', needNote: false },
  plant: { n: 'Chăm cây', mode: 'offline', d: 'Trồng, tưới, tỉa cây. Cất điện thoại và quay lại khi hết giờ.', gl: 'Việc với cây', ph: 'Ví dụ: thay chậu cho cây chanh', needNote: false },
};
export const ACT_KEYS: ActKey[] = ['read', 'deep', 'write', 'move', 'plant'];

export const DURS = [5, 10, 15, 25, 45, 60, 90];
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 180;
export const MIN_NOTE_WORDS = 6;
export const CHECK_SECONDS = 45;

export interface Tier { t: number; min: number; n: string }
export const TIERS: Tier[] = [
  { t: 1, min: 5, n: 'Mộc' },
  { t: 2, min: 15, n: 'Tinh' },
  { t: 3, min: 30, n: 'Quý' },
  { t: 4, min: 60, n: 'Hiếm' },
];

export type ItemId = 'cay' | 'hoa' | 'nhanho' | 'vuon' | 'quan' | 'san' | 'thuvien' | 'chungcu' | 'congvien' | 'thap' | 'kinh' | 'truong';
export interface Item { id: ItemId; n: string; t: number }
export const ITEMS: Item[] = [
  { id: 'cay', n: 'Cây xanh', t: 1 }, { id: 'hoa', n: 'Vườn hoa', t: 1 }, { id: 'nhanho', n: 'Nhà nhỏ', t: 1 },
  { id: 'vuon', n: 'Nhà có vườn', t: 2 }, { id: 'quan', n: 'Quán trà', t: 2 }, { id: 'san', n: 'Sân chơi', t: 2 },
  { id: 'thuvien', n: 'Thư viện', t: 3 }, { id: 'chungcu', n: 'Chung cư', t: 3 }, { id: 'congvien', n: 'Công viên', t: 3 },
  { id: 'thap', n: 'Tháp quan sát', t: 4 }, { id: 'kinh', n: 'Tòa nhà xanh', t: 4 }, { id: 'truong', n: 'Tòa thị chính', t: 4 },
];
export const POP: Partial<Record<ItemId, number>> = { nhanho: 4, vuon: 6, chungcu: 40 };

export type HouseStyle = 'san' | 'trinh' | 'ngoi' | 'da';
export interface HouseSpec { n: string; wall: string; roof: string; awn: string; rh: number; w: number; d: number; h: number; lift?: number }
export const HST: Record<HouseStyle, HouseSpec> = {
  san: { n: 'Biệt thự mái lam', wall: 'wood', roof: 'rr', awn: 'rg', rh: 17, w: 0.78, d: 0.62, h: 20, lift: 9 },
  trinh: { n: 'Nhà phố hiện đại', wall: 'wb', roof: 'rb', awn: 'awn', rh: 12, w: 0.9, d: 0.7, h: 19 },
  ngoi: { n: 'Nhà ngói đỏ', wall: 'wa', roof: 'rr', awn: 'rg', rh: 18, w: 0.82, d: 0.66, h: 22 },
  da: { n: 'Biệt thự mái lục', wall: 'wc', roof: 'rg', awn: 'rr', rh: 18, w: 0.84, d: 0.68, h: 23 },
};
export const HKEYS: HouseStyle[] = ['san', 'trinh', 'ngoi', 'da'];
export const DAILY_GOALS = [15, 30, 45, 60, 90];

export interface Level { lv: number; at: number; n: string }
export const LV: Level[] = [
  { lv: 1, at: 0, n: 'Nền móng' },
  { lv: 2, at: 30, n: 'Dựng khung' },
  { lv: 3, at: 90, n: 'Lợp mái' },
  { lv: 4, at: 240, n: 'Hoàn thiện' },
  { lv: 5, at: 600, n: 'Nhà mẫu của thành phố' },
];

export type QuitReason = 'tired' | 'urgent' | 'distracted' | 'hard' | 'closed' | 'other';
export const REASONS: Record<QuitReason, string> = {
  tired: 'Mệt hoặc buồn ngủ',
  urgent: 'Có việc đột xuất',
  distracted: 'Bị xao nhãng',
  hard: 'Việc quá khó hoặc chán',
  closed: 'Đóng trang giữa chừng',
  other: 'Lý do khác',
};
export const REASON_KEYS = Object.keys(REASONS) as QuitReason[];

/* Bản đồ 7x7 lô; hàng 3 và cột 3 là đường, lô (1,1) là nhà chính. */
export const GN = 7;
export const SLOTS: [number, number][] = [];
for (let r = 0; r < GN; r++) for (let c = 0; c < GN; c++) if (r !== 3 && c !== 3 && !(r === 1 && c === 1)) SLOTS.push([r, c]);

export const LIMITS = { userName: 24, groupName: 40, goal: 120, note: 400, question: 200, option: 120 };

/** Số câu kiểm tra hiện diện trong một phiên trên máy: 1 câu mỗi 10 phút, từ 1 đến 6. */
export function checkCount(mode: Mode, plannedSec: number): number {
  return mode === 'screen' ? Math.min(6, Math.max(1, Math.floor(plannedSec / 60 / 10))) : 0;
}
/** Số câu xác nhận cuối phiên. */
export function verifyCount(mode: Mode): number {
  return mode === 'screen' ? 1 : 2;
}
