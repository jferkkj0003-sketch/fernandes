# Auxiliar DDE Fretes para Outlook clássico

Requer Windows, .NET Framework 4.x e Outlook clássico configurado. Foi desenvolvido para preservar a assinatura criada pelo Outlook, inclusive imagens, inserindo a mensagem antes dela no WordEditor. Não chama Send e não altera as credenciais do Outlook.

A versão 1.0.2 usa o nome do motorista e a data recebidos do fechamento, formata a data de pagamento e inclui o link existente do painel de consulta quando informado. Para exibir o rascunho, transfere a ativação ao Outlook e restaura/eleva somente a janela dessa mensagem. A elevação temporária é removida imediatamente; não altera configurações globais de foco do Windows. A exibição em primeiro plano ainda deve ser conferida no Outlook do usuário.

## Instalar uma vez

No app: Enviar no e-mail → Instalar auxiliar (uma vez). Execute DDE-Outlook.exe e confirme a instalação. Registra `dde-fretes-outlook` somente no usuário atual do Windows e copia o executável para `%LOCALAPPDATA%\DDE Fretes\Outlook`. Não usa tarefas agendadas, inicialização automática ou serviço do Windows.

Depois: Abrir no Outlook → autorize a abertura do auxiliar e o acesso local solicitado pelo navegador → confira e envie no Outlook → confirme o envio no app. O navegador pode lembrar as permissões conforme suas configurações. O app não pode eliminar os pedidos de autorização do navegador.

Para remover: Aplicativos do Windows → DDE Fretes - Outlook. A remoção desfaz o protocolo e preserva os PDFs e rascunhos.

## Comunicação

O protocolo recebe somente uma porta temporária e um código aleatório de 256 bits. O processo escuta exclusivamente em 127.0.0.1, exige esse código e o Origin exato `https://dde-fretes.vercel.app`, e encerra após o uso ou três minutos sem uso. Não há download remoto pelo auxiliar. O PDF é recebido diretamente do app e anexado por valor; nenhum token do Supabase é entregue ao programa. O app faz apenas um POST por pedido para evitar duplicações após perda de resposta.

O endpoint `/health` informa a disponibilidade. `/compose` valida destinatários, assunto, nome e assinatura de arquivo PDF antes de abrir o Outlook. Os PDFs ficam em `%LOCALAPPDATA%\DDE Fretes\Outlook\Rascunhos`, em subpastas exclusivas. O nome recebido nunca é usado como caminho arbitrário.

## Compilar e verificar

Execute `build.ps1` no PowerShell. O binário e a origem são mantidos no repositório; o binário está em `public/outlook/DDE-Outlook.exe` para instalação pelo app. `DDE-Outlook.exe --self-test` testa os validadores e o parser HTTP sem instalar ou abrir mensagens. O executável não possui assinatura digital de publicação; políticas corporativas podem exigir aprovação de TI.

Os testes automatizados de rede usam somente health, origem, código temporário, preflight e PDF inválido. A composição real e a assinatura precisam de uma verificação no Outlook do usuário. A alternativa ZIP continua disponível no app.
