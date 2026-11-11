/* Thẻ ảnh bằng chứng và câu hỏi nhớ lại, với API giả. Luồng đầy đủ ở phía máy chủ nằm trong apps/api/test/evidence.test.ts. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSession, ProofState, RecallDue } from '@tptl/shared';
import { ToastProvider } from '../src/components/ui';
import { ProofCard } from '../src/screens/ProofCard';
import { ResultCard } from '../src/screens/ResultCard';
import type { ResultState } from '@tptl/shared';
import { RecallCard } from '../src/screens/RecallCard';

const api = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api }));

const noResult: ResultState = { status: 'none', score: null, reason: '', tries: 0, text: '', hasImage: false };
const noProof: ProofState = { status: 'none', code: null, page: null, expiresAt: null, tries: 0, reason: '' };
const session = (over: Partial<ActiveSession> = {}): ActiveSession => ({
  id: 's1', act: 'read', mode: 'offline', plannedSec: 600, startedAt: 0, goal: '', day: '2026-11-06',
  checks: [], checksAnswered: 0, checksCorrect: 0, verify: [], proof: noProof, result: noResult, ...over,
});

function Proof({ s }: { s: ActiveSession }) {
  const [proof, setProof] = useState(s.proof);
  return <ToastProvider><ProofCard s={{ ...s, proof }} onChange={setProof} /></ToastProvider>;
}
const btn = (name: string | RegExp) => screen.getByRole('button', { name });

beforeEach(() => { api.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('ProofCard', () => {
  it('đọc sách: hỏi số trang, hiện mã và trang, đếm ngược, gửi ảnh đã nén rồi báo đã xác minh', async () => {
    const ready: ProofState = { ...noProof, status: 'ready', code: 'MAY-47', page: 23, expiresAt: Date.now() + 120_000 };
    api.mockResolvedValueOnce(ready).mockResolvedValueOnce({ ...ready, status: 'ok', tries: 1, reason: 'Ảnh khớp mã.' });
    render(<Proof s={session()} />);
    fireEvent.change(screen.getByLabelText('Sách của bạn dày khoảng bao nhiêu trang?'), { target: { value: '60' } });
    fireEvent.click(btn('Lấy mã thử thách'));
    await screen.findByText('MAY-47');
    expect(api).toHaveBeenCalledWith('POST', '/sessions/s1/proof/code', { pages: 60 });
    expect(screen.getByText('trang 23')).toBeTruthy();
    expect(screen.getByText(/Còn 0[12]:\d\d để chụp/)).toBeTruthy();

    vi.stubGlobal('createImageBitmap', async () => ({ width: 4000, height: 3000, close() {} }));
    const size = { w: 0 };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) { size.w = this.width; return { drawImage() {} } as never; });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,QUJD');
    fireEvent.change(screen.getByLabelText('Chụp ảnh bằng chứng'), { target: { files: [new File(['x'], 'a.heic')] } });
    await screen.findByText('Ảnh khớp mã.');
    expect(size.w).toBe(1280);
    expect(api).toHaveBeenLastCalledWith('POST', '/sessions/s1/proof', { image: 'QUJD' });
    expect(screen.getByText('Đã xác minh')).toBeTruthy();
    expect(screen.queryByText(/không có điểm nhóm/)).toBeNull();
  });

  it('ảnh chưa khớp hiện lý do và số lượt; hết lượt thì không chụp được nữa', () => {
    const fail: ProofState = { ...noProof, status: 'fail', code: 'SAO-12', expiresAt: Date.now() + 60_000, tries: 3, reason: 'Không thấy mã.' };
    render(<Proof s={session({ act: 'move', proof: fail })} />);
    expect(screen.getByText(/Chưa khớp: Không thấy mã\. Đã hết lượt thử\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chụp ảnh bằng chứng' })).toBeNull();
  });

  it('mã hết hạn thì khóa nút chụp, vẫn lấy được mã mới; chưa bật AI thì báo rõ', () => {
    const old: ProofState = { ...noProof, status: 'ready', code: 'SAO-12', expiresAt: Date.now() - 1000 };
    const { unmount } = render(<Proof s={session({ act: 'read', proof: old })} />);
    expect(btn('Chụp ảnh bằng chứng')).toHaveProperty('disabled', true);
    expect(btn('Lấy mã mới')).toHaveProperty('disabled', false);
    unmount();
    render(<Proof s={session({ proof: { ...noProof, status: 'na' } })} />);
    expect(screen.getByText(/chưa bật kiểm tra ảnh tự động/)).toBeTruthy();
  });

  it('vận động, chăm cây: hết giờ là mã xác thực tự hiện, không cần bấm, không cho đổi mã tùy ý', async () => {
    const ready: ProofState = { ...noProof, status: 'ready', code: 'GIO-35', expiresAt: Date.now() + 180_000 };
    api.mockResolvedValueOnce(ready);
    render(<Proof s={session({ act: 'plant' })} />);
    await screen.findByText('GIO-35');
    expect(api).toHaveBeenCalledWith('POST', '/sessions/s1/proof/code', {});
    expect(screen.queryByRole('button', { name: 'Lấy mã thử thách' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lấy mã mới' })).toBeNull();
    expect(screen.getAllByText(/mã xác thực/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Còn 0[23]:\d\d để chụp/)).toBeTruthy();
  });

  it('vận động: quá 3 phút sau khi kết thúc thì báo rõ không lấy được mã', async () => {
    const { ApiError } = await import('../src/lib/api');
    api.mockRejectedValueOnce(new ApiError(409, 'proof_window_closed', 'Đã quá 3 phút sau khi kết thúc nên không lấy được mã nữa.'));
    render(<Proof s={session({ act: 'move' })} />);
    await screen.findByText(/Đã quá 3 phút sau khi kết thúc/);
  });

  it('phiên trên máy: ảnh không bắt buộc và không hỏi số trang', () => {
    render(<Proof s={session({ act: 'deep', mode: 'screen' })} />);
    expect(screen.getByText('Bằng chứng ảnh (không bắt buộc)')).toBeTruthy();
    expect(screen.queryByLabelText(/bao nhiêu trang/)).toBeNull();
  });
});

describe('RecallCard', () => {
  const recall: RecallDue = { sid: 's1', day: '2026-11-05', act: 'read', question: null };
  const mount = (onDone = vi.fn()) => { render(<ToastProvider><RecallCard recall={recall} onDone={onDone} /></ToastProvider>); return onDone; };

  it('nhận câu hỏi, phải viết đủ từ mới gửi được, gửi xong báo kết quả', async () => {
    api.mockResolvedValueOnce({ question: 'Bạn dừng ở chương nào?' }).mockResolvedValueOnce({ score: 80, verdict: 'khop', reason: 'ok' });
    const onDone = mount();
    expect(screen.getByText('Phiên đọc sách giấy ngày 05/11')).toBeTruthy();
    fireEvent.click(btn('Nhận câu hỏi'));
    await screen.findByText('Bạn dừng ở chương nào?');
    const send = btn('Gửi câu trả lời');
    expect(send).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Câu trả lời của bạn'), { target: { value: 'mình dừng ở chương ba' } });
    expect(send).toHaveProperty('disabled', false);
    fireEvent.click(send);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api).toHaveBeenLastCalledWith('POST', '/sessions/s1/recall/answer', expect.objectContaining({ answer: 'mình dừng ở chương ba', skip: false }));
  });

  it('“Tôi không nhớ” gửi được ngay', async () => {
    api.mockResolvedValueOnce({ question: 'Bạn dừng ở chương nào?' }).mockResolvedValueOnce({ score: 0, verdict: 'khong_nho', reason: '' });
    const onDone = mount();
    fireEvent.click(btn('Nhận câu hỏi'));
    await screen.findByText('Bạn dừng ở chương nào?');
    fireEvent.click(btn('Tôi không nhớ'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api).toHaveBeenLastCalledWith('POST', '/sessions/s1/recall/answer', expect.objectContaining({ answer: '', skip: true }));
  });
});

describe('ResultCard', () => {
  function Result({ s }: { s: ActiveSession }) {
    const [result, setResult] = useState(s.result);
    return <ToastProvider><ResultCard s={{ ...s, result }} onChange={setResult} /></ToastProvider>;
  }
  const screenSession = (over: Partial<ActiveSession> = {}) => session({ act: 'write', mode: 'screen', goal: 'viết bài luận về tình bạn', plannedSec: 2700, ...over });

  it('hiện mục tiêu; chưa có gì thì không nộp được; dán ảnh chụp màn hình bằng Ctrl+V rồi nộp', async () => {
    api.mockResolvedValueOnce({ ...noResult, status: 'ok', score: 82, reason: 'Khớp mục tiêu.', tries: 1, hasImage: true });
    vi.stubGlobal('createImageBitmap', async () => ({ width: 800, height: 600, close() {} }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage() {} } as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,QUJD');
    render(<Result s={screenSession()} />);
    expect(screen.getByText('viết bài luận về tình bạn')).toBeTruthy();
    expect(screen.getByText(/45 phút cam kết/)).toBeTruthy();
    expect(btn('Nộp kết quả')).toHaveProperty('disabled', true);
    const file = new File(['x'], 'screenshot.png', { type: 'image/png' });
    fireEvent.paste(screen.getByText('Nộp kết quả của phiên'), { clipboardData: { items: [{ type: 'image/png', getAsFile: () => file }] } });
    await screen.findByAltText('Ảnh kết quả sẽ nộp');
    fireEvent.click(btn('Nộp kết quả'));
    await screen.findByText(/Khớp mục tiêu\./);
    expect(api).toHaveBeenCalledWith('POST', '/sessions/s1/result', { text: '', image: 'QUJD' });
    expect(screen.getByText('Đạt')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Nộp/ })).toBeNull();
  });

  it('kết quả đáng ngờ: hiện lý do và điểm, cho bổ sung rồi nộp lại; hết lượt thì không nộp nữa', async () => {
    const flag: ResultState = { ...noResult, status: 'flag', score: 15, reason: 'Chỉ có 2 câu, chưa tương xứng với 45 phút.', tries: 1, text: 'Hai câu.' };
    const { unmount } = render(<Result s={screenSession({ result: flag })} />);
    expect(screen.getByText(/Chỉ có 2 câu, chưa tương xứng với 45 phút\. \(15\/100\) Bạn có thể bổ sung rồi nộp lại\./)).toBeTruthy();
    expect(screen.getByText('Đáng ngờ')).toBeTruthy();
    expect(btn('Nộp lại')).toHaveProperty('disabled', false);
    unmount();
    render(<Result s={screenSession({ result: { ...flag, tries: 3 } })} />);
    expect(screen.getByText(/Đã hết lượt nộp\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nộp lại' })).toBeNull();
  });
});
