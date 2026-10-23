import { normalizeRecipients } from './email-recipients.js';

const encoder = new TextEncoder();
const quote = (value) => '"' + String(value).replace(/"/g, '""').replace(/[\r\n\u0000]/g, ' ') + '"';
const assignment = (name, value) => {
  const statements = [`${name} = ""`];
  String(value).split(/\r?\n/).forEach((line, index) => {
    if (index) statements.push(`${name} = ${name} & vbCrLf`);
    for (let i = 0; i < line.length; i += 240) statements.push(`${name} = ${name} & ${quote(line.slice(i, i + 240))}`);
  });
  return statements.join('\r\n');
};
export function outlookScript({ to, cc, subject, body, filename }) {
  const recipients = normalizeRecipients(to, cc);
  if (!recipients.to.length) throw new Error('Informe pelo menos um destinatário no campo Para.');
  if (!subject.trim()) throw new Error('Preencha o assunto do e-mail.');
  return `Option Explicit
On Error Resume Next
Dim fs, base, pdf, app, mail, inspector, doc, entry, text
Set fs = CreateObject("Scripting.FileSystemObject")
base = fs.GetParentFolderName(WScript.ScriptFullName)
pdf = fs.BuildPath(base, ${quote(filename)})
If Not fs.FileExists(pdf) Then
  MsgBox "Extraia todos os arquivos do ZIP para uma pasta e abra novamente. O PDF deve ficar junto deste arquivo.", 48, "Fechamento de frete"
  WScript.Quit 1
End If
Err.Clear
Set app = CreateObject("Outlook.Application")
If Err.Number <> 0 Then
  MsgBox "Nao foi possivel abrir o Outlook classico. Confira se ele esta instalado e configurado neste computador.", 48, "Fechamento de frete"
  WScript.Quit 1
End If
Set mail = app.CreateItem(0)
${assignment('mail.To', recipients.to.join('; '))}
${assignment('mail.CC', recipients.cc.join('; '))}
${assignment('mail.Subject', subject)}
If Err.Number <> 0 Then
  MsgBox "Nao foi possivel preparar os destinatarios: " & Err.Description, 48, "Fechamento de frete"
  WScript.Quit 1
End If
mail.Display
WScript.Sleep 500
Set inspector = mail.GetInspector
Set doc = inspector.WordEditor
If Err.Number <> 0 Then
  MsgBox "O Outlook abriu, mas nao foi possivel inserir a mensagem. Nenhum envio foi realizado. Feche esta mensagem e tente novamente.", 48, "Fechamento de frete"
  WScript.Quit 1
End If
${assignment('text', body + '\n\n')}
Set entry = doc.Range(0, 0)
entry.InsertBefore text
mail.Save
mail.Attachments.Add pdf, 1
mail.Save
If Err.Number <> 0 Then
  MsgBox "Confira a mensagem e o anexo antes de enviar. O Outlook informou: " & Err.Description, 48, "Fechamento de frete"
  WScript.Quit 1
End If
inspector.Activate
WScript.Quit 0
`.replace(/\r?\n/g, '\r\n');
}

function utf16(value) {
  const bytes = new Uint8Array(2 + value.length * 2);
  bytes[0] = 255; bytes[1] = 254;
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < value.length; i++) view.setUint16(2 + i * 2, value.charCodeAt(i), true);
  return bytes;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
// Stored ZIP entries keep the PDF intact and need no external compression service.
export function zipFiles(files) {
  const chunks = [], central = [];
  let offset = 0, centralSize = 0;
  for (const file of files) {
    const name = encoder.encode(file.name), bytes = file.bytes, crc = crc32(bytes);
    const local = new Uint8Array(30), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x800, true);
    l.setUint16(12, 0x21, true);
    l.setUint32(14, crc, true); l.setUint32(18, bytes.length, true); l.setUint32(22, bytes.length, true); l.setUint16(26, name.length, true);
    const header = new Uint8Array(46), h = new DataView(header.buffer);
    h.setUint32(0, 0x02014b50, true); h.setUint16(4, 20, true); h.setUint16(6, 20, true); h.setUint16(8, 0x800, true);
    h.setUint16(14, 0x21, true);
    h.setUint32(16, crc, true); h.setUint32(20, bytes.length, true); h.setUint32(24, bytes.length, true); h.setUint16(28, name.length, true); h.setUint32(42, offset, true);
    chunks.push(local, name, bytes); central.push(header, name);
    offset += local.length + name.length + bytes.length; centralSize += header.length + name.length;
  }
  const end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, files.length, true); view.setUint16(10, files.length, true); view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}
export async function buildOutlookPackage({ pdf, filename, ...message }) {
  const script = outlookScript({ ...message, filename });
  return zipFiles([
    { name: filename, bytes: new Uint8Array(await pdf.arrayBuffer()) },
    { name: 'Abrir_no_Outlook.vbs', bytes: utf16(script) },
    { name: 'COMO_ABRIR.txt', bytes: encoder.encode('1. Extraia TODOS os arquivos do ZIP para uma pasta.\r\n2. Abra Abrir_no_Outlook.vbs no Windows com Outlook classico instalado.\r\n3. Confira Para, CC, assinatura, texto e PDF em anexo. Clique em Enviar no Outlook.\r\n4. Volte ao app e confirme que ja enviou.\r\n\r\nEste arquivo somente prepara a mensagem; nao envia automaticamente.\r\nSe o Windows ou a empresa bloquear scripts VBS, use o PDF e preencha a mensagem manualmente. Nao altere as protecoes do computador.\r\n') },
  ]);
}
