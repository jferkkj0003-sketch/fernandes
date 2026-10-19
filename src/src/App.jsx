import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowUpRight, BadgeDollarSign, Bell, Check, ChevronDown,
  CircleHelp, ClipboardList, CreditCard, Eye, LayoutDashboard, Menu, Plus, Pencil,
  Search, Settings2, Truck, Users, X, FileText, Trash2, LogOut, UserRound, Link2, Copy, Sun, Moon, RefreshCw,
} from 'lucide-react';
import {
  clearCloudTicketScanCache, cloudConfigured, createCloudClosure, createDashboardShare, createOperatorInvite, deleteCloudClosure, deleteCloudDriver, deleteCloudTicket, deleteOperatorAccount, downloadCloudTicketScan, emailForUsername, getCloudAppRole, getDashboardShareLink, getSession, listOperatorAccounts, loadCloudData, loadCloudTicketEditHistory, prefetchCloudTicketScans,
  onAuthChange, requestCloudClosure, saveCloudDriver, saveCloudTicket,
  revokeDashboardShare, setOperatorActive, signIn, signOut, subscribeCloudChanges, updateCloudAccount, updateCloudClosure, updateCloudTicket, verifyAdminPassword,
} from './lib/cloud';

const initialTickets = [
  { id: 'T-1464', dateISO: '2026-10-17', date: '17/10/2026', number: '1464', driver: 'Motorista 01', plate: 'QZV-2H16', weight: 150, gross: 150, discount: 0, note: '', status: 'Aberto' },
  { id: 'T-1234', dateISO: '2026-10-17', date: '17/10/2026', number: '123456', driver: 'Motorista 02', plate: 'PSD-5F01', weight: 5000, gross: 1000, discount: 0, note: '', status: 'Aberto' },
  { id: 'T-1919', dateISO: '2026-10-14', date: '14/10/2026', number: '19197', driver: 'Motorista 03', plate: 'NJS-0B09', weight: 5030, gross: 1000, discount: 0, note: '', status: 'Aberto' },
];
const initialDrivers = [
  { name: 'Motorista 01', plate: 'QZV-2H16', cpf: '', pix: '', bank: '', accountType: '', branch: '', account: '' },
  { name: 'Motorista 02', plate: 'PSD-5F01', cpf: '', pix: '', bank: '', accountType: '', branch: '', account: '' },
  { name: 'Motorista 03', plate: 'NJS-0B09', cpf: '', pix: '', bank: '', accountType: '', branch: '', account: '' },
];

const navItems = [
  { id: 'painel', label: 'Início', icon: LayoutDashboard },
  { id: 'tickets', label: 'Tickets', icon: ClipboardList },
  { id: 'fechamentos', label: 'Fechamentos', icon: BadgeDollarSign },
  { id: 'solicitacoes', label: 'Solicitações', icon: CreditCard },
  { id: 'motoristas', label: 'Motoristas', icon: Truck },
];

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const localDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const formatDate = (value) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};
const driverPaymentDetails = (name, tickets, profile = {}) => ({
  fullName: profile.name || name,
  cpf: profile.cpf || 'Não cadastrado',
  plate: profile.plate || tickets[0]?.plate || 'Não cadastrado',
  pix: profile.pix || 'Não cadastrado',
  bank: profile.bank || 'Não cadastrado',
  accountType: profile.accountType || 'Não cadastrado',
  branch: profile.branch || 'Não cadastrado',
  account: profile.account || 'Não cadastrado',
});
function pdfHex(value) {
  const special = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };
  return Array.from(String(value ?? '—')).map((char) => {
    const point = char.codePointAt(0);
    const byte = special[char] ?? (point >= 32 && point <= 255 ? point : 63);
    return byte.toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}

function buildClosureReportPdf(closure) {
  const driver = closure.driverDetails || driverPaymentDetails(closure.driver, closure.ticketDetails || []);
  const tickets = closure.ticketDetails || [];
  const pageCommands = [];
  let commands = [];
  let y = 0;
  const text = (value, x, top, size = 10, bold = false) => commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${top} Tm <${pdfHex(value)}> Tj ET`);
  const line = (x1, y1, x2, y2) => commands.push(`0.78 G 0.6 w ${x1} ${y1} m ${x2} ${y2} l S 0 G`);
  const wrap = (value, max = 82) => {
    const words = String(value || '—').split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > max && current) { lines.push(current); current = word; }
      else current = next;
    }
    if (current) lines.push(current);
    return lines;
  };
  const newPage = () => {
    if (commands.length) pageCommands.push(commands.join('\n'));
    commands = [];
    y = 790;
    text('FECHAMENTO DE FRETE', 230, y, 16, true); y -= 20;
    text('Controle de Fretes', 230, y, 9); text(`Fechamento ${closure.number || '001'}`, 430, y, 10, true); y -= 12;
    y -= 18;
    text(`Motorista: ${driver.fullName || closure.driver}`, 40, y, 10, true);
    text(`Período: ${formatDate(closure.start)} a ${formatDate(closure.end)}`, 330, y, 9); y -= 12;
    line(40, y, 555, y); y -= 22;
  };
  const ensureSpace = (height) => { if (y - height < 58) newPage(); };
  newPage();
  text('DADOS DO MOTORISTA E PAGAMENTO', 40, y, 11, true); y -= 18;
  const driverFields = [
    ['CPF', driver.cpf], ['Placa', driver.plate], ['Chave PIX', driver.pix], ['Banco', driver.bank],
    ['Tipo de conta', driver.accountType], ['Agência', driver.branch], ['Conta', driver.account],
  ];
  text(`Nome completo: ${driver.fullName || closure.driver}`, 40, y, 9); y -= 15;
  for (let i = 0; i < driverFields.length; i += 2) {
    const [labelA, valueA] = driverFields[i];
    text(`${labelA}: ${valueA || 'Não cadastrado'}`, 40, y, 9);
    if (driverFields[i + 1]) {
      const [labelB, valueB] = driverFields[i + 1];
      text(`${labelB}: ${valueB || 'Não cadastrado'}`, 300, y, 9);
    }
    y -= 15;
  }
  y -= 6;
  text(`TICKETS DO FECHAMENTO (${closure.count ?? tickets.length})`, 40, y, 11, true); y -= 17;
  text('DATA', 40, y, 8, true); text('Nº TICKET', 97, y, 8, true); text('PESO', 166, y, 8, true); text('BRUTO', 235, y, 8, true); text('DESCONTO', 302, y, 8, true); text('LÍQUIDO', 390, y, 8, true); y -= 7;
  line(40, y, 555, y); y -= 15;
  tickets.forEach((ticket) => {
    const noteLines = wrap(`Observação: ${ticket.note || '—'}`, 90);
    ensureSpace(28 + noteLines.length * 11);
    text(ticket.date, 40, y, 8); text(ticket.number, 97, y, 8); text(`${Number(ticket.weight || 0).toLocaleString('pt-BR')} kg`, 166, y, 8);
    text(money(ticket.gross), 235, y, 8); text(money(ticket.discount), 302, y, 8); text(money(ticket.gross - ticket.discount), 390, y, 8, true);
    y -= 13;
    noteLines.forEach((noteLine) => { text(noteLine, 50, y, 8); y -= 10; });
    line(40, y + 4, 555, y + 4); y -= 7;
  });
  ensureSpace(42);
  y -= 3;
  text(`TOTAL LÍQUIDO: ${money(closure.total)}`, 365, y, 13, true); y -= 28;
  text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} · Fechamento ${closure.number || '001'}`, 40, y, 8);
  pageCommands.push(commands.join('\n'));

  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  const kids = pageCommands.map((_, index) => `${5 + index * 2} 0 R`).join(' ');
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCommands.length} >>`;
  pageCommands.forEach((content, index) => {
    const pageObject = 5 + index * 2;
    const streamObject = pageObject + 1;
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamObject} 0 R >>`;
    objects[streamObject] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  let pdf = '%PDF-1.4\n% FreteEmDia\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([new TextEncoder().encode(pdf)], { type: 'application/pdf' });
}

async function buildClosurePdf(closure) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const report = await PDFDocument.load(await buildClosureReportPdf(closure).arrayBuffer());
  const logoResponse = await fetch('/racao-confianca-logo.svg');
  if (logoResponse.ok) {
    const logoUrl = URL.createObjectURL(await logoResponse.blob());
    try {
      const logoImage = new Image();
      logoImage.src = logoUrl;
      await logoImage.decode();
      const logoCanvas = document.createElement('canvas');
      logoCanvas.width = 1770;
      logoCanvas.height = 603;
      logoCanvas.getContext('2d').drawImage(logoImage, 0, 0, logoCanvas.width, logoCanvas.height);
      const logoPng = await new Promise((resolve, reject) => {
        logoCanvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a logo.')), 'image/png');
      });
      const companyLogo = await report.embedPng(await logoPng.arrayBuffer());
      report.getPages().forEach((page) => page.drawImage(companyLogo, { x: 40, y: 765, width: 150, height: 51.2 }));
    } finally {
      URL.revokeObjectURL(logoUrl);
    }
  }
  const font = await report.embedFont(StandardFonts.HelveticaBold);
  const ticketDetails = closure.ticketDetails || [];
  for (const ticket of ticketDetails) {
    if (!ticket.scanPath) continue;
    const scanBlob = await downloadCloudTicketScan(ticket.scanPath);
    if (!scanBlob) continue;
    const bytes = await scanBlob.arrayBuffer();
    if (ticket.scanType === 'application/pdf' || ticket.scanName?.toLowerCase().endsWith('.pdf')) {
      const scannedPdf = await PDFDocument.load(bytes);
      const scannedPages = await report.copyPages(scannedPdf, scannedPdf.getPageIndices());
      const embeddedPages = await report.embedPages(scannedPages);
      for (const scannedPage of embeddedPages) {
        const page = report.addPage([595.28, 841.89]);
        const scale = Math.min(535 / scannedPage.width, 765 / scannedPage.height);
        const width = scannedPage.width * scale;
        const height = scannedPage.height * scale;
        page.drawText(`COMPROVANTE DO TICKET Nº ${ticket.number}`, { x: 30, y: 812, size: 11, font, color: rgb(0.12, 0.22, 0.34) });
        page.drawLine({ start: { x: 30, y: 802 }, end: { x: 565, y: 802 }, thickness: 0.8, color: rgb(0.82, 0.86, 0.9) });
        page.drawPage(scannedPage, { x: (595.28 - width) / 2, y: 20 + (765 - height) / 2, width, height });
      }
    } else {
      const image = ticket.scanType === 'image/png' ? await report.embedPng(bytes) : await report.embedJpg(bytes);
      const page = report.addPage([595.28, 841.89]);
      const imageSize = image.scaleToFit(535, 765);
      page.drawText(`COMPROVANTE DO TICKET Nº ${ticket.number}`, { x: 30, y: 812, size: 11, font, color: rgb(0.12, 0.22, 0.34) });
      page.drawLine({ start: { x: 30, y: 802 }, end: { x: 565, y: 802 }, thickness: 0.8, color: rgb(0.82, 0.86, 0.9) });
      page.drawImage(image, { x: (595.28 - imageSize.width) / 2, y: 20 + (765 - imageSize.height) / 2, ...imageSize });
    }
  }
  return new Blob([await report.save()], { type: 'application/pdf' });
}

function pdfFilename(closure) {
  const id = String(closure.number || '001').padStart(3, '0');
  const name = String(closure.driverDetails?.fullName || closure.driver || 'Motorista').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').trim();
  return `${id} - ${name || 'Motorista'}.pdf`;
}

function downloadClosurePdf(closure, setNotice, setCloudBusy) {
  const link = document.createElement('a');
  link.download = pdfFilename(closure);
  setNotice('Preparando o relatório e os comprovantes…');
  setCloudBusy(true);
  buildClosurePdf(closure).then((blob) => {
    const url = URL.createObjectURL(blob);
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    setNotice(`PDF do fechamento ${closure.number} pronto para baixar.`);
  }).catch((error) => setNotice(`Não foi possível montar o PDF: ${error.message || 'verifique os escaneamentos e tente novamente.'}`))
    .finally(() => { setCloudBusy(false); window.setTimeout(() => setNotice(''), 6000); });
}

function openClosurePdf(closure, setNotice, setCloudBusy) {
  const tab = window.open('about:blank', '_blank');
  if (!tab) {
    window.alert('O navegador bloqueou a nova aba do PDF. Permita pop-ups para este aplicativo e tente novamente.');
    return;
  }
  tab.document.title = `Fechamento ${closure.number} · Controle de Fretes`;
  tab.document.body.innerHTML = '<p style="font:16px Arial;padding:24px">Preparando o relatório e os comprovantes…</p>';
  setCloudBusy(true);
  buildClosurePdf(closure).then((blob) => {
    const url = URL.createObjectURL(blob);
    tab.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }).catch((error) => {
    tab.close();
    setNotice(`Não foi possível montar o PDF: ${error.message || 'verifique os escaneamentos e tente novamente.'}`);
  }).finally(() => { setCloudBusy(false); window.setTimeout(() => setNotice(''), 6000); });
}

