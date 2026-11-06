/* Hợp đồng dữ liệu giữa REST API và giao diện. Mốc thời gian là mili giây (epoch). */
import type { ActKey, HouseStyle, ItemId, Mode, QuitReason } from './constants';

export type Provider = 'google' | 'facebook' | 'guest';

/** Số liệu cộng dồn của một ngày. */
export interface DayStat {
  /** phiên đã đăng ký */ s: number;
  /** phiên hoàn thành */ c: number;
  /** phiên bỏ cuộc */ q: number;
  /** giây đã đăng ký */ pl: number;
  /** giây thực hiện */ ac: number;
  /** giây hoàn thành */ cs: number;
  /** giây rời trang */ aw: number;
  /** lần rời trang */ dn: number;
  /** câu kiểm tra không phản hồi */ ms: number;
  /** câu đã trả lời */ qa: number;
  /** câu đúng */ qc: number;
  /** tổng điểm tập trung */ fs: number;
  /** số phiên có điểm tập trung */ fn: number;
  /** phiên hoàn thành có xác minh */ vf: number;
  /** phiên hoàn thành chưa xác minh */ uv: number;
  /** câu nhớ lại đã chấm */ rq: number;
  /** câu nhớ lại khớp */ rc: number;
  /** kiểm tra trực tiếp khớp */ so: number;
  /** kiểm tra trực tiếp không khớp */ sn: number;
}
export type Days = Record<string, DayStat>;

export interface PlotItem { s: number; i: ItemId; t: number; g: 0 | 1 }
export interface PendingReward { sid: string; t: number; g: 0 | 1; m: number; a: ActKey }

export interface Me {
  id: string;
  name: string;
  provider: Provider;
  avatarUrl: string | null;
  currentGroupId: string | null;
  /** Quản trị viên của ứng dụng (đăng nhập Google bằng email nằm trong ADMIN_EMAILS của máy chủ): xem được báo cáo mọi nhóm. */
  isAdmin: boolean;
}

export interface Player {
  id: string;
  userId: string;
  name: string;
  style: HouseStyle;
  dailyGoal: number;
  /** Phút đã xác minh: tính vào giai đoạn nhà. */
  totalFocusMin: number;
  /** Phút của phiên chưa xác minh: không tính vào giai đoạn nhà. */
  unverifiedMin: number;
  plot: PlotItem[];
  pending: PendingReward[];
  quitReasons: Partial<Record<QuitReason, number>>;
  /** Số phiên thành công liên tiếp; về 0 khi một phiên thất bại. */
  currentStreak: number;
  bestStreak: number;
  /** Phiên hoàn thành và phiên thất bại (bỏ cuộc, rời màn hình, đóng trang). */
  tasksDone: number;
  tasksFailed: number;
  days: Days;
  createdAt: number;
  lastAt: number | null;
}

export interface GroupSummary { id: string; name: string; ownerName: string; createdAt: number; members: number }
export interface GroupInfo { id: string; name: string; ownerId: string; ownerName: string; createdAt: number }

/** Câu hỏi gửi xuống trình duyệt: không kèm đáp án. */
export interface IssuedQuestion { id: string; q: string; o: string[] }

export interface ActiveSession {
  id: string;
  act: ActKey;
  mode: Mode;
  plannedSec: number;
  startedAt: number;
  goal: string;
  day: string;
  checks: IssuedQuestion[];
  /** Số câu kiểm tra hiện diện đã trả lời (theo thứ tự). */
  checksAnswered: number;
  checksCorrect: number;
  verify: IssuedQuestion[];
  proof: ProofState;
}

/** none: chưa lấy mã · ready: đã có mã, chờ ảnh · ok: ảnh khớp · fail: ảnh chưa khớp · na: máy chủ chưa bật kiểm tra ảnh. */
export type ProofStatus = 'none' | 'ready' | 'ok' | 'fail' | 'na';
export interface ProofState {
  status: ProofStatus;
  code: string | null;
  /** Số trang cần mở (chỉ với hoạt động đọc sách). */
  page: number | null;
  expiresAt: number | null;
  tries: number;
  reason: string;
}

/** Phiên hôm trước đang chờ câu hỏi nhớ lại. */
export interface RecallDue { sid: string; day: string; act: ActKey; question: string | null }
/** score null: chưa chấm tự động được, người tổ chức xem lại. */
export interface RecallResult { score: number | null; verdict: string; reason: string }

