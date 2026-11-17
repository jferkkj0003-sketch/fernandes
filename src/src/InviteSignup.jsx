import React, { useEffect, useState } from 'react';
import { Check, Moon, Sun } from 'lucide-react';
import { cloudConfigured, redeemOperatorInvite } from './lib/cloud';

export default function InviteSignup({ token }) {
  const [theme, setTheme] = useState(() => window.localStorage.getItem('dde-fretes-theme') !== 'light' ? 'dark' : 'light');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('dde-fretes-theme', theme);
  }, [theme]);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get('displayName') || '').trim();
    const username = String(form.get('username') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    const confirmation = String(form.get('confirmation') || '');
    setMessage('');
    if (password !== confirmation) { setMessage('As senhas não conferem.'); return; }
    setBusy(true);
    try {
      await redeemOperatorInvite({ token, displayName, username, password });
      setComplete(true);
    } catch (error) {
      setMessage(error.message || 'Não foi possível concluir o cadastro. Confira o convite e tente novamente.');
    } finally { setBusy(false); }
  }

  return <main className="login-stage invite-stage">
    <button className="icon-button theme-toggle invite-theme-toggle" type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
    <section className="login-card invite-card">
      <p className="eyebrow">CONVITE DE ACESSO</p>
      <img className="login-logo" src={theme === 'dark' ? '/logo-controle-de-fretes-dark.svg' : '/logo-controle-de-fretes.svg'} alt="Controle de Fretes" />
      {complete ? <>
        <div className="invite-success-icon"><Check size={20} /></div>
        <h1>Conta criada</h1>
        <p className="login-copy">Seu acesso de operador está pronto. Entre usando o usuário e a senha que acabou de criar.</p>
        <a className="button primary full invite-login-link" href={window.location.origin}>Ir para o login</a>
      </> : !cloudConfigured || !/^[a-f0-9]{64}$/i.test(token) ? <>
        <h1>Convite indisponível</h1>
        <p className="login-copy">Este convite não é válido. Peça ao administrador para gerar um novo link.</p>
      </> : <>
        <h1>Crie seu acesso</h1>
        <p className="login-copy">Preencha seus dados para acessar o Controle de Fretes como operador.</p>
        <form className="login-form invite-form" onSubmit={submit}>
          <label>Seu nome<input name="displayName" autoComplete="name" minLength="2" maxLength="80" required /></label>
          <label>Usuário<input name="username" autoComplete="username" minLength="3" maxLength="30" pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,29}" title="Use de 3 a 30 letras, números, ponto, hífen ou sublinhado." required /></label>
          <label>Senha<input name="password" type="password" autoComplete="new-password" minLength="8" maxLength="72" required /></label>
          <label>Confirme a senha<input name="confirmation" type="password" autoComplete="new-password" minLength="8" maxLength="72" required /></label>
          {message && <div className="auth-error" role="alert">{message}</div>}
          <button className="button primary full" type="submit" disabled={busy}>{busy ? 'Criando conta…' : 'Criar minha conta'}</button>
        </form>
      </>}
    </section>
    <p className="login-foot">Acesso de operador gerenciado pelo administrador</p>
  </main>;
}