export default function App() {
  const [page, setPage] = useState('painel');
  const [theme, setTheme] = useState(() => window.localStorage.getItem('dde-fretes-theme') === 'dark' ? 'dark' : 'light');
  const [tickets, setTickets] = useState(initialTickets);
  const [drivers, setDrivers] = useState(initialDrivers);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [closures, setClosures] = useState([]);
  const [closureSequence, setClosureSequence] = useState(1);
  const [notice, setNotice] = useState('');
  const [showLogin, setShowLogin] = useState(true);
  const [sessionUser, setSessionUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(!cloudConfigured);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [savingTicket, setSavingTicket] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [syncState, setSyncState] = useState(cloudConfigured ? 'connecting' : 'demo');
  const [cloudDataReady, setCloudDataReady] = useState(!cloudConfigured);
  const [scanPrefetchProgress, setScanPrefetchProgress] = useState(null);
  const [cloudLoadError, setCloudLoadError] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [viewingTicket, setViewingTicket] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [closureToDelete, setClosureToDelete] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordMessage, setDeletePasswordMessage] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [ticketDeletePassword, setTicketDeletePassword] = useState('');
  const [ticketDeleteMessage, setTicketDeleteMessage] = useState('');
  const [ticketDeleteBusy, setTicketDeleteBusy] = useState(false);
  const [closureToEdit, setClosureToEdit] = useState(null);
  const scanPrefetchSignature = useRef('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('dde-fretes-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!cloudConfigured) return undefined;
    let active = true;
    getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthMessage('Não foi possível confirmar o login. Tente entrar novamente.');
      const user = data?.session?.user || null;
      setSessionUser(user);
      setShowLogin(!user);
      setAuthReady(true);
    }).catch(() => {
      if (active) { setAuthReady(true); setAuthMessage('Não foi possível conectar à conta na nuvem.'); }
    });
    const { data: { subscription } } = onAuthChange((session) => {
      if (!active) return;
      const user = session?.user || null;
      setSessionUser(user);
      setShowLogin(!user);
      setAuthReady(true);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!cloudConfigured || !sessionUser) return undefined;
    let active = true;
    let refreshTimer;
    const refresh = async () => {
      try {
        const data = await loadCloudData();
        if (!active) return;
        setDrivers(data.drivers);
        setTickets(data.tickets);
        setClosures(data.closures);
        setClosureSequence(Math.max(0, ...data.closures.map((item) => Number(item.number) || 0)) + 1);
        setSyncState('online');
        setCloudDataReady(true);
        setCloudLoadError('');
        setCloudBusy(false);
      } catch (error) {
        if (!active) return;
        setSyncState('error');
        setCloudLoadError(error.message || 'Não foi possível ler o banco de dados.');
        setCloudBusy(false);
      }
    };
    setCloudBusy(true);
    setSyncState('connecting');
    refresh();
    const channel = subscribeCloudChanges(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refresh, 250);
    });
    return () => { active = false; window.clearTimeout(refreshTimer); channel.unsubscribe(); };
  }, [sessionUser]);

  useEffect(() => {
    if (!cloudConfigured || !sessionUser || !cloudDataReady) {
      if (!sessionUser) scanPrefetchSignature.current = '';
      return undefined;
    }
    const paths = [...tickets]
      .filter((ticket) => ticket.scanPath)
      .sort((a, b) => {
        const aCreated = Date.parse(a.createdAt || '') || 0;
        const bCreated = Date.parse(b.createdAt || '') || 0;
        return bCreated - aCreated || (b.dateISO || '').localeCompare(a.dateISO || '');
      })
      .slice(0, 5)
      .map((ticket) => ticket.scanPath);
    const signature = `${sessionUser.id}:${paths.join('|')}`;
    if (!paths.length || signature === scanPrefetchSignature.current) return undefined;
    scanPrefetchSignature.current = signature;
    let active = true;
    setScanPrefetchProgress({ done: 0, total: paths.length });
    prefetchCloudTicketScans(paths, (done, total) => {
      if (active) setScanPrefetchProgress({ done, total });
    }).finally(() => {
      if (active) window.setTimeout(() => setScanPrefetchProgress(null), 1200);
    });
    return () => { active = false; };
  }, [cloudDataReady, sessionUser, tickets]);

  useEffect(() => {
    let active = true;
    if (!cloudConfigured || !sessionUser) {
      setIsAdmin(!cloudConfigured);
      return () => { active = false; };
    }
    setIsAdmin(false);
    getCloudAppRole().then(async (role) => {
      if (!active) return;
      setIsAdmin(role === 'admin');
      if (!role) {
        await signOut();
        if (active) {
          setSessionUser(null);
          setShowLogin(true);
          setAuthMessage('Esta conta está desativada. Peça ao administrador para reativar seu acesso.');
          setCloudDataReady(true);
        }
      }
    }).catch(() => {
      if (active) setIsAdmin(false);
    });
    return () => { active = false; };
  }, [sessionUser]);

  const visibleTickets = useMemo(() => tickets.filter((ticket) => {
    const term = query.trim().toLowerCase();
    const matchesText = !term || [ticket.number, ticket.driver, ticket.plate].some((part) => part.toLowerCase().includes(term));
    const matchesFilter = filter === 'Todos' || ticket.status === filter;
    return matchesText && matchesFilter;
  }).sort((a, b) => {
    const priority = (ticket) => ticket.requestStatus === 'Solicitado' ? 2 : ticket.status === 'Aberto' ? 0 : 1;
    return priority(a) - priority(b) || (b.dateISO || '').localeCompare(a.dateISO || '');
  }), [tickets, query, filter]);

  const totals = useMemo(() => ({
    openCount: tickets.filter((ticket) => ticket.status === 'Aberto').length,
    openTotal: tickets.filter((ticket) => ticket.status === 'Aberto').reduce((sum, ticket) => sum + ticket.gross - ticket.discount, 0),
    awaitingRequestCount: closures.filter((closure) => closure.status === 'Aguardando envio').length,
    awaitingRequestTotal: closures.filter((closure) => closure.status === 'Aguardando envio').reduce((sum, closure) => sum + closure.total, 0),
    requestedCount: closures.filter((closure) => closure.status === 'Solicitado').length,
    requestedTotal: closures.filter((closure) => closure.status === 'Solicitado').reduce((sum, closure) => sum + closure.total, 0),
  }), [tickets, closures]);

  async function saveTicket(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const ticketNumber = String(form.get('number')).trim();
    const scanFile = ['scan', 'cameraScan'].map((name) => form.get(name)).find((file) => file instanceof File && file.size > 0) || null;
    if (!scanFile) {
      setNotice('Anexe o comprovante escaneado do ticket ou tire uma foto antes de registrar.');
      return;
    }
    if (scanFile && !(cloudConfigured && sessionUser)) {
      setNotice('Para guardar o escaneamento, entre no aplicativo conectado à nuvem.');
      return;
    }
    const duplicate = tickets.find((ticket) => ticket.number.trim().toLocaleLowerCase('pt-BR') === ticketNumber.toLocaleLowerCase('pt-BR'));
    if (duplicate) {
      setNotice(`O ticket ${ticketNumber} já está cadastrado para ${duplicate.driver}, em ${duplicate.date}. Confira o número antes de salvar.`);
      return;
    }
    const ticket = {
      id: `T-${Date.now()}`,
      dateISO: String(form.get('date') || localToday()),
      date: formatDate(String(form.get('date') || localToday())),
      number: ticketNumber,
      driver: form.get('driver'),
      plate: String(form.get('plate') || '—').toUpperCase(),
      weight: Number(form.get('weight')) || 0,
      gross: Number(form.get('gross')) || 0,
      discount: Number(form.get('discount')) || 0,
      note: String(form.get('note') || '').trim(),
      status: 'Aberto',
    };
    if (cloudConfigured && sessionUser) {
      const driverRecord = drivers.find((item) => item.name === ticket.driver);
      if (!driverRecord?.id) { setNotice('Cadastre o motorista na nuvem antes de lançar o ticket.'); return; }
      if (savingTicket) return;
      setCloudBusy(true);
      setSavingTicket(true);
      try {
        const savedTicket = await saveCloudTicket(ticket, driverRecord.id, scanFile);
        setTickets((current) => [savedTicket, ...current.filter((item) => item.id !== savedTicket.id)]);
        formElement.reset();
        setNotice(`Ticket ${ticket.number} e comprovante salvos na nuvem.`);
      } catch (error) {
        setNotice(error.code === '23505' ? `O ticket ${ticketNumber} já existe na nuvem.` : `Não foi possível salvar o ticket: ${error.message || 'tente novamente'}`);
      } finally { setCloudBusy(false); setSavingTicket(false); }
      window.setTimeout(() => setNotice(''), 6000);
      return;
    }
    setTickets((current) => [ticket, ...current]);
    formElement.reset();
    setNotice('Demonstração local: este lançamento ainda não foi salvo na nuvem.');
    window.setTimeout(() => setNotice(''), 6000);
    setPage('tickets');
  }

  async function markClosureRequested(closure) {
    if (closure.status !== 'Aguardando envio') return;
    if (!window.confirm(`Você já enviou por e-mail o fechamento ${closure.number} de ${closure.driver}?`)) return;
    if (cloudConfigured && sessionUser) {
      setCloudBusy(true);
      try {
        await requestCloudClosure(closure.id);
        const data = await loadCloudData();
        setDrivers(data.drivers); setTickets(data.tickets); setClosures(data.closures);
        setNotice(`Fechamento ${closure.number} marcado como solicitado por e-mail.`);
      } catch (error) { setNotice(`Não foi possível atualizar a solicitação: ${error.message || 'tente novamente'}`); }
      finally { setCloudBusy(false); }
      window.setTimeout(() => setNotice(''), 5000);
      return;
    }
    setClosures((current) => current.map((item) => item.id === closure.id ? { ...item, status: 'Solicitado' } : item));
    const ticketIds = new Set(closure.ticketIds || []);
    setTickets((current) => current.map((ticket) => ticketIds.has(ticket.id) ? { ...ticket, requestStatus: 'Solicitado' } : ticket));
    setNotice('Solicitação registrada nesta demonstração; ainda não foi salva na nuvem.');
    window.setTimeout(() => setNotice(''), 5000);
  }

  async function saveTicketAdjustment(event, password) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const number = String(form.get('number') || '').trim();
    const dateISO = String(form.get('date') || '');
    const driver = String(form.get('driver') || '');
    const selectedDriver = drivers.find((item) => item.name === driver);
    const plate = String(form.get('plate') || '').trim().toUpperCase();
    const weight = Number(form.get('weight'));
    const gross = Number(form.get('gross'));
    const discount = Number(form.get('discount')) || 0;
    const scanFile = form.get('scan') instanceof File && form.get('scan').size > 0 ? form.get('scan') : null;
    if (!editingTicket || !number || !dateISO || !driver || !Number.isFinite(weight) || weight < 0 || gross < 0 || discount < 0 || discount > gross) {
      setNotice('Confira os dados do ticket. O desconto não pode ser maior que o valor bruto.');
      return;
    }
    const duplicate = tickets.find((ticket) => ticket.id !== editingTicket.id && ticket.number.trim().toLocaleLowerCase('pt-BR') === number.toLocaleLowerCase('pt-BR'));
    if (duplicate) { setNotice(`O ticket ${number} já está cadastrado para ${duplicate.driver}, em ${duplicate.date}.`); return; }
    const note = String(form.get('note') || '').trim();
    const changes = { number, dateISO, date: formatDate(dateISO), driver, plate, weight, gross, discount, note };
    const linkedClosure = closures.find((closure) => closure.ticketIds?.includes(editingTicket.id));
    const changesDriverOrDate = editingTicket.driver !== driver || editingTicket.dateISO !== dateISO;
    if (scanFile && !(cloudConfigured && sessionUser)) { setNotice('Entre no aplicativo conectado à nuvem para trocar o comprovante.'); return; }
    if (cloudConfigured && sessionUser) {
      setCloudBusy(true);
      try {
        if (!isAdmin) throw new Error('Somente o administrador pode editar tickets.');
        if (!sessionUser.email) throw new Error('A conta não tem um e-mail de acesso para validar a senha.');
        await verifyAdminPassword(sessionUser.email, password, sessionUser.id);
        if (!selectedDriver?.id) throw new Error('O motorista selecionado não está cadastrado na nuvem.');
        await updateCloudTicket(editingTicket.id, { ...changes, driverId: selectedDriver.id, scanPath: editingTicket.scanPath }, scanFile);
        const data = await loadCloudData();
        setDrivers(data.drivers); setTickets(data.tickets); setClosures(data.closures);
      } catch (error) {
        setCloudBusy(false);
        const message = error.message || '';
        throw new Error(/invalid login credentials|invalid password|credentials/i.test(message)
          ? 'Senha incorreta. Confira a senha da sua conta administradora e tente novamente.'
          : `Não foi possível salvar a alteração: ${message || 'tente novamente'}`);
      }
      setCloudBusy(false);
      setEditingTicket(null);
      setNotice(`Ticket atualizado na nuvem.${linkedClosure && changesDriverOrDate ? ' Como o motorista ou a data mudou, ele voltou para aberto e saiu do fechamento pendente.' : ''}`);
      window.setTimeout(() => setNotice(''), 5000);
      return;
    }
    setTickets((current) => current.map((ticket) => ticket.id === editingTicket.id
      ? { ...ticket, ...changes, ...(linkedClosure && changesDriverOrDate ? { status: 'Aberto', requestStatus: 'Aberto', closureId: null } : {}) }
      : ticket));
    if (linkedClosure) {
      const remainingDetails = (linkedClosure.ticketDetails || []).filter((ticket) => ticket.id !== editingTicket.id);
      if (changesDriverOrDate) setClosures((current) => current.flatMap((closure) => closure.id !== linkedClosure.id ? [closure] : remainingDetails.length ? [{
        ...closure, ticketIds: remainingDetails.map((ticket) => ticket.id), ticketDetails: remainingDetails,
        count: remainingDetails.length, total: remainingDetails.reduce((sum, ticket) => sum + Number(ticket.gross || 0) - Number(ticket.discount || 0), 0),
      }] : []));
      else setClosures((current) => current.map((closure) => closure.id === linkedClosure.id ? {
        ...closure, total: closure.total - editingTicket.gross + editingTicket.discount + gross - discount,
        ticketDetails: (closure.ticketDetails || []).map((ticket) => ticket.id === editingTicket.id ? { ...ticket, ...changes } : ticket),
      } : closure));
    }
    setEditingTicket(null);
    setNotice(`Ticket atualizado nesta demonstração.${linkedClosure && changesDriverOrDate ? ' Ele voltou para a lista de tickets em aberto.' : ''} A alteração ainda não foi gravada na nuvem.`);
    window.setTimeout(() => setNotice(''), 5000);
  }

  async function saveDriver(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    if (!name) return false;
    const record = {
      id: String(form.get('driverId') || '') || undefined,
      originalName: String(form.get('originalName') || '').trim(),
      name,
      plate: String(form.get('plate') || '').trim().toUpperCase(),
      cpf: String(form.get('cpf') || '').trim(),
      pix: String(form.get('pix') || '').trim(),
      bank: String(form.get('bank') || '').trim(),
      accountType: String(form.get('accountType') || '').trim(),
      branch: String(form.get('branch') || '').trim(),
      account: String(form.get('account') || '').trim(),
      defaultFare: Number(form.get('defaultFare')) || 1000,
    };
    if (cloudConfigured && sessionUser) {
      setCloudBusy(true);
      try {
        const saved = await saveCloudDriver(record);
        setDrivers((current) => [...current.filter((driver) => driver.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      } catch (error) {
        const message = error.code === '23505' ? 'Já existe um motorista com esse nome.' : (error.message || 'tente novamente');
        setNotice(`Não foi possível salvar o motorista: ${message}`);
        setCloudBusy(false);
        return false;
      }
      setCloudBusy(false);
      formElement.reset();
      setNotice('Motorista salvo na nuvem.');
      window.setTimeout(() => setNotice(''), 5000);
      return true;
    }
    setDrivers((current) => [...current.filter((driver) => driver.name !== record.originalName), { ...record, id: record.id || record.name }].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    formElement.reset();
    setNotice('Motorista salvo nesta demonstração. Os dados ainda não foram gravados na nuvem.');
    window.setTimeout(() => setNotice(''), 5000);
    return true;
  }

  async function removeDriver(driver) {
    const driverTickets = tickets.filter((ticket) => ticket.driver === driver.name);
    const driverClosures = closures.filter((closure) => closure.driver === driver.name);
    const detail = `\n\nIsso também apagará ${driverTickets.length} ticket(s) e ${driverClosures.length} fechamento(s) desse motorista. Essa ação não pode ser desfeita.`;
    if (!window.confirm(`Excluir ${driver.name}?${detail}`)) return;
    if (cloudConfigured && sessionUser) {
      setCloudBusy(true);
      try {
        await deleteCloudDriver(driver.id);
        setDrivers((current) => current.filter((item) => item.id !== driver.id));
        setTickets((current) => current.filter((item) => item.driver !== driver.name));
        setClosures((current) => current.filter((item) => item.driver !== driver.name));
        setNotice(`Motorista ${driver.name} e seus registros foram excluídos.`);
      } catch (error) {
        setNotice(`Não foi possível concluir a exclusão: ${error.message || 'tente novamente'}`);
      } finally { setCloudBusy(false); }
      window.setTimeout(() => setNotice(''), 7000);
      return;
    }
    setDrivers((current) => current.filter((item) => item.id !== driver.id && item.name !== driver.name));
    setTickets((current) => current.filter((item) => item.driver !== driver.name));
    setClosures((current) => current.filter((item) => item.driver !== driver.name));
    setNotice(`Motorista ${driver.name} e seus registros foram excluídos desta demonstração.`);
    window.setTimeout(() => setNotice(''), 5000);
  }

  async function removeTicket(ticket) {
    if (cloudConfigured && sessionUser && !isAdmin) {
      setNotice('Somente o administrador pode excluir tickets.');
      window.setTimeout(() => setNotice(''), 6000);
      return;
    }
    if (!(cloudConfigured && sessionUser)) {
      const linked = ticket.status === 'No fechamento';
      const detail = linked ? ' O PDF e o histórico do fechamento manterão os dados registrados.' : '';
      if (!window.confirm(`Excluir o ticket ${ticket.number} de ${ticket.driver}?${detail}\n\nEssa ação não pode ser desfeita.`)) return;
      setTickets((current) => current.filter((item) => item.id !== ticket.id));
      setNotice(`Ticket ${ticket.number} excluído desta demonstração.`);
      window.setTimeout(() => setNotice(''), 5000);
      return;
    }
    setTicketDeletePassword('');
    setTicketDeleteMessage('');
    setTicketToDelete(ticket);
  }

  async function confirmDeleteTicket(event) {
    event.preventDefault();
    const ticket = ticketToDelete;
    if (!ticket || ticketDeleteBusy) return;
    setTicketDeleteBusy(true);
    setTicketDeleteMessage('');
    try {
      if (!sessionUser?.email) throw new Error('A conta não tem um e-mail de acesso para validar a senha.');
      await verifyAdminPassword(sessionUser.email, ticketDeletePassword, sessionUser.id);
      setCloudBusy(true);
      await deleteCloudTicket(ticket.id);
      setTickets((current) => current.filter((item) => item.id !== ticket.id));
      setTicketToDelete(null);
      setTicketDeletePassword('');
      setNotice(`Ticket ${ticket.number} excluído.`);
      window.setTimeout(() => setNotice(''), 6000);
    } catch (error) {
      const message = error.message || '';
      setTicketDeleteMessage(/invalid login credentials|invalid password|credentials/i.test(message)
        ? 'Senha incorreta. Confira a senha da sua conta administradora e tente novamente.'
        : `Não foi possível excluir o ticket: ${message || 'tente novamente'}`);
    } finally {
      setCloudBusy(false);
      setTicketDeleteBusy(false);
    }
  }

  async function saveAccount(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const displayName = String(form.get('displayName') || '').trim();
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '');
    if (!displayName || !username) { setAccountMessage('Preencha seu nome e usuário.'); return; }
    if (username.includes('@')) { setAccountMessage('O usuário é um nome como ADM, sem e-mail.'); return; }
    setAccountBusy(true);
    setAccountMessage('');
    try {
      const user = await updateCloudAccount({ displayName, username, password });
      if (user) setSessionUser(user);
      setAccountMessage(password ? 'Usuário e senha atualizados.' : 'Usuário atualizado.');
      formElement.elements.password.value = '';
    } catch (error) {
      setAccountMessage(error.code === '23505'
        ? 'Esse usuário já está em uso. Escolha outro.'
        : `Não foi possível atualizar a conta: ${error.message || 'tente novamente'}`);
    } finally { setAccountBusy(false); }
  }

  async function exitAccount() {
    if (cloudConfigured && sessionUser) {
      const { error } = await signOut();
      if (error) setNotice('Não foi possível sair da conta.');
      else await clearCloudTicketScanCache();
      return;
    }
    setShowLogin(true);
  }

  async function generateClosures(selectedTickets, periodStart, periodEnd) {
    if (cloudConfigured && sessionUser) {
      const selectedDriverName = selectedTickets[0]?.driver;
      if (!selectedDriverName || selectedTickets.some((ticket) => ticket.driver !== selectedDriverName)) {
        setNotice('Cada fechamento deve conter tickets de um único motorista.');
        return;
      }
      const profile = drivers.find((item) => item.name === selectedDriverName);
      if (!profile?.id) { setNotice('Cadastre este motorista na nuvem antes de gerar o fechamento.'); return; }
      const from = periodStart || selectedTickets.map((item) => item.dateISO).sort()[0];
      const to = periodEnd || selectedTickets.map((item) => item.dateISO).sort().at(-1);
      setCloudBusy(true);
      try {
        await createCloudClosure(profile.id, from, to, selectedTickets.map((ticket) => ticket.id));
        const data = await loadCloudData();
        setDrivers(data.drivers); setTickets(data.tickets); setClosures(data.closures);
        setClosureSequence(Math.max(0, ...data.closures.map((item) => Number(item.number) || 0)) + 1);
        setNotice(`Fechamento de ${selectedDriverName} salvo na nuvem.`);
      } catch (error) {
        setNotice(`Não foi possível gerar o fechamento: ${error.message || 'tente novamente'}`);
      } finally { setCloudBusy(false); }
      window.setTimeout(() => setNotice(''), 6000);
      return;
    }
    const byDriver = new Map();
    selectedTickets.forEach((ticket) => {
      byDriver.set(ticket.driver, [...(byDriver.get(ticket.driver) || []), ticket]);
    });
    const created = [...byDriver.entries()].map(([driver, items], index) => ({
      id: `F-${Date.now()}-${driver}`,
      number: String(closureSequence + index).padStart(3, '0'),
      driver,
      start: periodStart || items.map((item) => item.dateISO).sort()[0],
      end: periodEnd || items.map((item) => item.dateISO).sort().at(-1),
      count: items.length,
      total: items.reduce((sum, item) => sum + item.gross - item.discount, 0),
      ticketIds: items.map((item) => item.id),
      ticketDetails: items.map((item) => ({ ...item })),
      driverDetails: driverPaymentDetails(driver, items, drivers.find((item) => item.name === driver)),
      status: 'Aguardando envio',
    }));
    const ticketIds = new Set(selectedTickets.map((ticket) => ticket.id));
    setClosureSequence((current) => current + created.length);
    setClosures((current) => [...created, ...current]);
    setTickets((current) => current.map((ticket) => ticketIds.has(ticket.id) ? { ...ticket, status: 'No fechamento', requestStatus: 'Aguardando envio' } : ticket));
    setNotice(`${created.length} fechamento(s) criado(s) nesta demonstração. Ainda não foi salvo na nuvem.`);
    window.setTimeout(() => setNotice(''), 6000);
  }

  function deleteClosure(closure) {
    if (cloudConfigured && sessionUser && !isAdmin) {
      setNotice('Somente o administrador pode excluir fechamentos.');
      window.setTimeout(() => setNotice(''), 6000);
      return;
    }
    setDeletePassword('');
    setDeletePasswordMessage('');
    setClosureToDelete(closure);
  }

  async function confirmDeleteClosure(event) {
    event.preventDefault();
    const closure = closureToDelete;
    if (!closure || deleteBusy) return;
    setDeleteBusy(true);
    setDeletePasswordMessage('');
    if (cloudConfigured && sessionUser) {
      try {
        if (!sessionUser.email) throw new Error('A conta não tem um e-mail de acesso para validar a senha.');
        await verifyAdminPassword(sessionUser.email, deletePassword, sessionUser.id);
        setCloudBusy(true);
        await deleteCloudClosure(closure.id);
        const data = await loadCloudData();
        setDrivers(data.drivers); setTickets(data.tickets); setClosures(data.closures);
        setNotice('Fechamento excluído da nuvem. Os tickets voltaram para abertos.');
        setClosureToDelete(null);
        setDeletePassword('');
        window.setTimeout(() => setNotice(''), 6000);
      } catch (error) {
        const message = error.message || '';
        setDeletePasswordMessage(/invalid login credentials|invalid password|credentials/i.test(message)
          ? 'Senha incorreta. Confira a senha da sua conta administradora e tente novamente.'
          : `Não foi possível excluir o fechamento: ${message || 'tente novamente'}`);
      } finally {
        setCloudBusy(false);
        setDeleteBusy(false);
      }
      return;
    }
    const ids = new Set(closure.ticketIds || []);
    setClosures((current) => current.filter((item) => item.id !== closure.id));
    setTickets((current) => current.map((ticket) => ids.has(ticket.id) && ticket.status === 'No fechamento' ? { ...ticket, status: 'Aberto', requestStatus: 'Aberto' } : ticket));
    setClosureToDelete(null);
    setDeleteBusy(false);
    setNotice('Fechamento excluído nesta demonstração. Os tickets voltaram para abertos; a alteração ainda não está na nuvem.');
    window.setTimeout(() => setNotice(''), 6000);
  }

  async function saveClosureEdit(closure, ticketLines, password) {
    if (!isAdmin) throw new Error('Somente o administrador pode editar fechamentos.');
    if (!ticketLines.length) throw new Error('Mantenha pelo menos um ticket no fechamento.');
    if (ticketLines.some((ticket) => !Number.isFinite(Number(ticket.gross)) || !Number.isFinite(Number(ticket.discount)) || Number(ticket.gross) < 0 || Number(ticket.discount) < 0 || Number(ticket.discount) > Number(ticket.gross))) {
      throw new Error('Confira os valores: o desconto não pode ser maior que o valor bruto.');
    }
    if (cloudConfigured && sessionUser) {
      if (!sessionUser.email) throw new Error('A conta não tem um e-mail de acesso para validar a senha.');
      await verifyAdminPassword(sessionUser.email, password, sessionUser.id);
      setCloudBusy(true);
      try {
        await updateCloudClosure(closure.id, ticketLines.map((ticket) => ({ ...ticket, gross: Number(ticket.gross), discount: Number(ticket.discount) })));
        const data = await loadCloudData();
        setDrivers(data.drivers); setTickets(data.tickets); setClosures(data.closures);
      } finally { setCloudBusy(false); }
    } else {
      const currentIds = new Set(closure.ticketIds || []);
      const updatedIds = new Set(ticketLines.map((ticket) => ticket.id));
      const lineMap = new Map(ticketLines.map((ticket) => [ticket.id, ticket]));
      setTickets((current) => current.map((ticket) => {
        if (currentIds.has(ticket.id) && !updatedIds.has(ticket.id)) return { ...ticket, status: 'Aberto', requestStatus: 'Aberto' };
        const edit = lineMap.get(ticket.id);
        if (edit) return { ...ticket, ...edit, status: 'No fechamento', requestStatus: 'Aguardando envio' };
        return ticket;
      }));
      const total = ticketLines.reduce((sum, ticket) => sum + Number(ticket.gross) - Number(ticket.discount), 0);
      setClosures((current) => current.map((item) => item.id === closure.id ? {
        ...item, count: ticketLines.length, total, ticketIds: ticketLines.map((ticket) => ticket.id),
        ticketDetails: ticketLines.map((ticket) => ({ ...ticket })), status: 'Aguardando envio',
      } : item));
    }
    setClosureToEdit(null);
    setNotice(`Fechamento ${closure.number} atualizado.${closure.status === 'Solicitado' ? ' Ele voltou para Aguardando envio; baixe e reenvie o PDF corrigido.' : ''}`);
    window.setTimeout(() => setNotice(''), 7000);
  }

  return (
    <div className="app-frame">
      {cloudConfigured && !authReady ? <main className="login-stage"><section className="login-card"><img className="login-logo" src="/logo-controle-de-fretes.svg" alt="Controle de Fretes" /><p className="login-copy">Conferindo o acesso à nuvem…</p></section></main> : null}
      {cloudConfigured && authReady && sessionUser && !cloudDataReady ? <main className="login-stage"><section className="login-card"><img className="login-logo" src="/logo-controle-de-fretes.svg" alt="Controle de Fretes" /><p className="login-copy">{cloudLoadError ? `Não foi possível carregar os dados salvos: ${cloudLoadError}` : 'Carregando seus dados da nuvem…'}</p>{cloudLoadError && <button className="button primary full" onClick={() => window.location.reload()}>Tentar novamente</button>}</section></main> : null}
      {authReady && showLogin ? (
        <main className="login-stage">
          <section className="login-card">
            <p className="eyebrow">CONTROLE DE OPERAÇÃO</p>
            <img className="login-logo" src="/logo-controle-de-fretes.svg" alt="Controle de Fretes" />
            <p className="login-copy">Entre para acompanhar lançamentos, fechamentos e solicitações.</p>
            <form className="login-form" onSubmit={async (event) => {
              event.preventDefault();
              if (!cloudConfigured) { setShowLogin(false); return; }
              const form = new FormData(event.currentTarget);
              const username = String(form.get('username') || '').trim();
              const password = String(form.get('password') || '');
              setCloudBusy(true); setAuthMessage('');
              let loginEmail = username;
              if (!username.includes('@')) {
                try { loginEmail = await emailForUsername(username); }
                catch { setCloudBusy(false); setAuthMessage('Não foi possível localizar o usuário. Tente novamente ou use o e-mail atual nesta primeira entrada.'); return; }
                if (!loginEmail) { setCloudBusy(false); setAuthMessage('Esse usuário ainda não foi cadastrado. Use o e-mail atual para entrar e cadastre seu usuário em Minha conta.'); return; }
              }
              const { error } = await signIn(loginEmail, password);
              if (!error) {
                try {
                  const role = await getCloudAppRole();
                  if (!role) {
                    await signOut();
                    setAuthMessage('Esta conta está desativada. Peça ao administrador para reativar seu acesso.');
                  }
                } catch {
                  await signOut();
                  setAuthMessage('Não foi possível confirmar o acesso da conta. Tente novamente.');
                }
              }
              setCloudBusy(false);
              if (error) setAuthMessage(/invalid login credentials/i.test(error.message) ? 'Usuário ou senha não conferem.' : /user is banned|banned/i.test(error.message) ? 'Esta conta está desativada. Peça ao administrador para reativar seu acesso.' : 'Não foi possível entrar. Verifique os dados e a conexão.');
            }}>
              <label>Usuário<input name="username" type="text" placeholder="Seu usuário" autoComplete="username" required={cloudConfigured} /></label>
              <label>Senha<input name="password" type="password" placeholder="Sua senha" autoComplete="current-password" required={cloudConfigured} /></label>
              {cloudConfigured && <p className="login-hint">Use seu nome de usuário ou o e-mail da sua conta.</p>}
              {authMessage && <div className="auth-error" role="alert">{authMessage}</div>}
              <button className="button primary full" type="submit" disabled={cloudBusy}>{cloudBusy ? 'Conectando…' : 'Entrar'}</button>
            </form>
            <div className="prototype-note"><span className="status-dot amber" /> {cloudConfigured ? 'Acesso pela conta autorizada' : 'Modo demonstração: os dados ainda não vão para a nuvem'}</div>
          </section>
          <p className="login-foot">Acesso simples para gestão de fretes</p>
        </main>
      ) : authReady && !showLogin && (!cloudConfigured || cloudDataReady) ? (
        <>
          <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
            <div className="brand-row">
              <img className="brand-logo" src="/logo-controle-de-fretes.svg" alt="Controle de Fretes" />
              <button className="icon-button close-mobile" aria-label="Fechar menu" onClick={() => setMobileNav(false)}><X size={18} /></button>
            </div>
            <div className="workspace-label">MENU PRINCIPAL</div>
            <nav className="nav-list" aria-label="Menu principal">
              {navItems.filter(({ id }) => id !== 'motoristas' || isAdmin).map(({ id, label, icon: Icon }) => (
                <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => { setPage(id); setMobileNav(false); }}>
                  <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{id === 'tickets' && <span className="nav-count">{tickets.length}</span>}
                </button>
              ))}
            </nav>
            <div className="sidebar-spacer" />
            <div className="sidebar-help"><div className="help-icon"><CircleHelp size={17} /></div><div><strong>Precisa de ajuda?</strong><span>Consulte seus lançamentos</span></div><ArrowUpRight size={15} /></div>
            <div className="profile-row"><button className="profile-open" onClick={() => { setAccountMessage(''); setAccountOpen(true); }} aria-label="Editar minha conta"><div className="avatar">{(sessionUser?.user_metadata?.display_name || 'Josué').slice(0, 1).toUpperCase()}</div><div className="profile-text"><strong>{sessionUser?.user_metadata?.display_name || 'Josué'}</strong><span>{sessionUser?.user_metadata?.username || 'Cadastrar usuário'}</span></div><UserRound size={15} /></button><button className="icon-button" aria-label="Sair da conta" title="Sair da conta" onClick={exitAccount}><LogOut size={16} /></button></div>
          </aside>

          {mobileNav && <button className="mobile-backdrop" aria-label="Fechar menu" onClick={() => setMobileNav(false)} />}

          <main className="main-area">
            <header className="topbar">
              <div className="topbar-left">
                <button className="icon-button mobile-menu" aria-label="Abrir menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
                <div className="breadcrumb">Operação <span>/</span> <strong>{navItems.find((item) => item.id === page)?.label || 'Início'}</strong></div>
              </div>
              <div className="topbar-right">
                <span className={`prototype-pill ${syncState}`}><span className="status-dot amber" /> {syncState === 'online' ? 'Nuvem conectada' : syncState === 'connecting' ? 'Conectando à nuvem' : syncState === 'error' ? 'Erro na nuvem' : 'Demonstração local'}</span>
                {scanPrefetchProgress && <span className="scan-prefetch-pill" role="status"><RefreshCw size={14} aria-hidden="true" />Sincronizando</span>}
                <button className="icon-button theme-toggle" type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} aria-pressed={theme === 'dark'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
                <button className="icon-button notification-button" aria-label="Notificações"><Bell size={18} /><i /></button>
                <button className="top-user" onClick={() => { setAccountMessage(''); setAccountOpen(true); }} aria-label="Abrir minha conta"><div className="avatar small">{(sessionUser?.user_metadata?.display_name || 'Josué').slice(0, 1).toUpperCase()}</div><span>{sessionUser?.user_metadata?.display_name || 'Josué'}</span></button>
              </div>
            </header>

            <section className="content">
              {notice && <div className="notice"><span className="status-dot amber" />{notice}<button className="notice-close" onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={16} /></button></div>}
              {cloudConfigured && cloudBusy && <div className="cloud-loading">Sincronizando lançamentos salvos…</div>}
              {page === 'painel' && <Dashboard totals={totals} tickets={tickets} isAdmin={isAdmin} goTo={setPage} onView={setViewingTicket} onEdit={isAdmin ? setEditingTicket : null} />}
              {page === 'tickets' && <Tickets tickets={visibleTickets} drivers={drivers} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} onSave={saveTicket} onView={setViewingTicket} onEdit={isAdmin ? setEditingTicket : null} onDelete={isAdmin ? removeTicket : null} saving={savingTicket} />}
              {page === 'fechamentos' && <Closures tickets={tickets} drivers={drivers} closures={closures} canDelete={isAdmin} onGenerate={generateClosures} onPreview={(item) => openClosurePdf(item, setNotice, setCloudBusy)} onDownload={(item) => downloadClosurePdf(item, setNotice, setCloudBusy)} onDelete={deleteClosure} onMarkRequested={markClosureRequested} />}
              {page === 'solicitacoes' && <Requests closures={closures} canDelete={isAdmin} onMarkRequested={markClosureRequested} onPreview={(item) => openClosurePdf(item, setNotice, setCloudBusy)} onDownload={(item) => downloadClosurePdf(item, setNotice, setCloudBusy)} onDelete={deleteClosure} onEdit={isAdmin ? setClosureToEdit : null} />}
              {page === 'motoristas' && isAdmin && <Drivers drivers={drivers} onSave={saveDriver} onDelete={removeDriver} />}
              <footer className="content-footer"><span>Controle de Fretes</span><span>Os registros exibidos são fictícios</span></footer>
            </section>
            {editingTicket && <TicketEditModal ticket={editingTicket} drivers={drivers} requirePassword={Boolean(cloudConfigured && sessionUser)} onClose={() => setEditingTicket(null)} onSave={saveTicketAdjustment} />}
            {viewingTicket && <TicketDetailModal ticket={viewingTicket} onClose={() => setViewingTicket(null)} canViewHistory={isAdmin} />}
            {accountOpen && <AccountModal user={sessionUser} onClose={() => setAccountOpen(false)} onSave={saveAccount} busy={accountBusy} message={accountMessage} isAdmin={isAdmin} />}
            {closureToDelete && <AdminDeleteModal closure={closureToDelete} password={deletePassword} setPassword={setDeletePassword} message={deletePasswordMessage} busy={deleteBusy} onClose={() => { if (!deleteBusy) { setClosureToDelete(null); setDeletePassword(''); setDeletePasswordMessage(''); } }} onConfirm={confirmDeleteClosure} />}
            {ticketToDelete && <TicketDeleteModal ticket={ticketToDelete} password={ticketDeletePassword} setPassword={setTicketDeletePassword} message={ticketDeleteMessage} busy={ticketDeleteBusy} onClose={() => { if (!ticketDeleteBusy) { setTicketToDelete(null); setTicketDeletePassword(''); setTicketDeleteMessage(''); } }} onConfirm={confirmDeleteTicket} />}
            {closureToEdit && <ClosureEditorModal key={closureToEdit.id} closure={closureToEdit} tickets={tickets} onClose={() => setClosureToEdit(null)} onSave={saveClosureEdit} />}
          </main>
        </>
      ) : null}
    </div>
  );
}

