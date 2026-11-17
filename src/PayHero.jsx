import React from 'react';

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

// Cartão principal: valor a pagar + barra dividida por situação (Solicitado, Fechado, Prévia, Em aberto).
export default function PayHero({ label, total, sub, paid = 0, parts }) {
  return <section className="cx-hero" aria-label="Total a pagar">
    <div className="cx-hero-main">
      <span className="cx-lab">{label}</span>
      <strong className="cx-total">{money(total)}</strong>
      <span className="cx-sub">{sub}</span>
      {paid > 0 && <span className="cx-paid">Já pago em ciclos anteriores: <b>{money(paid)}</b></span>}
    </div>
    <div>
      <div className="cx-split" role="img" aria-label="Divisão do valor por situação">{parts.map((part) => <div key={part.name} style={{ flex: Math.max(part.value, 0), background: part.color }} />)}</div>
      <ul className="cx-parts">{parts.map((part) => <li key={part.name}><span className="cx-dot" style={{ background: part.color }} /><span className="cx-pname">{part.name}</span><small>{part.note}</small><b>{money(part.value)}</b></li>)}</ul>
    </div>
  </section>;
}
