import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ResponsiveTable from '../src/ResponsiveTable.js';

const h = React.createElement;
const renderTable = (headers, cells) => renderToStaticMarkup(h(ResponsiveTable, null,
  h('thead', null, h('tr', null, headers)), h('tbody', null, h('tr', null, cells)),
));

test('closure cards use their own labels instead of ticket labels', () => {
  const html = renderTable(['ID', 'MOTORISTA', 'PERÍODO', 'TICKETS', 'TOTAL', 'STATUS', 'AÇÕES'].map(label => h('th', { key: label }, label)),
    ['035', 'Motorista exemplo', '01/10 a 20/10', '2', 'R$ 2.000,00', 'Solicitado', h('button', { key: 'remove' }, 'Remover do fechamento')].map((value, i) => h('td', { key: i }, value)));
  assert.match(html, /data-label="ID">035/);
  assert.match(html, /data-label="MOTORISTA" data-card-wide="true">Motorista exemplo/);
  assert.match(html, /data-label="PERÍODO" data-card-wide="true">01\/10 a 20\/10/);
  assert.match(html, /data-label="AÇÕES" data-card-wide="true"><button>Remover do fechamento/);
  assert.doesNotMatch(html, /data-label="DATA"|data-label="PLACA"|data-label="PESO"/);
});

test('conditional columns keep amount, status and actions aligned', () => {
  for (const compact of [false, true]) {
    const headers = ['DATA', 'TICKET', 'MOTORISTA', 'PLACA', !compact && 'PESO', 'LÍQUIDO', 'STATUS', !compact && ''].map((label, i) => label === false ? false : h('th', { key: i }, label));
    const cells = ['20/10/2026', '123', 'Exemplo', 'ABC1D23', !compact && '500 kg', 'R$ 1.000,00', 'Aberto', !compact && h('button', null, 'Ver')].map((value, i) => value === false ? false : h('td', { key: i }, value));
    const html = renderTable(headers, cells);
    assert.match(html, /data-label="LÍQUIDO">R\$ 1.000,00/);
    assert.match(html, /data-label="STATUS">Aberto/);
    assert.equal(html.includes('data-label="Ações"'), !compact);
  }
});

test('empty rows span the card without a misleading field label', () => {
  const html = renderTable([h('th', { key: 0 }, 'DATA'), h('th', { key: 1 }, 'TICKET')], [h('td', { key: 0, colSpan: 2 }, 'Nenhum ticket')]);
  assert.match(html, /colSpan="2" data-card-wide="true">Nenhum ticket/);
  assert.doesNotMatch(html, /data-label=/);
});