function PageHeading({ eyebrow = 'VISÃO GERAL', title, subtitle, action }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}

function Dashboard({ totals, tickets, isAdmin, goTo, onView, onEdit }) {
  const recentTickets = [...tickets].sort((a, b) => {
    const aCreated = Date.parse(a.createdAt || '') || 0;
    const bCreated = Date.parse(b.createdAt || '') || 0;
    if (aCreated || bCreated) return bCreated - aCreated;
    return (b.dateISO || '').localeCompare(a.dateISO || '');
  }).slice(0, 4);
  return <>
    <PageHeading title="Início" subtitle="Veja o que falta fechar e acompanhe os relatórios enviados." action={<button className="button primary" onClick={() => goTo('tickets')}><Plus size={17} /> Novo ticket</button>} />
    <div className="metrics-grid home-metrics-grid">
      <Metric icon={ClipboardList} label="Tickets em aberto" value={money(totals.openTotal)} tint="blue" foot={`${totals.openCount} ticket(s) aguardando fechamento`} />
      <Metric icon={CreditCard} label="Aguardando envio" value={money(totals.awaitingRequestTotal)} tint="amber" foot={`${totals.awaitingRequestCount} fechamento(s) ainda não enviados`} />
      <Metric icon={Check} label="Solicitado por e-mail" value={money(totals.requestedTotal)} tint="green" foot={`${totals.requestedCount} fechamento(s) enviados`} />
    </div>
    <div className="dashboard-grid">
      <section className="panel recent-panel">
        <div className="panel-heading"><div><h2>Tickets recentes</h2><p>Últimos lançamentos da operação</p></div><button className="text-button" onClick={() => goTo('tickets')}>Ver todos <ArrowUpRight size={15} /></button></div>
        <TicketTable tickets={recentTickets} compact onView={onView} onEdit={onEdit} />
      </section>
      <section className="panel quick-panel">
        <div className="panel-heading"><div><h2>Acesso rápido</h2><p>Atalhos da operação</p></div></div>
        <button className="quick-link" onClick={() => goTo('tickets')}><span className="quick-icon blue"><Plus size={17} /></span><span><strong>Registrar ticket</strong><small>Novo lançamento de frete</small></span><ArrowUpRight size={16} /></button>
        <button className="quick-link" onClick={() => goTo('fechamentos')}><span className="quick-icon violet"><BadgeDollarSign size={17} /></span><span><strong>Gerar fechamento</strong><small>Consolidar por motorista</small></span><ArrowUpRight size={16} /></button>
        {isAdmin && <button className="quick-link" onClick={() => goTo('motoristas')}><span className="quick-icon green"><Users size={17} /></span><span><strong>Ver motoristas</strong><small>Consultar cadastros</small></span><ArrowUpRight size={16} /></button>}
        <div className="sync-card"><div className="sync-symbol"><Settings2 size={17} /></div><div><strong>Sincronização em tempo real</strong><span>Será ativada ao conectar a nuvem</span></div></div>
      </section>
    </div>
  </>;
}

