# Execução com Claude, Codex e AGY

O Studio usa os programas oficiais instalados. A conexão é por login local, sem formulário
de API key. A tela **Conexões → Provedores** verifica as instalações e permite abrir o login oficial
no Terminal do macOS. No Codex, `codex login status` verifica o login ChatGPT. No AGY,
a presença do cache OAuth é indicada como login encontrado; a validade é confirmada pelo
programa ao executar. O app não exibe nem copia o conteúdo desse cache.

As versões locais usadas para conferir os argumentos foram Codex CLI 0.162.1 e a ajuda do AGY instalado. O app não distribui esses executores. O login pelo Terminal é integrado no macOS;
em outros sistemas, a interface informa o comando para execução manual.

## Envio e retomada

- Claude: mantém o SDK oficial, perfis Pro/Max, permissões e fallback existentes.
- Codex: `codex exec --json`, com prompt por stdin. Continua a conversa com
  `codex exec resume <id> --json`.
- AGY: `agy --input-format stream-json --output-format stream-json --dangerously-skip-permissions`, com um evento NDJSON `user` por stdin.
  Continua com `--conversation <id>`. Os eventos `init`, `step_update` e `result` alimentam o monitor.

O contexto do projeto inclui `CLAUDE.md` e seus imports locais, preservando as instruções
nativas que cada programa já carrega. Esse contexto só é reenviado se mudar ou se a
conversa for nova. Comandos `/skill argumentos` do projeto são resolvidos pelo Studio e
encaminhados como instruções da skill com a origem e os argumentos. As definições dos
agentes e skills são adaptadas ao formato nativo antes de iniciar.

Cada combinação projeto/provedor conserva mensagens, agentes, métricas, identificador de
sessão e preferência de modelo/esforço. Alternar o executor restaura sua conversa própria.
A troca manual não copia transcripts entre provedores. Durante fallback, o Studio prepara contexto parcial com a solicitação, mensagens recentes, tarefas e atividade observada; a interface identifica a continuidade e mantém o identificador de sessão do novo programa separado. O fallback entre contas continua dentro do Claude. O fallback entre provedores é configurável por projeto em **Conexões → Fallback e equipe**, inicialmente Claude → Codex → AGY. A lista
**Sessões existentes** continua mostrando sessões externas Claude; Codex/AGY retomam
as conversas iniciadas pelo Studio.

## Modelos e permissões

No Codex/AGY, deixe o modelo vazio para usar a configuração local do programa ou
informe um identificador explícito. Codex recebe o esforço escolhido em
`model_reasoning_effort`; o suporte depende do modelo. AGY recebe o esforço pelo argumento `--effort`; a ajuda local aceita low, medium, high, xhigh e max, conforme suporte do modelo.

Codex usa `--dangerously-bypass-approvals-and-sandbox`, sem confirmações e sem sandbox. AGY usa `--dangerously-skip-permissions`, aprovando as ferramentas; o sandbox do AGY continua conforme a configuração nativa. As mesmas opções são usadas no principal e nos workers Studio. Regras e hooks exclusivos de `.claude/settings.json` não são convertidos automaticamente em regras de outros programas.

Variáveis de API de outros provedores são removidas do ambiente herdado. Configurações
nativas e arquivos do projeto continuam sob controle do usuário; o app não reescreve suas
credenciais. Erros de processo são filtrados para não registrar tokens ou API keys óbvios.

## Monitoramento e limites

Ferramentas, mensagens, resultados, erros e uso são normalizados a partir dos eventos JSONL.
Uma ferramenta não vira um agente no canvas. No AGY, `subagent_info` identifica os subagentes observados. As ferramentas usam os passos `tool` e o chat concatena `text_delta`, usando a resposta final como texto definitivo. No Codex, os eventos de colaboração expostos
pelo programa identificam os agentes; versões que omitirem parte desses eventos não
permitem ao monitor reconstruir todos os detalhes. Instruções internas e raciocínio privado
não são inventados nem apresentados como observados.

