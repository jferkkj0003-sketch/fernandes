using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: System.Reflection.AssemblyTitle("DDE Fretes - Outlook")]
[assembly: System.Reflection.AssemblyProduct("DDE Fretes - Outlook")]
[assembly: System.Reflection.AssemblyCompany("DDE Fretes")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.0.1.0")]

internal static class Program
{
    const string Scheme = "dde-fretes-outlook";
    const string Origin = "https://dde-fretes.vercel.app";
    const string Title = "DDE Fretes - Outlook";
    const int MaxBody = 100 * 1024 * 1024;
    static readonly string InstallFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DDE Fretes", "Outlook");
    static readonly string InstallExe = Path.Combine(InstallFolder, "DDE-Outlook.exe");
    static readonly string ProtocolKey = @"Software\Classes\" + Scheme;
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = MaxBody };

    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            if (args.Length == 1 && args[0] == "--self-test") { SelfTest(); return 0; }
            if (args.Length == 1 && args[0] == "--uninstall") { Uninstall(); return 0; }
            if (args.Length == 1 && args[0].StartsWith(Scheme + ":", StringComparison.OrdinalIgnoreCase))
            {
                Uri uri = new Uri(args[0]);
                string token; int port;
                ParseLaunch(uri, out token, out port);
                Serve(token, port);
                return 0;
            }
            if (args.Length == 0 || (args.Length == 1 && args[0] == "--install")) { Install(); return 0; }
            throw new Exception("Comando não reconhecido. Abra o auxiliar pelo botão do app.");
        }
        catch (Exception ex)
        {
            if (args.Length == 1 && args[0] == "--self-test") return 1;
            MessageBox.Show(ex.Message, Title, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 1;
        }
    }

    static void Install()
    {
        if (MessageBox.Show("Instalar o auxiliar do DDE Fretes para abrir os fechamentos no Outlook deste computador?\n\nEle recebe o PDF somente do app dde-fretes.vercel.app e prepara um rascunho. Nenhum e-mail é enviado automaticamente. Não exige senha nem acesso de administrador.", Title, MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
        Directory.CreateDirectory(InstallFolder);
        string current = Process.GetCurrentProcess().MainModule.FileName;
        if (!String.Equals(current, InstallExe, StringComparison.OrdinalIgnoreCase)) File.Copy(current, InstallExe, true);
        using (RegistryKey key = Registry.CurrentUser.CreateSubKey(ProtocolKey))
        {
            key.SetValue("", "URL:DDE Fretes Outlook"); key.SetValue("URL Protocol", "");
            using (RegistryKey icon = key.CreateSubKey("DefaultIcon")) icon.SetValue("", "\"" + InstallExe + "\",0");
            using (RegistryKey command = key.CreateSubKey(@"shell\open\command")) command.SetValue("", "\"" + InstallExe + "\" \"%1\"");
        }
        using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\DDEFretesOutlook"))
        {
            key.SetValue("DisplayName", Title); key.SetValue("DisplayVersion", "1.0.1");
            key.SetValue("Publisher", "DDE Fretes"); key.SetValue("InstallLocation", InstallFolder);
            key.SetValue("UninstallString", "\"" + InstallExe + "\" --uninstall");
            key.SetValue("NoModify", 1); key.SetValue("NoRepair", 1);
        }
        MessageBox.Show("Instalação concluída.\n\nVolte ao app, clique em Enviar no e-mail e depois em Abrir no Outlook. Autorize a abertura do auxiliar e o acesso ao computador local se o navegador solicitar.\n\nPara remover a integração, use Aplicativos do Windows: DDE Fretes - Outlook.", Title, MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    static void Uninstall()
    {
        if (MessageBox.Show("Remover a integração do DDE Fretes com o Outlook? Os PDFs e os rascunhos serão preservados.", Title, MessageBoxButtons.YesNo) != DialogResult.Yes) return;
        using (RegistryKey key = Registry.CurrentUser.OpenSubKey(ProtocolKey + @"\shell\open\command"))
        {
            string command = key == null ? "" : Convert.ToString(key.GetValue(""));
            if (!command.Contains(InstallExe)) throw new Exception("O protocolo não pertence a esta instalação. Nenhuma alteração foi feita.");
        }
        Registry.CurrentUser.DeleteSubKeyTree(ProtocolKey, false);
        Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\DDEFretesOutlook", false);
        MessageBox.Show("Integração removida. Seus PDFs e mensagens foram preservados.", Title);
    }

    static void ParseLaunch(Uri uri, out string token, out int port)
    {
        var query = HttpUtility.ParseQueryString(uri.Query);
        token = query["token"];
        if (uri.Scheme != Scheme || uri.Host != "compose" || !Regex.IsMatch(token ?? "", "^[a-f0-9]{64}$") || !int.TryParse(query["port"], out port) || port < 49152 || port > 65535)
            throw new Exception("Pedido inválido. Use o botão Enviar no e-mail no app.");
    }

    static void Serve(string token, int port)
    {
        var listener = new TcpListener(IPAddress.Loopback, port);
        listener.Start(8);
        DateTime expires = DateTime.UtcNow.AddMinutes(3);
        bool composed = false;
        string completedId = null;
        try
        {
            while (DateTime.UtcNow < expires)
            {
                if (!listener.Pending()) { Thread.Sleep(75); continue; }
                using (TcpClient client = listener.AcceptTcpClient())
                using (NetworkStream stream = client.GetStream())
                {
                    client.ReceiveTimeout = 30000; client.SendTimeout = 30000;
                    stream.ReadTimeout = 30000; stream.WriteTimeout = 30000;
                    try
                    {
                        Request request = ReadRequest(stream);
                        bool allowed = request.Header("Origin") == Origin && request.Header("Host") == "127.0.0.1:" + port;
                        if (!allowed) { Reply(stream, 403, "{\"error\":\"Origem não autorizada.\"}", false); continue; }
                        if (request.Method == "OPTIONS") { Reply(stream, 204, "", true); continue; }
                        if (request.Header("X-DDE-Token") != token) { Reply(stream, 403, "{\"error\":\"Pedido não autorizado.\"}", true); continue; }
                        if (request.Method == "GET" && request.Path == "/health")
                        { Reply(stream, 200, "{\"app\":\"dde-outlook\",\"version\":1}", true); continue; }
                        if (request.Method != "POST" || request.Path != "/compose") { Reply(stream, 404, "{}", true); continue; }
                        if (!request.Header("Content-Type").StartsWith("application/json", StringComparison.OrdinalIgnoreCase)) throw new Exception("Formato inválido.");
                        var job = Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(request.Body));
                        string id = Field(job, "id", 64);
                        if (id != token) throw new Exception("Identificador inválido.");
                        if (composed && id == completedId) { Reply(stream, 200, "{\"opened\":true}", true); continue; }
                        if (composed) throw new Exception("Esta solicitação já foi usada.");
                        // Consume before COM automation: a failed response must never cause an automatic duplicate.
                        completedId = id; composed = true;
                        OpenOutlook(job);
                        expires = DateTime.UtcNow.AddSeconds(20);
                        Reply(stream, 200, "{\"opened\":true}", true);
                    }
                    catch (Exception ex)
                    {
                        try { Reply(stream, 500, Json.Serialize(new { error = ex.Message }), true); } catch { }
                        if (composed) break;
                    }
                }
            }
        }
        finally { listener.Stop(); }
    }

    static string Field(Dictionary<string, object> job, string name, int max)
    {
        object value;
        if (!job.TryGetValue(name, out value) || !(value is string) || ((string)value).Length > max) throw new Exception("Campo inválido: " + name);
        return (string)value;
    }
    static string Addresses(string value, bool required)
    {
        var list = new List<string>();
        foreach (string item in value.Split(';'))
        {
            string address = item.Trim(); if (address.Length == 0) continue;
            if (!Regex.IsMatch(address, @"^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$")) throw new Exception("Confira o destinatário: " + address);
            list.Add(address);
        }
        if (required && list.Count == 0) throw new Exception("Informe pelo menos um destinatário.");
        return String.Join("; ", list);
    }

    static void OpenOutlook(Dictionary<string, object> job)
    {
        string to = Addresses(Field(job, "to", 10000), true), cc = Addresses(Field(job, "cc", 10000), false);
        string subject = Field(job, "subject", 1000), body = Field(job, "body", 100000);
        string filename = Field(job, "filename", 180);
        if (subject.Trim().Length == 0 || subject.Contains("\r") || subject.Contains("\n")) throw new Exception("Confira o assunto do e-mail.");
        if (!filename.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) || filename.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || Path.GetFileName(filename) != filename) throw new Exception("Nome do PDF inválido.");
        byte[] pdf = Convert.FromBase64String(Field(job, "pdf", 90 * 1024 * 1024));
        if (pdf.Length < 5 || Encoding.ASCII.GetString(pdf, 0, 5) != "%PDF-") throw new Exception("O arquivo recebido não é um PDF válido.");
        string folder = Path.Combine(InstallFolder, "Rascunhos", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        string path = Path.Combine(folder, filename);
        File.WriteAllBytes(path, pdf);
        Type outlook = Type.GetTypeFromProgID("Outlook.Application");
        if (outlook == null) throw new Exception("O Outlook clássico não foi encontrado. Instale e configure o Outlook neste computador.");
        dynamic app = Activator.CreateInstance(outlook);
        dynamic mail = app.CreateItem(0);
        mail.To = to; mail.CC = cc; mail.Subject = subject;
        mail.Display(false);
        dynamic inspector = mail.GetInspector;
        dynamic doc = null;
        for (int i = 0; i < 40; i++)
        {
            try { doc = inspector.WordEditor; if (doc != null) break; } catch { }
            Application.DoEvents(); Thread.Sleep(100);
        }
        if (doc == null) throw new Exception("O Outlook abriu, mas não foi possível preparar o texto. Confira a mensagem antes de tentar novamente.");
        // Insert before the existing signature; do not replace HTMLBody or its embedded logo.
        doc.Range(0, 0).InsertBefore(body.Replace("\r\n", "\n").Replace("\n", "\r\n") + "\r\n\r\n");
        mail.Save(); mail.Attachments.Add(path, 1, Type.Missing, Type.Missing); mail.Save();
        inspector.Activate();
    }

    sealed class Request
    {
        public string Method, Path;
        public byte[] Body;
        public Dictionary<string, string> Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        public string Header(string key) { string value; return Headers.TryGetValue(key, out value) ? value : ""; }
    }
    static Request ReadRequest(Stream stream)
    {
        var header = new List<byte>();
        while (header.Count < 16384)
        {
            int value = stream.ReadByte(); if (value < 0) throw new IOException("Pedido incompleto.");
            header.Add((byte)value);
            int n = header.Count;
            if (n >= 4 && header[n-4] == 13 && header[n-3] == 10 && header[n-2] == 13 && header[n-1] == 10) break;
        }
        if (header.Count >= 16384) throw new Exception("Cabeçalho muito grande.");
        string[] lines = Encoding.ASCII.GetString(header.ToArray()).Split(new[] { "\r\n" }, StringSplitOptions.None);
        string[] first = lines[0].Split(' ');
        if (first.Length != 3) throw new Exception("Pedido inválido.");
        var request = new Request { Method = first[0], Path = first[1] };
        foreach (string line in lines)
        { int colon = line.IndexOf(':'); if (colon > 0) request.Headers[line.Substring(0, colon)] = line.Substring(colon + 1).Trim(); }
        int length = 0;
        string raw = request.Header("Content-Length");
        if (raw.Length > 0 && (!Int32.TryParse(raw, out length) || length < 0 || length > MaxBody)) throw new Exception("O PDF é muito grande para preparar este e-mail.");
        if (request.Header("Transfer-Encoding").Length > 0) throw new Exception("Formato de transferência não suportado.");
        request.Body = new byte[length];
        for (int offset = 0; offset < length; )
        { int read = stream.Read(request.Body, offset, length - offset); if (read <= 0) throw new IOException("Transferência interrompida."); offset += read; }
        return request;
    }
    static void Reply(Stream stream, int status, string body, bool cors)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(body);
        string headers = "HTTP/1.1 " + status + " " + (status == 200 ? "OK" : status == 204 ? "No Content" : "Error") + "\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: " + bytes.Length + "\r\nConnection: close\r\nCache-Control: no-store\r\n";
        if (cors) headers += "Access-Control-Allow-Origin: " + Origin + "\r\nVary: Origin\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, X-DDE-Token\r\nAccess-Control-Allow-Private-Network: true\r\n";
        byte[] head = Encoding.ASCII.GetBytes(headers + "\r\n"); stream.Write(head, 0, head.Length); stream.Write(bytes, 0, bytes.Length); stream.Flush();
    }
    static void SelfTest()
    {
        string token; int port;
        ParseLaunch(new Uri(Scheme + "://compose?token=" + new string('a', 64) + "&port=54321"), out token, out port);
        if (port != 54321 || token.Length != 64) throw new Exception("Launch validation failed");
        foreach (string bad in new[] { Scheme + "://compose?token=x&port=54321", Scheme + "://other?token=" + new string('a',64) + "&port=54321", Scheme + "://compose?token=" + new string('a',64) + "&port=80" })
        { bool rejected = false; try { ParseLaunch(new Uri(bad), out token, out port); } catch { rejected = true; } if (!rejected) throw new Exception("Unsafe launch accepted"); }
        if (Addresses("a@example.com; b@example.com", true) != "a@example.com; b@example.com") throw new Exception("Addresses failed");
        bool invalid = false; try { Addresses("bad", true); } catch { invalid = true; } if (!invalid) throw new Exception("Invalid address accepted");
        byte[] raw = Encoding.ASCII.GetBytes("POST /compose HTTP/1.1\r\nHost: 127.0.0.1:54321\r\nContent-Length: 2\r\n\r\n{}");
        Request request = ReadRequest(new MemoryStream(raw));
        if (request.Body.Length != 2 || request.Path != "/compose") throw new Exception("HTTP parsing failed");
    }
}
