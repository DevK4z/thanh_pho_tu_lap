import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LIMITS } from '@tptl/shared';
import { Icon } from '../components/Icons';
import { Banner, Button, Card, Eyebrow, Field, inputCls, Muted, useToast } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useConfig, useSignIn } from '../lib/queries';
import { facebookLogin, renderGoogleButton } from '../lib/social';

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
    <Card as="section" className="mx-auto mt-3 max-w-[460px]">
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
  );
}
