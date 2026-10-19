# Conectar o DDE Fretes à nuvem

O aplicativo usa Supabase para login, banco de dados e atualização em tempo real. Os dados bancários dos motoristas ficam protegidos por login e políticas de acesso no banco.

## 1. Criar o projeto

Crie um projeto Supabase. No painel do projeto, abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e execute uma vez.

Se o projeto já foi configurado antes, execute também `supabase/ticket_scans_migration.sql` uma vez. Ela cria o armazenamento privado e os campos para associar cada comprovante ao ticket. Para habilitar a exclusão de fechamentos somente pelo administrador, execute `supabase/admin_closure_delete_migration.sql`; a primeira conta criada no Supabase recebe esse papel automaticamente. Para escolher manualmente os tickets de cada fechamento e permitir a edição administrativa, execute depois `supabase/closure_manual_selection_edit_migration.sql`. Para incluir o frete padrão no cadastro de motorista, execute `supabase/driver_default_fare_migration.sql`; motoristas existentes começam com R$ 1.000,00 e os dados de tickets e fechamentos não são alterados.

Para permitir a edição completa de tickets ainda não solicitados, execute `supabase/ticket_full_edit_migration.sql` depois de `supabase/closure_manual_selection_edit_migration.sql`. Tickets de fechamentos já solicitados ficam bloqueados para edição.

Para registrar o histórico de alterações dos tickets e exibi-lo nos detalhes, execute `supabase/ticket_edit_history_migration.sql`.

Para ativar o painel compartilhável, execute `supabase/dashboard_share_migration.sql` depois de `admin_closure_delete_migration.sql` e, em seguida, `supabase/shared_driver_summary_migration.sql`. O painel mostra indicadores e comparações agregadas por motorista — entregas, peso e valor — sem exibir dados bancários, observações ou comprovantes. O link pode ser desativado em **Minha conta**.

Para liberar contas de operador, execute `supabase/operator_accounts_migration.sql` **por último**, depois das outras migrações. Ela restringe no banco as alterações de tickets, motoristas e fechamentos para que operadores só possam lançar tickets, gerar fechamentos e marcar solicitações.

Depois publique a função `supabase/functions/operator-admin` com o Supabase CLI (`supabase functions deploy operator-admin --project-ref ID_DO_PROJETO`). A função usa as variáveis secretas padrão do Supabase e não exige colocar a chave `service_role` no aplicativo. Ela é necessária para criar a conta ao aceitar um convite e para excluir de verdade uma conta. O convite gerado em **Minha conta > Acessos de operadores** expira em 7 dias e só pode ser usado uma vez.

## 2. Criar o acesso

Em Authentication, desative o cadastro público de usuários e crie/invite somente a conta que você vai usar no aplicativo. O login será feito com e-mail e senha dessa conta. Assim, qualquer pessoa que encontrar o link do site não consegue ler seus dados.

## 3. Configurar o aplicativo

Copie `.env.example` para `.env.local` e preencha a URL do projeto e a chave **Publishable** encontrada nas configurações/API do Supabase:

```text
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Reinicie o servidor local. Quando o projeto estiver conectado, a tela de login passará a validar a conta na nuvem. O aplicativo só confirma cada lançamento depois que o banco responder; alterações feitas em outro aparelho aparecem por atualização em tempo real.

## 4. Colocar no ar

`localhost` funciona só neste computador. Para abrir em outros dispositivos, publique a pasta do aplicativo em uma hospedagem de sites e cadastre nela as mesmas duas variáveis do `.env.local`. Use o endereço publicado para acessar no celular ou em outro computador.

Não coloque no aplicativo uma chave `secret` ou `service_role`; elas dão acesso administrativo amplo ao banco. Use apenas a chave Publishable com as regras do SQL aplicadas.

## Enquanto não configurar

Sem essas credenciais, o aplicativo continua em modo demonstração local. Os exemplos não são salvos nem compartilhados entre dispositivos. Os dados reais só devem ser lançados depois da conexão e do login na nuvem.
