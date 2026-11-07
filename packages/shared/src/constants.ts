/* Dữ liệu cố định của game, dùng chung cho API và giao diện. */

export type ActKey = 'read' | 'study' | 'deep' | 'write' | 'move' | 'plant';
export type Mode = 'screen' | 'offline';

export interface Activity {
  n: string;
  mode: Mode;
  /** Cách giám sát: toàn màn hình; giữ ứng dụng mở và màn hình sáng; chỉ câu kiểm tra hiện diện (được mở tài liệu); không giám sát (cất máy đi). */
  watch: Watch;
  /** Cần ảnh hiện trường lúc bắt đầu, giữa phiên và kết thúc (vận động, chăm cây). */
  field: boolean;
  /** Mô tả ngắn hiển thị khi chọn hoạt động. */
  d: string;
  /** Nhãn ô mục tiêu và gợi ý. */
  gl: string;
  ph: string;
  /** Cần ghi chú ít nhất MIN_NOTE_WORDS từ khi xác nhận. */
  needNote: boolean;
}

export type Watch = 'fullscreen' | 'visible' | 'checks' | 'none';

export const ACTS: Record<ActKey, Activity> = {
  read: { n: 'Đọc sách giấy', mode: 'offline', watch: 'visible', field: false, d: 'Giữ ứng dụng mở, úp điện thoại xuống và đọc sách giấy. Hết giờ trả lời câu hỏi xác nhận.', gl: 'Sách và phần sẽ đọc', ph: 'Tên sách, chương hoặc số trang', needNote: true },
  study: { n: 'Học trên máy', mode: 'screen', watch: 'checks', field: false, d: 'Học bằng tài liệu trên máy: được mở Word, PDF, trang tra cứu. Thỉnh thoảng có câu kiểm tra hiện diện; máy sẽ kêu để bạn quay lại trả lời trong 90 giây. Cuối phiên ghi lại việc đã làm được.', gl: 'Việc cần hoàn thành', ph: 'Ví dụ: làm xong đề cương môn Sử', needNote: true },
  deep: { n: 'Tập trung tuyệt đối', mode: 'screen', watch: 'fullscreen', field: false, d: 'Chỉ dùng khi học ngay trong trang web này: chạy toàn màn hình, đổi tab hoặc mở ứng dụng khác quá 3 giây là thất bại.', gl: 'Việc cần hoàn thành', ph: 'Ví dụ: làm xong 20 câu bài tập', needNote: false },
  write: { n: 'Viết và suy ngẫm', mode: 'screen', watch: 'fullscreen', field: false, d: 'Viết nhật ký hoặc bài luận trên máy. Rời trang sẽ được ghi nhận.', gl: 'Chủ đề sẽ viết', ph: 'Một dòng về chủ đề', needNote: true },
  move: { n: 'Vận động', mode: 'offline', watch: 'none', field: true, d: 'Chạy bộ, tập thể dục, đạp xe. Chụp ảnh hiện trường lúc bắt đầu, giữa phiên và lúc kết thúc; giữa các lần chụp thì cất điện thoại.', gl: 'Bài tập', ph: 'Ví dụ: chạy bộ quanh sân', needNote: false },
  plant: { n: 'Chăm cây', mode: 'offline', watch: 'visible', field: true, d: 'Trồng, tưới, tỉa cây. Giữ ứng dụng mở, đặt điện thoại gần đó; chụp ảnh hiện trường lúc bắt đầu, giữa phiên và lúc kết thúc.', gl: 'Việc với cây', ph: 'Ví dụ: thay chậu cho cây chanh', needNote: false },
};
export const ACT_KEYS: ActKey[] = ['read', 'study', 'deep', 'write', 'move', 'plant'];

export const DURS = [5, 10, 15, 25, 45, 60, 90];
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 180;
export const MIN_NOTE_WORDS = 6;
export const CHECK_SECONDS = 45;
/** Phiên được mở tài liệu: người học đang ở ứng dụng khác nên cần thêm thời gian quay lại trả lời. */
export const STUDY_CHECK_SECONDS = 90;

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

