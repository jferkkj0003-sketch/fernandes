import React from 'react';
import { Truck } from 'lucide-react';

// Nome e legenda da marca: troque aqui para mudar em todas as telas.
export const BRAND_NAME = 'FRETES';
export const BRAND_TAGLINE = 'TICKET · FECHAMENTO · PAGAMENTO';

export function BrandMark({ size = 46 }) {
  return <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true"><Truck size={Math.round(size * 0.5)} strokeWidth={2.2} /></span>;
}

export default function Brand({ className = '', stacked = false }) {
  return <div className={`brand-lockup ${stacked ? 'stacked' : ''} ${className}`} role="img" aria-label={`${BRAND_NAME} — gestão de frete`}>
    <BrandMark />
    <span className="brand-text"><b>{BRAND_NAME}</b><small>{BRAND_TAGLINE}</small></span>
  </div>;
}
