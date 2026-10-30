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
}

export interface Player {
  id: string;
  userId: string;
  name: string;
  style: HouseStyle;
  dailyGoal: number;
  totalFocusMin: number;
  plot: PlotItem[];
  pending: PendingReward[];
  quitReasons: Partial<Record<QuitReason, number>>;
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
}

export interface GroupDetail {
  group: GroupInfo;
  isOwner: boolean;
  players: Player[];
  /** id người chơi của tài khoản hiện tại trong nhóm, null nếu chưa tạo nhà. */
  meId: string | null;
  active: ActiveSession | null;
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
}

export interface GroupQuestion { id: string; act: ActKey | 'all'; q: string; o: string[]; a: number }

export interface PublicConfig { google: string | null; facebook: string | null }

export interface ApiErrorBody { error: { code: string; message: string } }
