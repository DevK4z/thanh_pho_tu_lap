/* Ngân hàng câu hỏi. Đáp án chỉ nằm ở máy chủ; trình duyệt nhận câu hỏi đã xáo phương án và không kèm đáp án. */
import type { ActKey, ActiveSession, IssuedQuestion } from '@tptl/shared';
import type { SessionQuestions, StoredQuestion } from './db/schema';

export interface BankQuestion { id: string; act: ActKey | 'all'; q: string; o: string[]; a: number }

export const DEFAULT_QUESTIONS: BankQuestion[] = [
  { id: 'a1', act: 'all', q: 'Tự kỷ luật khác với bị ép buộc ở điểm nào?', o: ['Tự đặt mục tiêu và chọn cách thực hiện', 'Làm theo mọi yêu cầu của người khác', 'Không bao giờ nghỉ', 'Chỉ làm khi có hứng'], a: 0 },
  { id: 'a2', act: 'all', q: 'Điều nào giúp giữ cam kết lâu dài tốt nhất?', o: ['Đặt mục tiêu vừa sức và làm đều mỗi ngày', 'Làm thật nhiều trong một ngày rồi nghỉ cả tuần', 'Chờ có cảm hứng', 'Đặt mục tiêu càng khó càng tốt'], a: 0 },
  { id: 'r1', act: 'read', q: 'Kỹ thuật nào giúp nhớ lâu hơn sau khi đọc một chương sách?', o: ['Đọc lại ngay nhiều lần', 'Gấp sách và tự nhắc lại ý chính bằng lời của mình', 'Gạch chân thật nhiều', 'Đọc nhanh hơn'], a: 1 },
  { id: 'r2', act: 'read', q: 'Trước khi đọc sâu, việc nào nên làm?', o: ['Mở thông báo để không lỡ tin', 'Xác định hôm nay đọc đến đâu và cần rút ra điều gì', 'Vừa đọc vừa nghe nhạc có lời', 'Đọc khi đang buồn ngủ'], a: 1 },
  { id: 'r3', act: 'read', q: 'Sau một phiên đọc, cách ghi chú hiệu quả là', o: ['Chép nguyên văn cả trang', 'Viết 2–3 câu tóm tắt bằng lời của mình', 'Không ghi gì', 'Chụp ảnh các trang'], a: 1 },
  { id: 'd1', act: 'deep', q: 'Một phiên Pomodoro truyền thống tập trung khoảng bao lâu?', o: ['5 phút', '25 phút', '90 phút', '3 giờ'], a: 1 },
  { id: 'd2', act: 'deep', q: 'Điều gì làm giảm tập trung sâu nhiều nhất?', o: ['Đặt điện thoại ở xa', 'Chuyển qua lại giữa nhiều tab và tin nhắn', 'Ghi mục tiêu cho phiên học', 'Ngồi nơi yên tĩnh'], a: 1 },
  { id: 'd3', act: 'deep', q: 'Trước phiên học sâu nên chuẩn bị gì?', o: ['Mở mạng xã hội để thư giãn', 'Xác định một nhiệm vụ cụ thể', 'Làm ba việc cùng lúc', 'Bật mọi thông báo'], a: 1 },
  { id: 'w1', act: 'write', q: 'Viết tự do vài phút mỗi ngày giúp ích điều gì?', o: ['Làm rõ suy nghĩ và cảm xúc', 'Làm tăng chiều cao', 'Thay thế giấc ngủ', 'Không có tác dụng'], a: 0 },
  { id: 'w2', act: 'write', q: 'Câu nào hợp để mở đầu một đoạn viết sau phiên tập trung?', o: ['Hôm nay mình đã làm trọn việc nào và vì sao?', 'Ai đang trực tuyến?', 'Có tin gì mới trên mạng xã hội?', 'Khi nào hết giờ?'], a: 0 },
  { id: 'm1', act: 'move', q: 'Phần nào của buổi tập giúp giảm nguy cơ chấn thương?', o: ['Bỏ qua khởi động', 'Khởi động kỹ trước khi tập', 'Tập thật mạnh ngay từ phút đầu', 'Nhịn uống nước'], a: 1 },
  { id: 'm2', act: 'move', q: 'Sau khi tập nên làm gì?', o: ['Dừng đột ngột và nằm xuống', 'Thả lỏng, giãn cơ nhẹ và bù nước', 'Tắm nước lạnh ngay khi đang rất nóng', 'Ăn thật nhiều đồ ngọt'], a: 1 },
  { id: 'm3', act: 'move', q: 'Dấu hiệu nào cho thấy nên dừng tập ngay?', o: ['Hơi mệt và toát mồ hôi', 'Chóng mặt, đau tức ngực', 'Khát nước nhẹ', 'Tim đập nhanh hơn lúc nghỉ'], a: 1 },
  { id: 'p1', act: 'plant', q: 'Thời điểm tưới cây phù hợp trong ngày là', o: ['Giữa trưa nắng gắt', 'Sáng sớm hoặc chiều mát', 'Lúc nửa đêm', 'Giờ nào cũng như nhau'], a: 1 },
  { id: 'p2', act: 'plant', q: 'Dấu hiệu cây bị tưới quá nhiều nước là', o: ['Lá vàng, đất úng nước', 'Lá xanh bóng', 'Cây ra hoa', 'Đất tơi xốp'], a: 0 },
  { id: 'p3', act: 'plant', q: 'Vì sao chậu cây cần lỗ thoát nước?', o: ['Cho đẹp hơn', 'Tránh úng rễ', 'Tiết kiệm đất', 'Để cây mọc nhanh gấp đôi'], a: 1 },
];

function shuffle<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Chọn n câu cho hoạt động, hạn chế lặp trong cùng phiên, xáo thứ tự phương án. */
export function issueQuestions(bank: BankQuestion[], act: ActKey, n: number, used: Set<string>, rnd: () => number = Math.random): StoredQuestion[] {
  const all = bank.filter((q) => q.act === 'all' || q.act === act);
  const out: StoredQuestion[] = [];
  for (let k = 0; k < n && all.length; k++) {
    let pool = all.filter((q) => !used.has(q.id));
    if (!pool.length) { used.clear(); pool = all; }
    const q = pool[Math.floor(rnd() * pool.length)];
    used.add(q.id);
    const idx = shuffle(q.o.map((_, i) => i), rnd);
    out.push({ id: q.id, q: q.q, o: idx.map((i) => q.o[i]), a: idx.indexOf(q.a) });
  }
  return out;
}

const strip = (q: StoredQuestion): IssuedQuestion => ({ id: q.id, q: q.q, o: q.o });

export function publicSession(s: {
  id: string; act: ActKey; mode: ActiveSession['mode']; plannedSec: number; startedAt: Date; goal: string; day: string; questions: SessionQuestions;
}): ActiveSession {
  const answered = s.questions.checks.filter((c) => c.ans !== undefined);
  return {
    id: s.id, act: s.act, mode: s.mode, plannedSec: s.plannedSec, startedAt: s.startedAt.getTime(), goal: s.goal, day: s.day,
    checks: s.questions.checks.map(strip),
    checksAnswered: answered.length,
    checksCorrect: answered.filter((c) => c.ans === c.a).length,
    verify: s.questions.verify.map(strip),
  };
}