export type QuitReason = 'tired' | 'urgent' | 'distracted' | 'hard' | 'closed' | 'violation' | 'other' | 'honest';
export const REASONS: Record<QuitReason, string> = {
  honest: 'Tự khai chưa làm đủ thời gian',
  tired: 'Mệt hoặc buồn ngủ',
  urgent: 'Có việc đột xuất',
  distracted: 'Bị xao nhãng',
  hard: 'Việc quá khó hoặc chán',
  closed: 'Đóng trang giữa chừng',
  violation: 'Rời màn hình quá 3 giây',
  other: 'Lý do khác',
};
export const REASON_KEYS = Object.keys(REASONS) as QuitReason[];
/** Lý do người dùng tự chọn khi bấm dừng phiên (closed và violation do hệ thống ghi). */
export const USER_REASON_KEYS = REASON_KEYS.filter((k) => k !== 'closed' && k !== 'violation' && k !== 'honest');

/* ---------- chống gian lận ---------- */
/** Rời màn hình (đổi tab, click ra ngoài, thoát toàn màn hình) lâu hơn số giây này thì phiên thất bại. */
export const GRACE_SECONDS = 3;

/* ---------- bằng chứng ---------- */
/** Thời hạn chụp ảnh sau khi nhận mã thử thách. */
export const PROOF_SECONDS = 120;
/** Số lần gửi ảnh tối đa cho một phiên. */
export const PROOF_TRIES = 3;
/** Phiên trên máy đạt điểm tập trung từ mức này thì được xác minh mà không cần ảnh. */
export const VERIFY_FOCUS = 70;
/** Câu hỏi nhớ lại đạt từ mức điểm này. */
export const RECALL_PASS = 60;
/** Quá số ngày này sau phiên thì không hỏi nhớ lại nữa. */
export const RECALL_WINDOW_DAYS = 4;
export const MIN_RECALL_WORDS = 4;
/* Ảnh hiện trường (vận động, chăm cây). */
export type PhotoKind = 'start' | 'mid' | 'end';
/** Ảnh bắt đầu phải chụp trong khoảng này kể từ lúc bấm bắt đầu. */
export const FIELD_START_SECONDS = 300;
/** Ảnh giữa phiên chụp trong khoảng từ 30% đến 80% thời gian phiên. */
export const FIELD_MID_FROM = 0.3;
export const FIELD_MID_TO = 0.8;
/** Ảnh hiện trường tự xóa sau số ngày này (thực nghiệm 28 ngày cộng thời gian phân tích). */
export const PHOTO_RETENTION_DAYS = 45;
/** Vật cần chụp cạnh mã thử thách. */
export const PROOF_THING: Record<ActKey, string> = {
  read: 'trang sách đang đọc (thấy rõ chữ in trên trang)',
  study: 'vở, bản nháp hoặc màn hình có bài vừa làm',
  deep: 'vở nháp hoặc bài vừa làm',
  write: 'trang viết hoặc màn hình bài vừa viết',
  move: 'giày, dụng cụ tập hoặc nơi vừa tập',
  plant: 'cây hoặc chậu cây vừa chăm',
};

/* Bản đồ 7x7 lô; hàng 3 và cột 3 là đường, lô (1,1) là nhà chính. */
export const GN = 7;
export const SLOTS: [number, number][] = [];
for (let r = 0; r < GN; r++) for (let c = 0; c < GN; c++) if (r !== 3 && c !== 3 && !(r === 1 && c === 1)) SLOTS.push([r, c]);

export const LIMITS = { userName: 24, groupName: 40, goal: 120, note: 400, question: 200, option: 120, recallAnswer: 500, participantCode: 20 }
/** Mã cá nhân của người tham gia thực nghiệm (ví dụ T0-015): chữ, số, gạch ngang, gạch dưới, dấu chấm. */
export const PARTICIPANT_RE = /^[A-Z0-9][A-Z0-9_.-]{0,19}$/;
/** Mã mời vào nhóm: 6 ký tự, bỏ các ký tự dễ nhầm (0/O, 1/I/L). */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_LENGTH = 6;
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[\s-]/g, '');;

/** Số câu kiểm tra hiện diện trong một phiên trên máy: 1 câu mỗi 10 phút, từ 1 đến 6. */
export function checkCount(mode: Mode, plannedSec: number): number {
  return mode === 'screen' ? Math.min(6, Math.max(1, Math.floor(plannedSec / 60 / 10))) : 0;
}
/** Số câu xác nhận cuối phiên. */
export function verifyCount(mode: Mode): number {
  return mode === 'screen' ? 1 : 2;
}