function Metric({ icon: Icon, label, value, tint, foot }) {
  return <div className="metric-card"><div className={`metric-icon ${tint}`}><Icon size={19} strokeWidth={1.9} /></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-foot">{foot}</span></div>;
}

function Tickets({ tickets, drivers, query, setQuery, filter, setFilter, onSave, onView, onEdit, onDelete, saving }) {
  const [scanName, setScanName] = useState('');
  const handleTicketSubmit = async (event) => {
    const form = event.currentTarget;
    await onSave(event);
    if (!form.elements.scan.files.length && !form.elements.cameraScan.files.length) setScanName('');
  };
  return <>
    <PageHeading eyebrow="LANÇAMENTOS" title="Tickets" subtitle="Registre os fretes e acompanhe o andamento de cada ticket." />
    <section className="panel form-panel">
      <div className="panel-heading form-heading"><div><h2><span className="heading-icon"><Plus size={17} /></span> Registrar ticket</h2><p>Os campos com * são obrigatórios.</p></div><span className="form-step">NOVO LANÇAMENTO</span></div>
      <form className="ticket-form" onSubmit={handleTicketSubmit}>
        <label>Data *<input type="date" name="date" defaultValue={localToday()} required /></label>
        <label>Nº do ticket *<input name="number" placeholder="Ex.: 1465" required /></label>
        <label>Motorista *<select name="driver" defaultValue="" required onChange={(event) => { const selected = drivers.find((driver) => driver.name === event.target.value); event.currentTarget.form.elements.plate.value = selected?.plate || ''; event.currentTarget.form.elements.gross.value = Number(selected?.defaultFare ?? 1000).toFixed(2); }}><option value="" disabled>Selecione…</option>{drivers.map((driver) => <option key={driver.name}>{driver.name}</option>)}</select></label>
        <label>Placa<input name="plate" placeholder="Ex.: ABC-1D23" /></label>
        <label>Peso (kg) *<input name="weight" type="number" min="0" step="0.01" placeholder="0,00" required /></label>
        <label>Valor bruto (R$) *<input name="gross" type="number" min="0" step="0.01" defaultValue="1000" placeholder="0,00" required /></label>
        <label>Desconto (R$)<input name="discount" type="number" min="0" step="0.01" placeholder="0,00" defaultValue="0" /></label>
        <label className="wide-field">Observação<input name="note" placeholder="Ex.: valor referente a dois fretes" /></label>
        <div className="ticket-scan-field wide-field">
          <span className="ticket-scan-title">Comprovante do ticket * <small>(obrigatório)</small></span>
          <div className="ticket-scan-actions">
            <label className="button secondary scan-file-button"><FileText size={16} /> <span>Importar PDF ou imagem</span><input type="file" name="scan" accept="application/pdf,.pdf,image/*" onChange={(event) => { event.currentTarget.form.elements.cameraScan.value = ''; setScanName(event.target.files[0]?.name || ''); }} /></label>
            <label className="button secondary scan-camera-button"><Plus size={16} /> <span>Tirar foto</span><input type="file" name="cameraScan" accept="image/*" capture="environment" onChange={(event) => { event.currentTarget.form.elements.scan.value = ''; setScanName(event.target.files[0]?.name || ''); }} /></label>
          </div>
          <div className="ticket-scan-selected"><small className="ticket-scan-name">{scanName || 'Anexe o PDF ou a foto antes de registrar'}</small>{scanName && <button className="ticket-scan-remove" type="button" onClick={(event) => { const form = event.currentTarget.closest('form'); form.elements.scan.value = ''; form.elements.cameraScan.value = ''; setScanName(''); }}><Trash2 size={14} /> Remover</button>}</div>
          <small className="ticket-scan-help">No computador, importe o PDF ou a imagem. No celular, escolha uma foto da galeria ou tire uma foto. Imagens são reduzidas para ocupar menos espaço.</small>
        </div>
        <div className="form-actions"><span><span className="status-dot amber" /> {saving ? 'Salvando na nuvem…' : cloudConfigured ? 'O lançamento será confirmado após salvar na nuvem.' : 'Demonstração local: este lançamento não vai para a nuvem.'}</span><button className="button primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : <><Check size={16} /> Registrar ticket</>}</button></div>
      </form>
    </section>
    <section className="panel list-panel">
      <div className="panel-heading"><div><h2>Tickets registrados <span className="subtle-count">{tickets.length}</span></h2><p>Pesquise e filtre os lançamentos.</p></div><button className="button secondary small-button" onClick={() => window.alert('A exportação será conectada em uma etapa futura.')}><ArrowDownToLine size={16} /> Exportar</button></div>
      <div className="table-toolbar"><label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ticket, motorista ou placa" /></label><select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value)}><option>Todos</option><option>Aberto</option><option>No fechamento</option></select></div>
      <TicketTable tickets={tickets} onView={onView} onEdit={onEdit} onDelete={onDelete} />
    </section>
  </>;
}