Codex informa totais do turno; AGY informa totais da execução. Esses totais não são
usados como tamanho atual da janela de contexto, nem como cota da assinatura. Saldo e
reset de conta ficam indisponíveis se o programa não os informar. A telemetria é separada
por provedor e sessão, evitando misturar métricas mesmo se houver IDs iguais.

Interromper encerra o processo em execução. Erros e saídas sem confirmação de conclusão
mantêm o histórico e mostram falha; não há nova tentativa automática que duplique ações.

## Validação

Os testes usam processos Node reais como executores simulados para verificar streaming,
ferramentas, agentes, retomada, cancelamento, falhas, preservação de arquivos e isolamento.
Os programas oficiais instalados foram usados para validar argumentos e configuração
local, sem enviar prompts. A interface Electron foi exercitada com conexões simuladas.
Nenhuma tarefa de modelo foi executada nas contas do usuário durante a implementação.

Referências oficiais: [Codex não interativo](https://developers.openai.com/codex/noninteractive),
[agentes Codex](https://developers.openai.com/codex/subagents/),
[AGY headless](https://antigravity.google/docs/cli/headless/),
[login AGY](https://antigravity.google/docs/install/),
[agentes AGY](https://antigravity.google/docs/subagents/),
[permissões Codex](https://learn.chatgpt.com/docs/developer-commands).


## Equipe com provedores mistos

Em **Conexões**, as abas **Provedores**, **Contas** e **Fallback e equipe**
reúnem a configuração que antes ficava em dois menus. Um provedor é o programa usado
para executar; as contas são os logins usados por essa conexão. O Studio continua com
múltiplas contas Claude, Codex e AGY com os logins dos programas oficiais.

A ordem de fallback vale por projeto e só percorre conexões disponíveis. O Claude tenta
primeiro as outras contas habilitadas, quando o fallback de contas está ativo. Limites de
cota permitem avançar para Codex/AGY; erros comuns de rede ou ferramenta não provocam
reexecução automática em outro provedor. Cada provedor é tentado no máximo uma vez por
envio. O provedor efetivo fica sinalizado no chat e continua nessa conversa até iniciar
uma nova ou escolher outra conversa. O preferido não é alterado silenciosamente.

A continuidade contém apenas uma parte do histórico e pede ao próximo agente para conferir
arquivos e resultados antes de agir. Isso reduz repetição, mas não garante execução
exatamente uma vez de efeitos externos. Se o contexto não bastar, o agente deve perguntar.
Credenciais não são transferidas e identificadores não são reutilizados entre programas.

Os papéis podem ter provedor/modelo próprios. **Agentes → Criar agente** também permite
uma tarefa pontual com escolha explícita. O principal recebe as ferramentas MCP locais
`studio_spawn_agent`, `studio_agents` e `studio_wait_agents`. A tarefa usa um processo ou
sessão do programa escolhido, com as instruções do papel e o contexto do projeto. O
resultado volta ao principal pela ferramenta e os detalhes ficam no canvas/inspetor.

As tarefas Studio têm limite configurável de 1 a 6 em paralelo (padrão 3), com até 24
criações por envio principal. Esses limites não substituem os controles nativos dos
programas. Novas tarefas não são criadas recursivamente pela ponte em workers gerenciados.
O cancelamento encerra a tarefa; mudar de projeto ou conversa é bloqueado enquanto a
equipe trabalha. Cada worker mantém seu histórico isolado e o modelo/provedor efetivo
observado no inspetor.

A ponte fica em 127.0.0.1, exige uma credencial aleatória temporária, rejeita Origin de
navegador e fecha ao terminar o envio. Codex e Claude recebem a conexão somente para a
invocação. AGY descobre uma entrada temporária e exclusiva em `.agents/mcp_config.json`, com `serverUrl` e header de autorização. A entrada é removida ao encerrar; conexões e edições do usuário são preservadas. Links simbólicos e JSON inválido são recusados. Não há edição de credenciais.

A compatibilidade da ponte foi conferida com o cliente MCP real do Claude Code usando
somente inicialização e consulta de conexão, sem prompt. Os cenários de delegação e
fallback usam executores simulados nos testes; nenhuma tarefa foi enviada às contas.

## Onde fica a statusline

`Studio | modelo | contexto | etapa | agentes` aparece no rodapé do Claude Code no
terminal. Dentro do Studio, os mesmos dados públicos alimentam **Visão do projeto** e os
indicadores de execução. Não existe uma barra fixa idêntica no app. Codex e AGY usam
seus eventos para o monitor; o script de statusline do terminal é instalado para Claude.

## Migração para AGY

O identificador interno `gemini` permanece para conservar as rotas por projeto e as preferências existentes; a conexão usa exclusivamente o executável `agy` (override `STUDIO_AGY_PATH`). O cache verificado por metadados é `~/.gemini/antigravity-cli/antigravity-oauth-token`; sua existência não comprova validade do login. O app não lê seu conteúdo.

IDs antigos do Gemini CLI são arquivados em `legacyNativeSessions`, sem enviá-los ao AGY. O histórico visível é preservado e o primeiro envio prepara contexto parcial em uma nova conversa do AGY. As definições são exportadas para `.agents/agents/studio_*.md` e `.agents/skills/studio-agy-*/SKILL.md`. O manifesto permite retirar somente arquivos antigos gerenciados que não foram personalizados.

## Comandos e interrupção

O menu de slash commands fica visível acima do campo, lista todas as skills indexadas e atualiza o índice enquanto aberto. Falhas de listagem aparecem no chat. No Claude, saídas `local_command_output` e avisos `informational` são renderizados no histórico. `/architecture-review` foi encontrado no índice real do projeto; envio e visibilidade foram exercitados com execução simulada, sem rodar a revisão real.

Ao clicar em parar, o botão passa imediatamente para **Interrompendo…** e fica desabilitado. O estado só termina após encerrar o envio e os processos; a solicitação de cancelamento também alcança tarefas Studio e perguntas pendentes.

## Contas nativas e limites — 0.2.0

A antiga limitação de uma única conta Codex/AGY foi substituída por perfis em
Conexões → Contas. Novos perfis Codex recebem CODEX_HOME próprio com
cli_auth_credentials_store=file. Novos perfis AGY recebem HOME/USERPROFILE e
ANTIGRAVITY_EXECUTABLE_DATA_DIR próprios. O login oficial cria suas credenciais;
o Studio só guarda o registro do perfil e os dados de uso permitidos na interface.

Codex é consultado via app-server, com initialize, initialized, account/read e
account/rateLimits/read, sem abrir thread ou enviar prompt. AGY é consultado com
`agy -p /usage --output-format json`; a resposta deve ser um comando nativo de uso,
SUCCESS e num_turns=0. São lidos grupos/buckets e remaining_fraction/reset_time.
Saldo, renovação e janelas são exibidos apenas conforme retornados. Os totais de
tokens de execuções permanecem separados da cota de assinatura.

O login por Terminal é assistido no macOS. No Windows, o Studio abre PowerShell
com o perfil correspondente; em Linux, informa o comando de terminal. O usuário
conclui o login no programa oficial e clica em verificar. Há atualização periódica
e após execuções, com deduplicação e preservação da última leitura em falhas.

No limite, o Studio tenta outra conta habilitada do mesmo provedor antes do
fallback entre provedores. A troca não reutiliza IDs de outro perfil: inicia nova
sessão com contexto parcial e mantém uma só solicitação visível. Codex usa espera
por conta; AGY mantém espera pelo modelo que atingiu o limite, pois há grupos
independentes de quota. Não existe promessa de execução exatamente uma vez.

Validação: quotas reais de Codex/AGY, perfil vazio AGY sem autenticação e testes
simulados de rotação, isolamento e UI. O cadastramento de uma segunda identidade
real requer login do usuário; não foi feito login em nome dele durante os testes.
