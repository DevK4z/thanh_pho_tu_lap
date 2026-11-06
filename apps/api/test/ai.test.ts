/* Gọi SDK Gemini thật với fetch giả: kiểm tra yêu cầu gửi đi đúng định dạng và phản hồi được đọc đúng. */
import { ApiError } from '@google/genai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiOff, geminiAI } from '../src/ai';

function reply(body: object, status = 200) {
  const f = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', f);
  return f;
}
const text = (t: string, finishReason = 'STOP') => ({ candidates: [{ content: { role: 'model', parts: [{ text: t }] }, finishReason }] });
const ai = () => geminiAI('khoa-thu', 'gemini-3.5-flash-lite');
const photo = { act: 'read', goal: 'đọc chương 3', code: 'MAY-47', page: 23, imageBase64: 'QUJD' } as const;
const verdict = { code_match: true, page_match: true, activity_match: true, real_photo: true, reason: 'Ảnh khớp mã.' };

afterEach(() => { vi.unstubAllGlobals(); });

describe('Gemini', () => {
  it('gửi ảnh kèm yêu cầu JSON và đọc kết luận', async () => {
    const f = reply(text(JSON.stringify(verdict)));
    expect(await ai().checkPhoto(photo)).toEqual({ ok: true, reason: 'Ảnh khớp mã.' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('models/gemini-3.5-flash-lite:generateContent');
    expect(new Headers(init.headers).get('x-goog-api-key')).toBe('khoa-thu');
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } });
    expect(body.contents[0].parts[1].text).toContain('MAY-47');
    expect(body.contents[0].parts[1].text).toContain('trang 23');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseJsonSchema.required).toContain('code_match');
    expect(body.systemInstruction.parts[0].text).toContain('<hs>');
  });

  it('chỉ một tiêu chí sai là ảnh không đạt', async () => {
    reply(text(JSON.stringify({ ...verdict, real_photo: false, reason: 'Ảnh chụp màn hình.' })));
    expect(await ai().checkPhoto(photo)).toEqual({ ok: false, reason: 'Ảnh chụp màn hình.' });
  });

  it('chấm nhớ lại: giới hạn điểm trong 0–100', async () => {
    reply(text(JSON.stringify({ score: 140, verdict: 'khop', reason: 'ok' })));
    const r = await ai().judgeRecall({ act: 'read', day: '2026-11-05', goal: '', note: '', question: 'Hỏi?', answer: 'Đáp' });
    expect(r.score).toBe(100);
  });

  it('bị chặn hoặc trả sai cấu trúc thì báo lỗi, không tự cho đạt', async () => {
    reply({ candidates: [{ finishReason: 'SAFETY' }] });
    await expect(ai().checkPhoto(photo)).rejects.toThrow('SAFETY');
    reply(text('{"code_match":true}'));
    await expect(ai().checkPhoto(photo)).rejects.toThrow();
  });

  it('phân biệt khóa sai với quá hạn mức', () => {
    expect(aiOff(new ApiError({ status: 400, message: 'API key not valid. Please pass a valid API key.' }))).toBe(true);
    expect(aiOff(new ApiError({ status: 403, message: 'Permission denied' }))).toBe(true);
    expect(aiOff(new ApiError({ status: 429, message: 'Quota exceeded' }))).toBe(false);
    expect(aiOff(new ApiError({ status: 400, message: 'Invalid image' }))).toBe(false);
    expect(aiOff(new Error('mạng lỗi'))).toBe(false);
  });
});