function TicketTable({ tickets, onView, onEdit, onDelete, compact = false }) {
  return <div className="table-wrap"><table><thead><tr><th>DATA</th><th>TICKET</th><th>MOTORISTA</th><th>PLACA</th>{!compact && <th>PESO</th>}<th>LÍQUIDO</th><th>STATUS</th>{!compact && <th></th>}</tr></thead><tbody>
    {tickets.length ? tickets.map((ticket) => {
      const requestStatus = ticket.requestStatus || ticket.status;
      const requested = requestStatus === 'Solicitado';
      const statusLabel = ticket.status === 'Aberto' ? 'Aberto' : requested ? 'Solicitado' : 'Aguardando envio';
      const statusClass = requested ? 'solicitado' : ticket.status === 'No fechamento' ? 'pendente' : 'aberto';
      return (
        <tr key={ticket.id} className={requested ? 'ticket-requested-row' : undefined}>
          <td>{ticket.date}</td><td><strong>{ticket.number}</strong>{ticket.scanPath && <small className="ticket-note">Comprovante anexado</small>}{ticket.note && <small className="ticket-note">{ticket.note}</small>}</td>
          <td>{ticket.driver}</td><td>{ticket.plate}</td>{!compact && <td>{ticket.weight.toLocaleString('pt-BR')} kg</td>}
          <td><strong>{money(ticket.gross - ticket.discount)}</strong></td>
          <td><span className={`status-badge ${statusClass}`}><i />{statusLabel}</span>{compact && onView && <div className="compact-ticket-actions"><button className="row-action compact-ticket-view" aria-label={`Ver ticket ${ticket.number}`} title="Ver ticket" onClick={() => onView(ticket)}><Eye size={13} /> Ver</button>{!requested && onEdit && <button className="row-action compact-ticket-view" aria-label={`Editar ticket ${ticket.number}`} title="Editar ticket" onClick={() => onEdit(ticket)}><Pencil size={13} /> Editar</button>}</div>}</td>
          {!compact && <td className="ticket-actions">{onView && <button className="row-action" onClick={() => onView(ticket)}><Eye size={13} /> Ver</button>}{onEdit && !requested && <button className="row-action" onClick={() => onEdit(ticket)}><Pencil size={13} /> Editar</button>}{onDelete && <button className="row-action danger-action" onClick={() => onDelete(ticket)}>Excluir</button>}</td>}
        </tr>
      );
    }) : <tr className="ticket-empty-row"><td colSpan={compact ? 6 : 8} className="empty-state">Nenhum ticket encontrado com esse filtro.</td></tr>}
  </tbody></table></div>;
}

const ticketHistoryLabels = {
  number: 'Número', date: 'Data', driver: 'Motorista', plate: 'Placa', weight: 'Peso',
  gross: 'Valor bruto', discount: 'Desconto', note: 'Observação', scan_name: 'Comprovante',
};

function formatTicketHistoryValue(field, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'date') return formatDate(String(value).slice(0, 10));
  if (field === 'gross' || field === 'discount') return money(value);
  if (field === 'weight') return `${Number(value).toLocaleString('pt-BR')} kg`;
  return String(value);
}