export type SpotResult = 'ok' | 'no';
export interface SpotPick {
  sid: string;
  day: string;
  act: ActKey;
  minutes: number;
  goal: string;
  note: string;
  verified: boolean;
  result: SpotResult | null;
}
export interface SpotRow {
  playerId: string;
  name: string;
  /** Là chính người xem: không hiện phiên được bốc để giữ tính bất ngờ, và không được tự chấm. */
  self: boolean;
  picks: SpotPick[];
}
export interface SpotDraw { week: string | null; rows: SpotRow[] }

export interface GroupDetail {
  group: GroupInfo;
  isOwner: boolean;
  /** Có quyền quản trị nhóm: là trưởng nhóm, hoặc là quản trị viên ứng dụng. */
  canManage: boolean;
  players: Player[];
  /** id người chơi của tài khoản hiện tại trong nhóm, null nếu chưa tạo nhà. */
  meId: string | null;
  active: ActiveSession | null;
  recall: RecallDue | null;
  serverTime: number;
}

export interface SessionLog {
  id: string;
  day: string;
  startedAt: number;
  endedAt: number | null;
  act: ActKey;
  mode: Mode;
  plannedSec: number;
  activeSec: number;
  status: 'done' | 'quit';
  reason: QuitReason | null;
  dist: number;
  missed: number;
  focus: number | null;
  note: string;
  verified: boolean;
  proofStatus: ProofStatus;
  proofReason: string;
  recallQuestion: string;
  recallAnswer: string;
  recallScore: number | null;
  recallVerdict: string;
  recallReason: string;
  spotResult: SpotResult | null;
}

export interface SessionResult {
  focus: number;
  minutes: number;
  tier: number;
  shiny: boolean;
  qc: number;
  qa: number;
  dist: number;
  away: number;
  missed: number;
  mode: Mode;
  prevLv: number;
  newLv: number;
  /** false: vẫn nhận công trình nhưng số phút không tính vào giai đoạn nhà và bảng xếp hạng. */
  verified: boolean;
  stats: TaskStats;
}

/** Tổng hợp nhiệm vụ của một người sau khi phiên kết thúc. */
export interface TaskStats { tasksDone: number; tasksFailed: number; currentStreak: number; bestStreak: number }
export interface QuitResult { lostStreak: number; stats: TaskStats }

/** Kết quả sau khi quản trị viên cấp phần thưởng công trình. */
export interface GrantResult { name: string; pending: number }

export interface GroupQuestion { id: string; act: ActKey | 'all'; q: string; o: string[]; a: number }

export interface PublicConfig { google: string | null; facebook: string | null }

export interface ApiErrorBody { error: { code: string; message: string } }

/** Một dòng báo cáo admin: một người trong một nhóm. Tỷ lệ tính trên số phiên đã kết thúc (không tính phiên đang chạy). */
export interface AdminReportRow {
  playerId: string;
  name: string;
  groupId: string;
  groupName: string;
  provider: Provider;
  email: string | null;
  /** Phiên đã đăng ký (gồm cả phiên đang chạy). */
  registered: number;
  done: number;
  failed: number;
  active: number;
  /** done / (done + failed), null khi chưa có phiên kết thúc. */
  completionRate: number | null;
  /** failed / (done + failed). */
  quitRate: number | null;
  /** Số phút đã đăng ký và số phút của các phiên hoàn thành (phiên đã kết thúc). */
  plannedMin: number;
  doneMin: number;
  /** doneMin / plannedMin. */
  timeRate: number | null;
  currentStreak: number;
  bestStreak: number;
  createdAt: number;
  lastAt: number | null;
}
export interface AdminReport {
  generatedAt: number;
  /** Số ngày gần nhất được tính, null là từ đầu đến nay. */
  days: number | null;
  rows: AdminReportRow[];
  totals: { players: number; groups: number; registered: number; done: number; failed: number; active: number; completionRate: number | null; quitRate: number | null };
}

/** Kỳ tính điểm của bảng xếp hạng. */
export type RankRange = 'week' | 'all';
export interface RankGroup {
  id: string;
  name: string;
  rank: number;
  members: number;
  /** Số thành viên có điểm trong kỳ. */
  contributors: number;
  points: number;
  minutes: number;
  sessions: number;
  /** Điểm trung bình mỗi thành viên (để so các nhóm khác quy mô). */
  perMember: number;
}
export interface RankContribution {
  playerId: string;
  name: string;
  points: number;
  minutes: number;
  sessions: number;
  /** Phần trăm đóng góp vào điểm của nhóm (0–100), null khi nhóm chưa có điểm. */
  share: number | null;
}
export interface Ranking {
  range: RankRange;
  generatedAt: number;
  groups: RankGroup[];
  /** Nhóm của người xem (null khi chưa ở nhóm nào) và phần đóng góp của từng thành viên trong nhóm đó. */
  myGroupId: string | null;
  contributions: RankContribution[];
}
