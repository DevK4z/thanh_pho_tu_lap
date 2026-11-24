import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LIMITS, type ItemId, type PlotItem } from '@tptl/shared';
import { Icon, type IconName } from '../components/Icons';
import { City } from '../components/Svg';
import type { CityOwner } from '../game/iso';
import { Banner, Button, Card, Eyebrow, Field, inputCls, Muted, useToast } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useConfig, useSignIn } from '../lib/queries';
import { facebookLogin, renderGoogleButton } from '../lib/social';

/** Thành phố mẫu làm hình minh họa ở màn đăng nhập. */
const DEMO_ITEMS: [number, ItemId, number, 0 | 1][] = [
  [0, 'cay', 1, 0], [1, 'thuvien', 3, 0], [2, 'hoa', 1, 0], [3, 'nhanho', 1, 0], [5, 'quan', 2, 0], [6, 'cay', 1, 0],
  [8, 'congvien', 3, 0], [10, 'thap', 4, 1], [12, 'vuon', 2, 0], [14, 'hoa', 1, 0], [16, 'chungcu', 3, 0], [18, 'san', 2, 0],
  [20, 'cay', 1, 0], [22, 'kinh', 4, 0], [24, 'nhanho', 1, 0], [26, 'truong', 4, 1], [28, 'cay', 1, 0], [30, 'vuon', 2, 0], [33, 'hoa', 1, 0],
];
const DEMO: CityOwner = { name: 'mẫu', style: 'ngoi', totalFocusMin: 600, plot: DEMO_ITEMS.map(([s, i, t, g]): PlotItem => ({ s, i, t, g })) };
const PERKS: [IconName, string, string][] = [
  ['timer', 'Tập trung sâu', 'Cam kết từng phiên, không xao nhãng'],
  ['build', 'Xây thành phố', 'Mỗi phiên hoàn thành là một công trình'],
  ['pop', 'Cùng nhóm', 'Giữ chuỗi và leo bảng xếp hạng'],
];

export function Login() {
  const toast = useToast();
  const cfg = useConfig();
  const signIn = useSignIn();
  const [name, setName] = useState('');
  const [fbBusy, setFbBusy] = useState(false);
  const gRef = useRef<HTMLDivElement>(null);
  const google = cfg.data?.google ?? null;
  const facebook = cfg.data?.facebook ?? null;

  const fail = (e: unknown) => toast(errorMessage(e));

  useEffect(() => {
    if (!google || !gRef.current) return;
    renderGoogleButton(gRef.current, google, (credential) => signIn.mutate({ kind: 'google', credential }, { onError: fail })).catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google]);

  async function fb() {
    if (!facebook) return;
    setFbBusy(true);
    try {
      const accessToken = await facebookLogin(facebook);
      if (accessToken) await signIn.mutateAsync({ kind: 'facebook', accessToken });
    } catch (e) { fail(e); }
    setFbBusy(false);
  }

  function guest(e: FormEvent) {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) { toast('Hãy nhập tên để vào với tư cách khách.'); return; }
    signIn.mutate({ kind: 'guest', name: n }, { onError: fail });
  }

  const busy = signIn.isPending || fbBusy;
  const off = (what: string) => <Muted small className="text-center">Máy chủ chưa bật đăng nhập {what}.</Muted>;

  return (
    <div className="mx-auto mt-3 grid w-full max-w-[1000px] items-center gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
    <div className="login-hero bg-(--sea1) max-md:hidden" aria-hidden="true">
      <div className="scene-wrap"><City owner={DEMO} className="contents" /></div>
      <ul className="absolute inset-x-3 bottom-3 z-10 grid grid-cols-3 gap-2">
        {PERKS.map(([ic, t, d], i) => (
          <li key={t} className="rise flex flex-col gap-1 rounded-xl border border-line bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] p-2.5 shadow-(--shadow-sm) backdrop-blur-sm" style={{ animationDelay: 150 + i * 90 + 'ms' }}>
            <Icon name={ic} className="size-7" />
            <b className="text-[13px] leading-tight">{t}</b>
            <span className="text-[12px] leading-snug text-muted">{d}</span>
          </li>
        ))}
      </ul>
    </div>
    <Card as="section" className="w-full max-md:mx-auto max-md:max-w-[460px]">
      <div aria-hidden="true" className="-mx-4 -mt-4 mb-1 h-28 overflow-hidden rounded-t-2xl bg-(--sea1) md:hidden [&_svg]:-mt-[18%] [&_svg]:block [&_svg]:w-full">
        <City owner={DEMO} className="contents" />
      </div>
      <div>
        <Eyebrow>Đăng nhập</Eyebrow>
        <h2>Vào thành phố của bạn</h2>
        <p className="mt-1.5 text-muted">Đăng nhập để lưu tiến độ, xây thành phố và cùng nhóm rèn kỷ luật mỗi ngày.</p>
      </div>
      {cfg.isError && <Banner tone="bad">{errorMessage(cfg.error)}</Banner>}

      <div className="flex flex-col gap-2.5">
        {google ? <div ref={gRef} className="flex min-h-11 justify-center" /> : (
          <>
            <Button block disabled><Icon name="google" className="size-5" />Tiếp tục với Google</Button>
            {cfg.isSuccess && off('Google')}
          </>
        )}
        <Button block disabled={!facebook || busy} onClick={fb}>
          <Icon name="facebook" className="size-5" />{fbBusy ? 'Đang mở Facebook…' : 'Tiếp tục với Facebook'}
        </Button>
        {cfg.isSuccess && !facebook && off('Facebook')}
      </div>

      <div className="flex items-center gap-2.5 text-[13px] text-muted before:flex-1 before:border-t before:border-line after:flex-1 after:border-t after:border-line">
        hoặc vào với tư cách khách
      </div>

      <form className="flex flex-col gap-3.5" onSubmit={guest}>
        <Field label="Tên của bạn">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.userName} placeholder="Tên hoặc biệt danh" autoComplete="nickname" />
        </Field>
        <div><Button type="submit" variant="primary" disabled={busy}>{signIn.isPending && signIn.variables?.kind === 'guest' ? 'Đang vào…' : 'Vào với tên này'}</Button></div>
      </form>
      <Muted small>Tài khoản khách gắn với trình duyệt này. Đăng xuất hoặc xóa dữ liệu trình duyệt sẽ mất tiến độ.</Muted>
      <Muted small>Khi đăng nhập, bạn đồng ý với <a className="underline" href="privacy.html" target="_blank" rel="noreferrer">chính sách quyền riêng tư</a>.</Muted>
    </Card>
    </div>
  );
}