function TicketDetailModal({ ticket, onClose, canViewHistory }) {
  const [scanUrl, setScanUrl] = useState('');
  const [scanLoading, setScanLoading] = useState(Boolean(ticket.scanPath));
  const [scanError, setScanError] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(Boolean(canViewHistory && cloudConfigured));
  const [historyError, setHistoryError] = useState('');
  const isPdf = ticket.scanType === 'application/pdf' || ticket.scanName?.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (!ticket.scanPath) return () => { active = false; };
    downloadCloudTicketScan(ticket.scanPath).then((blob) => {
      if (!active || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setScanUrl(objectUrl);
    }).catch((error) => {
      if (active) setScanError(error.message || 'Não foi possível carregar o comprovante.');
    }).finally(() => { if (active) setScanLoading(false); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [ticket.scanPath]);

  useEffect(() => {
    let active = true;
    if (!canViewHistory || !cloudConfigured) return () => { active = false; };
    setHistoryLoading(true);
    setHistoryError('');
    loadCloudTicketEditHistory(ticket.id).then((rows) => {
      if (active) setHistory(rows);
    }).catch(() => {
      if (active) setHistoryError('Não foi possível carregar o histórico de alterações.');
    }).finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [ticket.id, canViewHistory]);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="edit-modal ticket-detail-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-detail-title">
      <div className="panel-heading"><div><p className="eyebrow">DETALHES DO LANÇAMENTO</p><h2 id="ticket-detail-title">Ticket {ticket.number}</h2><p>{ticket.driver} · {ticket.date}</p></div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={18} /></button></div>
      <div className="ticket-detail-grid">
        <div><span>Peso</span><strong>{Number(ticket.weight || 0).toLocaleString('pt-BR')} kg</strong></div>
        <div><span>Placa</span><strong>{ticket.plate || '—'}</strong></div>
        <div><span>Valor bruto</span><strong>{money(ticket.gross)}</strong></div>
        <div><span>Desconto</span><strong>{money(ticket.discount)}</strong></div>
        <div><span>Valor líquido</span><strong>{money(ticket.gross - ticket.discount)}</strong></div>
        <div><span>Status</span><strong>{ticket.requestStatus || (ticket.status === 'Aberto' ? 'Aberto' : 'Aguardando envio')}</strong></div>
        {ticket.note && <div className="ticket-detail-note"><span>Observação</span><strong>{ticket.note}</strong></div>}
      </div>
      <div className="ticket-detail-scan">
        <div className="ticket-detail-scan-heading"><strong>Comprovante escaneado</strong>{scanUrl && <a className="button secondary small-button" href={scanUrl} target="_blank" rel="noreferrer" download={ticket.scanName || `ticket-${ticket.number}`}><ArrowUpRight size={14} /> Abrir em nova aba</a>}</div>
        {scanLoading ? <div className="ticket-detail-message">Carregando comprovante…</div>
          : scanError ? <div className="ticket-detail-message error">{scanError}</div>
            : scanUrl ? (isPdf
              ? <iframe className="ticket-detail-preview pdf" src={scanUrl} title={`Comprovante do ticket ${ticket.number}`} />
              : <img className="ticket-detail-preview image" src={scanUrl} alt={`Comprovante escaneado do ticket ${ticket.number}`} />)
              : <div className="ticket-detail-message">Este ticket antigo não tem comprovante anexado.</div>}
      </div>
      {canViewHistory && <section className="ticket-edit-history">
        <div className="ticket-edit-history-heading"><div><strong>Histórico de alterações</strong><small>Quem alterou e quais dados foram corrigidos.</small></div></div>
        {!cloudConfigured ? <p className="ticket-history-empty">O histórico é salvo quando o aplicativo está conectado à nuvem.</p>
          : historyLoading ? <p className="ticket-history-empty">Carregando histórico…</p>
            : historyError ? <p className="ticket-history-empty error">{historyError}</p>
              : history.length ? <div className="ticket-history-list">{history.map((entry) => {
                const before = entry.before_data || {};
                const after = entry.after_data || {};
                const proofChanged = before.scan_replaced !== after.scan_replaced && after.scan_replaced;
                const fields = Object.keys(after).filter((field) => field !== 'scan_replaced' && !(field === 'scan_name' && proofChanged) && JSON.stringify(before[field]) !== JSON.stringify(after[field]));
                return <article className="ticket-history-entry" key={entry.id}>
                  <div className="ticket-history-meta"><strong>{entry.changed_by_name || 'Administrador'}</strong><time>{new Date(entry.changed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time></div>
                  <ul>{fields.map((field) => <li key={field}><span>{ticketHistoryLabels[field] || field}</span><strong>{formatTicketHistoryValue(field, before[field])} <i>→</i> {formatTicketHistoryValue(field, after[field])}</strong></li>)}{proofChanged && <li><span>Comprovante</span><strong>Arquivo substituído{after.scan_name ? ` · ${after.scan_name}` : ''}</strong></li>}</ul>
                </article>;
              })}</div> : <p className="ticket-history-empty">Nenhuma alteração registrada para este ticket.</p>}
      </section>}
      <div className="form-actions ticket-detail-actions"><button className="button secondary" onClick={onClose}>Fechar</button></div>
    </section>
  </div>;
}

function TicketEditModal({ ticket, drivers, requirePassword, onClose, onSave }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try { await onSave(event, password); }
    catch (saveError) { setError(saveError.message || 'Não foi possível salvar as alterações.'); }
    finally { setSaving(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="edit-modal ticket-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-ticket-title">
      <div className="panel-heading"><div><h2 id="edit-ticket-title">Editar ticket {ticket.number}</h2><p>{ticket.driver} · {ticket.date}</p></div><button className="icon-button" aria-label="Fechar" disabled={saving} onClick={onClose}><X size={18} /></button></div>
      <form className="edit-ticket-form" onSubmit={submit}>
        <label>Data *<input name="date" type="date" defaultValue={ticket.dateISO || localToday()} required /></label>
        <label>Nº do ticket *<input name="number" defaultValue={ticket.number} required autoFocus /></label>
        <label>Motorista *<select name="driver" defaultValue={ticket.driver} required>{!drivers.some((driver) => driver.name === ticket.driver) && <option value={ticket.driver}>{ticket.driver}</option>}{drivers.map((driver) => <option key={driver.id || driver.name} value={driver.name}>{driver.name}</option>)}</select></label>
        <label>Placa<input name="plate" defaultValue={ticket.plate || ''} placeholder="Ex.: ABC-1D23" /></label>
        <label>Peso (kg) *<input name="weight" type="number" min="0" step="0.01" defaultValue={ticket.weight} required /></label>
        <label>Valor bruto (R$) *<input name="gross" type="number" min="0" step="0.01" defaultValue={ticket.gross} required /></label>
        <label>Desconto (R$)<input name="discount" type="number" min="0" step="0.01" defaultValue={ticket.discount} /></label>
        <label className="modal-wide">Observação<input name="note" defaultValue={ticket.note || ''} placeholder="Opcional" /></label>
        <label className="modal-wide">Trocar comprovante (opcional)<input name="scan" type="file" accept="application/pdf,.pdf,image/*" />{ticket.scanName && <small>Atual: {ticket.scanName}. Se não selecionar outro arquivo, ele será mantido.</small>}</label>
        <p className="edit-help">Tickets de fechamento ainda não solicitado podem ser editados. Se mudar a data ou o motorista, o ticket volta para aberto para entrar no fechamento correto.</p>
        {requirePassword && <label className="modal-wide closure-edit-password">Senha da sua conta administradora<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>}
        {requirePassword && <small className="modal-wide">A senha é validada pela conta e não fica salva no aplicativo.</small>}
        {error && <p className="admin-delete-error modal-wide" role="alert">{error}</p>}
        <div className="form-actions"><button className="button secondary" type="button" disabled={saving} onClick={onClose}>Cancelar</button><button className="button primary" type="submit" disabled={saving || (requirePassword && !password)}><Check size={16} /> {saving ? 'Validando e salvando…' : 'Salvar alterações'}</button></div>
      </form>
    </section>
  </div>;
}

function DashboardShareManager({ isAdmin }) {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const makeLink = (token) => {
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set('painel', token);
    return url.toString();
  };
  const refresh = async () => {
    if (!isAdmin) { setBusy(false); return; }
    setBusy(true); setMessage('');
    try {
      const current = await getDashboardShareLink();
      setLink(current?.token ? makeLink(current.token) : '');
    } catch (error) {
      setMessage(error.message || 'Não foi possível carregar o link.');
    } finally { setBusy(false); }
  };
  useEffect(() => { refresh(); }, [isAdmin]);

  const create = async () => {
    setBusy(true); setMessage(''); setCopyMessage('');
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const token = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
      await createDashboardShare(token);
      setLink(makeLink(token));
      setCopyMessage('Novo link criado. O link anterior foi desativado.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível criar o link.');
    } finally { setBusy(false); }
  };

  const revoke = async () => {
    setBusy(true); setMessage(''); setCopyMessage('');
    try {
      await revokeDashboardShare();
      setLink('');
      setCopyMessage('Link desativado.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível desativar o link.');
    } finally { setBusy(false); }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyMessage('Link copiado.');
    } catch {
      setCopyMessage('Seu navegador não permitiu copiar. Selecione e copie o endereço acima.');
    }
  };

  if (!isAdmin) return null;
  return <section className="account-share">
    <div className="account-share-heading"><span><Link2 size={16} /></span><div><strong>Compartilhar painel</strong><p>Crie um link de consulta aos gráficos e totais.</p></div></div>
    <p className="account-share-note">Qualquer pessoa com o link poderá ver os totais da operação. Dados bancários, comprovantes e informações pessoais não aparecem.</p>
    {busy ? <p className="account-share-status">Carregando configuração do link…</p> : link ? <>
      <label className="account-share-url">Link do painel<input readOnly value={link} onFocus={(event) => event.target.select()} /></label>
      <div className="account-share-actions"><button className="button primary" type="button" onClick={copy}><Copy size={15} /> Copiar link</button><button className="button secondary" type="button" onClick={revoke} disabled={busy}>Desativar link</button></div>
    </> : <button className="button primary" type="button" onClick={create}><Link2 size={15} /> Criar link de compartilhamento</button>}
    {copyMessage && <p className="account-share-status" role="status">{copyMessage}</p>}
    {message && <p className="account-share-error" role="alert">{message}</p>}
  </section>;
}

function OperatorAccessManager({ isAdmin }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [invite, setInvite] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try { setAccounts(await listOperatorAccounts()); setMessage(''); }
    catch (error) { setMessage(error.message || 'Não foi possível carregar os operadores.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (isAdmin && cloudConfigured) refresh(); }, [isAdmin]);

  async function createInvite(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const label = String(form.get('inviteLabel') || '').trim();
    setBusy('invite'); setMessage(''); setInvite(null);
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const token = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
      const expiresAt = await createOperatorInvite(token, label);
      const url = new URL(window.location.pathname, window.location.origin);
      url.searchParams.set('convite', token);
      setInvite({ link: url.toString(), expiresAt });
      formElement.reset();
    } catch (error) { setMessage(error.message || 'Não foi possível gerar o convite.'); }
    finally { setBusy(''); }
  }

  async function copyInvite() {
    try { await navigator.clipboard.writeText(invite.link); setMessage('Link do convite copiado.'); }
    catch { setMessage('Selecione e copie o link do convite.'); }
  }

  async function toggleAccount(account) {
    setBusy(account.user_id); setMessage('');
    try {
      await setOperatorActive(account.user_id, !account.active);
      setAccounts((current) => current.map((item) => item.user_id === account.user_id ? { ...item, active: !item.active } : item));
    } catch (error) { setMessage(error.message || 'Não foi possível alterar o acesso.'); }
    finally { setBusy(''); }
  }

  async function removeAccount(account) {
    if (!window.confirm(`Excluir a conta de ${account.display_name} (@${account.username})? Essa ação não pode ser desfeita.`)) return;
    setBusy(account.user_id); setMessage('');
    try {
      await deleteOperatorAccount(account.user_id);
      setAccounts((current) => current.filter((item) => item.user_id !== account.user_id));
    } catch (error) { setMessage(error.message || 'Não foi possível excluir esta conta.'); }
    finally { setBusy(''); }
  }

  if (!isAdmin) return null;
  return <section className="operator-access">
    <div className="account-share-heading"><span><Users size={16} /></span><div><strong>Acessos de operadores</strong><p>Convide pessoas para lançar tickets e gerar fechamentos.</p></div></div>
    <form className="operator-invite-form" onSubmit={createInvite}>
      <label>Nome para identificar o convite<input name="inviteLabel" placeholder="Ex.: Controladoria - Elias" minLength="2" maxLength="80" required /></label>
      <button className="button primary" type="submit" disabled={Boolean(busy)}><Link2 size={15} /> {busy === 'invite' ? 'Gerando…' : 'Gerar link de acesso'}</button>
    </form>
    {invite && <div className="operator-invite-result"><label>Compartilhe este convite (válido por 7 dias)<input readOnly value={invite.link} onFocus={(event) => event.target.select()} /></label><button className="button secondary" type="button" onClick={copyInvite}><Copy size={15} /> Copiar link</button></div>}
    {message && <p className="account-share-status" role="status">{message}</p>}
    <div className="operator-account-list">
      <strong className="operator-list-title">Contas cadastradas {accounts.length ? `(${accounts.length})` : ''}</strong>
      {loading ? <p className="account-share-status">Carregando contas…</p> : accounts.length ? accounts.map((account) => <div className="operator-account-row" key={account.user_id}>
        <div className="operator-account-info"><strong>{account.display_name}</strong><span>@{account.username} · Convite: {account.invite_label}</span><small className={account.active ? 'operator-active' : 'operator-inactive'}>{account.active ? 'Ativo' : 'Desativado'}</small></div>
        <div className="operator-account-actions"><button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => toggleAccount(account)}>{account.active ? 'Desativar' : 'Ativar'}</button><button className="button secondary operator-delete-button" type="button" disabled={Boolean(busy)} onClick={() => removeAccount(account)}><Trash2 size={14} /> Excluir</button></div>
      </div>) : <p className="account-share-status">Ainda não há contas de operador.</p>}
    </div>
    <p className="account-share-note">Operadores podem lançar tickets, gerar fechamentos e registrar solicitações. Edição, exclusão e gestão de motoristas ficam com o administrador.</p>
  </section>;
}

function AccountModal({ user, onClose, onSave, busy, message, isAdmin }) {
  const displayName = user?.user_metadata?.display_name || 'Josué';
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="edit-modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
      <div className="panel-heading"><div><p className="eyebrow">PREFERÊNCIAS</p><h2 id="account-title">Minha conta</h2><p>Altere seu nome, usuário de acesso ou senha.</p></div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={18} /></button></div>
      <form className="account-form" onSubmit={onSave}>
        <label>Nome que aparece no aplicativo<input name="displayName" defaultValue={displayName} required /></label>
        <label>Usuário<input name="username" defaultValue={user?.user_metadata?.username || ''} placeholder="Ex.: ADM" minLength="3" autoComplete="username" required /></label>
        <label>Nova senha <span>(deixe em branco para manter a atual)</span><input name="password" type="password" minLength="6" autoComplete="new-password" placeholder="Pelo menos 6 caracteres" /></label>
        {message && <p className="account-message" role="status">{message}</p>}
        <div className="form-actions"><button className="button secondary" type="button" onClick={onClose}>Fechar</button><button className="button primary" type="submit" disabled={busy}><Check size={16} /> {busy ? 'Salvando…' : 'Salvar alterações'}</button></div>
      </form>
      <DashboardShareManager isAdmin={isAdmin} />
      <OperatorAccessManager isAdmin={isAdmin} />
    </section>
  </div>;
}

function Closures({ tickets, drivers: driverRecords, closures, canDelete, onGenerate, onPreview, onDownload, onDelete, onMarkRequested }) {
  const [generating, setGenerating] = useState(false);
  const [driver, setDriver] = useState('');
  const [start, setStart] = useState(() => localDaysAgo(5));
  const [end, setEnd] = useState(localToday);
  const [historyDriver, setHistoryDriver] = useState('Todos');
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');
  const [selectedTicketIds, setSelectedTicketIds] = useState(() => new Set());
  const drivers = [...new Set([...driverRecords.map((driver) => driver.name), ...tickets.map((ticket) => ticket.driver)])].sort();
  const validRange = Boolean(start && end && start <= end);
  const matches = validRange && driver ? tickets.filter((ticket) =>
    ticket.status === 'Aberto' && ticket.dateISO >= start && ticket.dateISO <= end && ticket.driver === driver,
  ).sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.number.localeCompare(b.number)) : [];
  const matchKey = matches.map((ticket) => ticket.id).join('|');
  useEffect(() => setSelectedTicketIds(new Set(matches.map((ticket) => ticket.id))), [matchKey]);
  const selectedMatches = matches.filter((ticket) => selectedTicketIds.has(ticket.id));
  const history = closures.map((item) => {
    const ticketDetails = item.ticketDetails || tickets.filter((ticket) => item.ticketIds?.includes(ticket.id));
    return { ...item, ticketDetails, driverDetails: item.driverDetails || driverPaymentDetails(item.driver, ticketDetails, driverRecords.find((driver) => driver.name === item.driver)) };
  }).filter((item) =>
    (historyDriver === 'Todos' || item.driver === historyDriver) &&
    (!historyStart || item.end >= historyStart) &&
    (!historyEnd || item.start <= historyEnd),
  ).sort((a, b) => (a.status === b.status ? Number(b.number) - Number(a.number) : a.status === 'Aguardando envio' ? -1 : 1));
  const handleGenerate = async () => {
    if (generating || !selectedMatches.length) return;
    setGenerating(true);
    try { await onGenerate(selectedMatches, start, end); }
    finally { setGenerating(false); }
  };

  return <><PageHeading eyebrow="CONSOLIDAÇÃO" title="Fechamentos" subtitle="Gere um fechamento por motorista e período." action={<button className="button primary" disabled={!selectedMatches.length || generating} onClick={handleGenerate}><Plus size={17} /> {generating ? 'Gerando…' : `Gerar fechamento${selectedMatches.length ? ` (${selectedMatches.length})` : ''}`}</button>} />
    <section className="panel closure-filters"><div className="panel-heading"><div><h2>Novo fechamento</h2><p>Selecione um motorista e o período. Cada fechamento é individual.</p></div></div>
      <div className="filter-fields"><label>Motorista<select value={driver} onChange={(event) => setDriver(event.target.value)}><option value="">Selecione um motorista</option>{drivers.map((name) => <option key={name}>{name}</option>)}</select></label><label>Data inicial<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Data final<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div>
      {!driver ? <div className="empty-callout"><ClipboardList size={19} /><span>Selecione um motorista para ver os tickets disponíveis para fechar.</span></div> : !validRange ? <div className="empty-callout warning-callout"><CircleHelp size={18} /><span>A data inicial precisa ser anterior ou igual à data final.</span></div> : matches.length ? <>
        <div className="results-summary"><span><Check size={15} /> {selectedMatches.length} selecionado(s) de {matches.length} ticket(s) aberto(s)</span><span>Total selecionado: <strong>{money(selectedMatches.reduce((sum, ticket) => sum + ticket.gross - ticket.discount, 0))}</strong></span></div>
        <div className="selection-toolbar"><button className="text-button" onClick={() => setSelectedTicketIds(new Set(matches.map((ticket) => ticket.id)))}>Selecionar todos</button><button className="text-button" onClick={() => setSelectedTicketIds(new Set())}>Limpar seleção</button></div>
        <div className="table-wrap closure-results"><table><thead><tr><th>INCLUIR</th><th>DATA</th><th>TICKET</th><th>MOTORISTA</th><th>PESO</th><th>OBSERVAÇÃO</th><th>LÍQUIDO</th><th>STATUS</th></tr></thead><tbody>{matches.map((ticket) => <tr key={ticket.id}><td><input type="checkbox" aria-label={`Incluir ticket ${ticket.number}`} checked={selectedTicketIds.has(ticket.id)} onChange={(event) => setSelectedTicketIds((current) => { const next = new Set(current); if (event.target.checked) next.add(ticket.id); else next.delete(ticket.id); return next; })} /></td><td>{ticket.date}</td><td><strong>{ticket.number}</strong></td><td>{ticket.driver}</td><td>{ticket.weight.toLocaleString('pt-BR')} kg</td><td>{ticket.note || '—'}</td><td><strong>{money(ticket.gross - ticket.discount)}</strong></td><td><span className="status-badge aberto"><i />Aberto</span></td></tr>)}</tbody></table></div>
        <div className="closure-action"><span>O fechamento será somente de {driver} e dos {selectedMatches.length} ticket(s) selecionado(s).</span><button className="button primary" disabled={!selectedMatches.length || generating} onClick={handleGenerate}><Check size={16} /> {generating ? 'Gerando…' : `Gerar fechamento (${selectedMatches.length})`}</button></div>
      </> : <div className="empty-callout"><ClipboardList size={19} /><span>Nenhum ticket aberto encontrado nesse período. Os resultados mudam automaticamente ao alterar os filtros.</span></div>}
    </section>
    <section className="panel list-panel"><div className="panel-heading"><div><h2>Histórico de fechamentos <span className="subtle-count">{history.length}</span></h2><p>O histórico reúne todos os motoristas. Os fechamentos que aguardam envio aparecem primeiro, com o PDF em destaque.</p></div></div>
      <div className="filter-fields history-filters"><label>Motorista<select value={historyDriver} onChange={(event) => setHistoryDriver(event.target.value)}><option>Todos</option>{drivers.map((name) => <option key={name}>{name}</option>)}</select></label><label>Período a partir de<input type="date" value={historyStart} onChange={(event) => setHistoryStart(event.target.value)} /></label><label>Período até<input type="date" value={historyEnd} onChange={(event) => setHistoryEnd(event.target.value)} /></label></div>
      {history.length ? <div className="table-wrap"><table><thead><tr><th>ID</th><th>MOTORISTA</th><th>PERÍODO</th><th>TICKETS</th><th>LÍQUIDO</th><th>STATUS</th><th>AÇÕES</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className={item.status === 'Solicitado' ? 'closure-requested-row' : undefined}><td><strong>{item.number}</strong></td><td>{item.driver}</td><td>{formatDate(item.start)} – {formatDate(item.end)}</td><td>{item.count}</td><td><strong>{money(item.total)}</strong></td><td><span className={`status-badge ${item.status === 'Solicitado' ? 'solicitado' : 'pendente'}`}><i />{item.status}</span></td><td className="closure-actions"><button className="button secondary small-button" onClick={() => onPreview(item)}><FileText size={14} /> Abrir PDF</button><button className={`button ${item.status === 'Aguardando envio' ? 'primary' : 'secondary'} small-button`} onClick={() => onDownload(item)}><ArrowDownToLine size={14} /> Baixar PDF</button>{item.status === 'Aguardando envio' && <button className="button secondary small-button" onClick={() => onMarkRequested(item)}><Check size={14} /> Marcar e-mail enviado</button>}{canDelete && <button className="button delete-button small-button" onClick={() => onDelete(item)}><Trash2 size={14} /> Excluir</button>}</td></tr>)}</tbody></table></div> : <div className="empty-page"><div className="empty-illustration"><BadgeDollarSign size={25} /></div><strong>{closures.length ? 'Nenhum fechamento encontrado com esses filtros' : 'Nenhum fechamento nesta demonstração'}</strong><span>{closures.length ? 'Altere o motorista ou as datas para consultar outros fechamentos.' : 'Os fechamentos aparecerão aqui depois de gerados.'}</span></div>}
    </section>
  </>;
}

function AdminDeleteModal({ closure, password, setPassword, message, busy, onClose, onConfirm }) {
  const alreadyRequested = closure.status === 'Solicitado';
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="edit-modal admin-delete-modal" role="dialog" aria-modal="true" aria-labelledby="admin-delete-title">
      <div className="panel-heading"><div><p className="eyebrow">CONFIRMAÇÃO DO ADMINISTRADOR</p><h2 id="admin-delete-title">Excluir fechamento {closure.number}?</h2><p>{closure.driver} · {formatDate(closure.start)} a {formatDate(closure.end)}</p></div><button className="icon-button" aria-label="Fechar" disabled={busy} onClick={onClose}><X size={18} /></button></div>
      <p className="admin-delete-copy">Os tickets voltarão para a lista de abertos e poderão entrar em outro fechamento.{alreadyRequested ? ' A exclusão não cancela o e-mail que já foi enviado.' : ''} Essa ação não pode ser desfeita.</p>
      <form className="admin-delete-form" onSubmit={onConfirm}>
        <label>Senha da sua conta administradora<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required autoFocus /></label>
        <small>A senha é validada pelo Supabase e não fica salva no aplicativo.</small>
        {message && <p className="admin-delete-error" role="alert">{message}</p>}
        <div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="button delete-button" type="submit" disabled={busy || !password}>{busy ? 'Validando e excluindo…' : 'Confirmar exclusão'}</button></div>
      </form>
    </section>
  </div>;
}

function TicketDeleteModal({ ticket, password, setPassword, message, busy, onClose, onConfirm }) {
  const linked = ticket.status === 'No fechamento';
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="edit-modal admin-delete-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-delete-title">
      <div className="panel-heading"><div><p className="eyebrow">CONFIRMAÇÃO DO ADMINISTRADOR</p><h2 id="ticket-delete-title">Excluir ticket {ticket.number}?</h2><p>{ticket.driver} · {ticket.date}</p></div><button className="icon-button" aria-label="Fechar" disabled={busy} onClick={onClose}><X size={18} /></button></div>
      <p className="admin-delete-copy">Essa ação não pode ser desfeita.{linked ? ' O PDF e o histórico do fechamento manterão os dados registrados.' : ''}</p>
      <form className="admin-delete-form" onSubmit={onConfirm}>
        <label>Senha da sua conta administradora<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required autoFocus /></label>
        <small>A senha é validada pelo Supabase e não fica salva no aplicativo.</small>
        {message && <p className="admin-delete-error" role="alert">{message}</p>}
        <div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="button delete-button" type="submit" disabled={busy || !password}>{busy ? 'Validando e excluindo…' : 'Confirmar exclusão'}</button></div>
      </form>
    </section>
  </div>;
}

function ClosurePreviewModal({ closure, onClose, onDownload }) {
  const driver = closure.driverDetails || driverPaymentDetails(closure.driver, closure.ticketDetails || []);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="edit-modal closure-preview" role="dialog" aria-modal="true" aria-labelledby="closure-preview-title">
      <div className="panel-heading"><div><p className="eyebrow">PRÉVIA DO DOCUMENTO</p><h2 id="closure-preview-title">Fechamento {closure.number} · {closure.driver}</h2><p>Período {formatDate(closure.start)} a {formatDate(closure.end)}</p></div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={18} /></button></div>
      <div className="preview-section"><h3>Dados do motorista e pagamento</h3><div className="preview-driver-grid"><div><span>Nome completo</span><strong>{driver.fullName}</strong></div><div><span>CPF</span><strong>{driver.cpf}</strong></div><div><span>Placa</span><strong>{driver.plate}</strong></div><div><span>Chave PIX</span><strong>{driver.pix}</strong></div><div><span>Banco</span><strong>{driver.bank}</strong></div><div><span>Tipo de conta</span><strong>{driver.accountType}</strong></div><div><span>Agência</span><strong>{driver.branch}</strong></div><div><span>Conta</span><strong>{driver.account}</strong></div></div></div>
      <div className="preview-section"><h3>Tickets do fechamento</h3><div className="table-wrap"><table><thead><tr><th>DATA</th><th>TICKET</th><th>PESO</th><th>LÍQUIDO</th><th>OBSERVAÇÃO</th></tr></thead><tbody>{(closure.ticketDetails || []).map((ticket) => <tr key={ticket.id}><td>{ticket.date}</td><td>{ticket.number}</td><td>{Number(ticket.weight || 0).toLocaleString('pt-BR')} kg</td><td>{money(ticket.gross - ticket.discount)}</td><td>{ticket.note || '—'}</td></tr>)}</tbody></table></div></div>
      <div className="preview-total"><span>Total líquido</span><strong>{money(closure.total)}</strong></div>
      <div className="form-actions"><button className="button secondary" type="button" onClick={onClose}>Fechar prévia</button><button className="button primary" type="button" onClick={() => onDownload(closure)}><ArrowDownToLine size={16} /> Baixar PDF</button></div>
    </section>
  </div>;
}

function Requests({ closures, canDelete, onMarkRequested, onPreview, onDownload, onDelete, onEdit }) {
  const ordered = [...closures].sort((a, b) => (a.status === b.status ? Number(b.number) - Number(a.number) : a.status === 'Aguardando envio' ? -1 : 1));
  const waiting = ordered.filter((closure) => closure.status === 'Aguardando envio');
  const sent = ordered.filter((closure) => closure.status === 'Solicitado');
  return <><PageHeading eyebrow="ACOMPANHAMENTO" title="Solicitações" subtitle="Confira quais fechamentos ainda precisam ser enviados por e-mail." />
    <div className="payment-summary"><Metric icon={CreditCard} label="Aguardando envio" value={waiting.length} tint="amber" foot="Fechamentos ainda não solicitados" /><Metric icon={Check} label="Solicitados por e-mail" value={sent.length} tint="green" foot="Mantidos no histórico para evitar duplicidade" /></div>
    <section className="panel list-panel"><div className="panel-heading"><div><h2>Fechamentos e solicitações</h2><p>Os que aguardam envio aparecem primeiro. Baixe o PDF e, depois de enviar o e-mail, marque a solicitação.</p></div></div>
      {ordered.length ? <div className="table-wrap"><table><thead><tr><th>ID</th><th>MOTORISTA</th><th>PERÍODO</th><th>TICKETS</th><th>TOTAL</th><th>STATUS</th><th>AÇÕES</th></tr></thead><tbody>{ordered.map((item) => <tr key={item.id} className={item.status === 'Solicitado' ? 'closure-requested-row' : undefined}><td><strong>{item.number}</strong></td><td>{item.driver}</td><td>{formatDate(item.start)} – {formatDate(item.end)}</td><td>{item.count}</td><td><strong>{money(item.total)}</strong></td><td><span className={`status-badge ${item.status === 'Solicitado' ? 'solicitado' : 'pendente'}`}><i />{item.status}</span></td><td className="closure-actions">{canDelete && <button className="button secondary small-button" onClick={() => onEdit(item)}><Pencil size={14} /> Editar</button>}<button className="button secondary small-button" onClick={() => onPreview(item)}><FileText size={14} /> Abrir PDF</button><button className={`button ${item.status === 'Aguardando envio' ? 'primary' : 'secondary'} small-button`} onClick={() => onDownload(item)}><ArrowDownToLine size={14} /> Baixar PDF</button>{item.status === 'Aguardando envio' && <button className="button secondary small-button" onClick={() => onMarkRequested(item)}><Check size={14} /> Marcar e-mail enviado</button>}{canDelete && <button className="button delete-button small-button" onClick={() => onDelete(item)}><Trash2 size={14} /> Excluir</button>}</td></tr>)}</tbody></table></div> : <div className="empty-page"><div className="empty-illustration"><CreditCard size={25} /></div><strong>Nenhum fechamento para acompanhar</strong><span>Depois de gerar um fechamento, ele aparecerá aqui.</span></div>}
    </section>
  </>;
}
function ClosureEditorModal({ closure, tickets, onClose, onSave }) {
  const initialLines = closure.ticketDetails?.length
    ? closure.ticketDetails
    : tickets.filter((ticket) => closure.ticketIds?.includes(ticket.id));
  const [lines, setLines] = useState(() => initialLines.map((ticket) => ({ ...ticket })));
  const [candidateId, setCandidateId] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const currentIds = new Set(lines.map((ticket) => ticket.id));
  const candidates = tickets.filter((ticket) =>
    ticket.status === 'Aberto' && ticket.driver === closure.driver && ticket.dateISO >= closure.start && ticket.dateISO <= closure.end && !currentIds.has(ticket.id),
  ).sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.number.localeCompare(b.number));
  const total = lines.reduce((sum, ticket) => sum + Number(ticket.gross || 0) - Number(ticket.discount || 0), 0);
  const requested = closure.status === 'Solicitado';

  const updateLine = (ticketId, field, value) => setLines((current) => current.map((ticket) => ticket.id === ticketId ? { ...ticket, [field]: value } : ticket));
  const addTicket = () => {
    const ticket = candidates.find((item) => item.id === candidateId);
    if (!ticket) return;
    setLines((current) => [...current, { ...ticket }]);
    setCandidateId('');
  };
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try { await onSave(closure, lines, password); }
    catch (saveError) { setError(saveError.message || 'Não foi possível salvar as alterações.'); }
    finally { setSaving(false); }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="edit-modal closure-editor-modal" role="dialog" aria-modal="true" aria-labelledby="closure-editor-title">
      <div className="panel-heading"><div><p className="eyebrow">CORRIGIR FECHAMENTO</p><h2 id="closure-editor-title">Fechamento {closure.number} · {closure.driver}</h2><p>{formatDate(closure.start)} a {formatDate(closure.end)}</p></div><button className="icon-button" aria-label="Fechar" disabled={saving} onClick={onClose}><X size={18} /></button></div>
      {requested && <p className="closure-edit-warning">Este fechamento já foi marcado como solicitado. Ao salvar a correção, ele volta para “Aguardando envio” para você baixar e enviar o PDF atualizado.</p>}
      <form onSubmit={submit}>
        <div className="closure-edit-list">{lines.map((ticket) => <article className="closure-edit-ticket" key={ticket.id}>
          <div className="closure-edit-ticket-heading"><strong>Ticket {ticket.number}</strong><span>{ticket.date} · {Number(ticket.weight || 0).toLocaleString('pt-BR')} kg</span><button className="text-button danger-action" type="button" disabled={lines.length <= 1} onClick={() => setLines((current) => current.filter((item) => item.id !== ticket.id))}>Remover</button></div>
          <div className="closure-edit-fields"><label>Valor bruto (R$)<input type="number" min="0" step="0.01" value={ticket.gross} onChange={(event) => updateLine(ticket.id, 'gross', event.target.value)} required /></label><label>Desconto (R$)<input type="number" min="0" step="0.01" value={ticket.discount} onChange={(event) => updateLine(ticket.id, 'discount', event.target.value)} required /></label><label className="closure-edit-note">Observação<input value={ticket.note || ''} onChange={(event) => updateLine(ticket.id, 'note', event.target.value)} placeholder="Opcional" /></label></div>
        </article>)}</div>
        {candidates.length > 0 && <div className="closure-add-ticket"><label>Incluir ticket aberto deste motorista<select value={candidateId} onChange={(event) => setCandidateId(event.target.value)}><option value="">Selecione um ticket</option>{candidates.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.number} · {ticket.date} · {money(ticket.gross - ticket.discount)}</option>)}</select></label><button className="button secondary" type="button" disabled={!candidateId} onClick={addTicket}><Plus size={15} /> Incluir</button></div>}
        <div className="closure-edit-total"><span>{lines.length} ticket(s)</span><strong>Total líquido: {money(total)}</strong></div>
        <label className="closure-edit-password">Senha da sua conta administradora<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="admin-delete-error" role="alert">{error}</p>}
        <div className="form-actions"><button className="button secondary" type="button" disabled={saving} onClick={onClose}>Cancelar</button><button className="button primary" type="submit" disabled={saving || !password || !lines.length}><Check size={16} /> {saving ? 'Salvando…' : 'Salvar correção'}</button></div>
      </form>
    </section>
  </div>;
}

function Drivers({ drivers, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const visible = drivers.filter((driver) => driver.name.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeading eyebrow="CADASTROS" title="Motoristas" subtitle="Cadastros e dados que acompanham cada solicitação." action={<button className="button primary" onClick={() => setEditing({})}><Plus size={17} /> Novo motorista</button>} />
    {editing && <section className="panel driver-form-panel"><div className="panel-heading"><div><h2>{editing.name ? 'Editar motorista' : 'Novo motorista'}</h2><p>Os dados bancários aparecerão no relatório do fechamento.</p></div><button className="icon-button" aria-label="Fechar formulário" onClick={() => setEditing(null)}><X size={18} /></button></div><form key={editing.id || editing.name || 'new'} onSubmit={async (event) => { const saved = await onSave(event); if (saved) setEditing(null); }}>
      <input type="hidden" name="driverId" value={editing.id || ''} /><input type="hidden" name="originalName" value={editing.name || ''} />
      <div className="filter-fields driver-fields"><label>Nome completo *<input name="name" defaultValue={editing.name || ''} placeholder="Nome do motorista" required /></label><label>Placa<input name="plate" defaultValue={editing.plate || ''} placeholder="ABC-1D23" /></label><label>Frete padrão (R$) *<input name="defaultFare" type="number" min="0" step="0.01" defaultValue={editing.defaultFare ?? 1000} required /></label><label>CPF<input name="cpf" defaultValue={editing.cpf || ''} placeholder="000.000.000-00" /></label><label>Chave PIX<input name="pix" defaultValue={editing.pix || ''} placeholder="Chave PIX" /></label><label>Banco<input name="bank" defaultValue={editing.bank || ''} placeholder="Nome do banco" /></label><label>Tipo de conta<input name="accountType" defaultValue={editing.accountType || ''} placeholder="Corrente ou poupança" /></label><label>Agência<input name="branch" defaultValue={editing.branch || ''} placeholder="Número da agência" /></label><label>Conta<input name="account" defaultValue={editing.account || ''} placeholder="Número da conta" /></label></div>
      <div className="form-actions"><span><span className="status-dot amber" /> {cloudConfigured ? 'Os dados serão salvos na nuvem.' : 'Demonstração local: os dados não vão para a nuvem.'}</span><button className="button primary" type="submit"><Check size={16} /> {editing.name ? 'Salvar alterações' : 'Salvar motorista'}</button></div>
    </form></section>}
    <section className="panel drivers-panel"><div className="panel-heading"><div><h2>Motoristas cadastrados <span className="subtle-count">{drivers.length}</span></h2><p>Use Editar para corrigir. Excluir um motorista também apaga tickets e fechamentos dele.</p></div><label className="search-box driver-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar motorista" /></label></div><div className="driver-list">{visible.map((driver) => <article className="driver-row" key={driver.id || driver.name}><div className="driver-avatar">{driver.name.slice(0, 2).toUpperCase()}</div><div className="driver-main"><strong>{driver.name}</strong><span>Placa {driver.plate || 'não informada'} · {driver.bank || 'Banco não informado'} · PIX {driver.pix || 'não informada'}</span><small>{driver.cpf || 'CPF não informado'} · {driver.accountType || 'Tipo de conta não informado'} · Agência {driver.branch || '—'} · Conta {driver.account || '—'}</small></div><div className="driver-actions"><button className="button secondary small-button" onClick={() => setEditing(driver)}><Pencil size={13} /> Editar</button><button className="button delete-button small-button" onClick={() => onDelete(driver)}><Trash2 size={13} /> Excluir</button></div></article>)}</div>{visible.length === 0 && <div className="empty-state">Nenhum motorista encontrado.</div>}</section>
  </>;
}
