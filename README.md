# Studio Monitor

[Releases e instaladores](https://github.com/obarbadev/studio-monitor/releases) · [Changelog](CHANGELOG.md) · [Guia de distribuição](docs/distribution.md) · [Créditos](THIRD_PARTY_NOTICES.md)

Prévia para macOS Apple Silicon/Intel e Windows x64. Os pacotes não são assinados digitalmente. Instale os programas oficiais dos provedores e faça login antes de conectar um projeto. Veja os requisitos e limites de cada plataforma no guia de distribuição.

Aplicação Electron local para conectar projetos, conversar com um agente principal e acompanhar equipes de agentes. O núcleo é independente do domínio: jogos e fábrica de software são templates opcionais. A execução usa os programas oficiais Claude Code, OpenAI Codex e Antigravity (AGY) instalados na máquina, com seus logins locais.

## Abrir

O aplicativo macOS Apple Silicon empacotado fica em `release/mac-arm64/Studio Monitor.app` depois de `npm run pack`.

Para desenvolvimento:

```sh
npm ci
npm run dev
```

Para executar o build:

```sh
npm run build
npm start
```

Requer Node.js 24 ou superior, macOS/Linux/Windows com Electron e pelo menos um executor oficial instalado e atualizado: **Claude Code, Codex ou Antigravity (AGY)**. O aplicativo foi validado no macOS Apple Silicon com Claude Code 2.1.316. Não distribui nem instala o Claude Code do usuário. A dependência do SDK inclui seu próprio binário, mas a execução usa explicitamente o CLI encontrado na máquina.

## Primeira conexão

1. Clique em **Conectar projeto** e selecione uma pasta existente, com ou sem `CLAUDE.md` ou `.claude/agents/`.
2. Opcionalmente, abra **Templates** e escolha **Game Studios · Donchitos** ou **Fábrica de Software**. Escolha a pasta, revise os arquivos novos/mesclados/preservados e instale. Nenhum agente é iniciado e nenhuma dependência da aplicação é instalada nessa etapa.
3. Em **Contas Claude**, use um login local ou adicione uma assinatura Pro/Max pelo fluxo oficial no navegador.
4. No chat, descreva a tarefa. Se instalou um template, execute `/start` para configurá-lo. O comando só roda quando você o envia; projetos sem template recebem sugestões em linguagem natural.
5. Escolha modelo e **Esforço de raciocínio** ao lado do campo de mensagem. A opção vale para os próximos envios iniciados pelo app. As execuções iniciadas pelo Studio usam o modo nativo `bypassPermissions` (`--dangerously-skip-permissions`), herdado pelos subagentes. Perguntas do agente continuam no chat.

## Templates incluídos

- **Game Studios · Donchitos:** snapshot oficial `05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418`, versão 1.2.0, com agentes, skills, regras, hooks, documentos e script de statusline. O snapshot original fica no aplicativo; a instalação adapta agentes e skills para herdarem o modelo da sessão. A licença MIT e o crédito de Donchitos acompanham o pacote e cada instalação. Não é necessário clonar ou baixar o repositório durante a instalação pelo app.
- **Fábrica de Software:** 16 agentes e 17 skills próprios, inspirados na organização do Game Studios, com produto, arquitetura, engenharia web/mobile/backend/dados, QA, segurança, desempenho e entrega. A stack é definida no projeto. Rigor `minimal`, `standard` ou `full` controla o processo; não define o esforço do modelo.

A prévia não grava arquivos. Instalar preserva arquivos conflitantes, acrescenta instruções em `CLAUDE.md` com um bloco identificado, mescla hooks e negações sem ampliar a lista `allow` de permissões existentes e preserva uma statusline já configurada. Conflitos são listados e podem exigir ajuste manual. Scripts de hooks conflitantes impedem a ativação automática dos novos hooks. Uma prévia desatualizada é recusada.

A instalação registra versão, origem e hashes em `.studio/template.json`. Um projeto usa um template instalado por vez; troca e atualização destrutiva não são feitas implicitamente. Não há desinstalador que apague configurações personalizadas. Detalhes em [templates e statusline](docs/templates-and-statusline.md).

## Visão do projeto e statusline

**Visão do projeto** mostra contexto da sessão, modelo/esforço informado pelo CLI, fase, rigor, épico/história/tarefa, backlog, progresso e documentos. Arquivos são relidos a cada cinco segundos. A fase é configurada ou inferida por regras declarativas do template; a interface informa a origem.

O `statusline.sh` do Donchitos recebe JSON do Claude Code e mostra contexto, modelo, fase/rigor e progresso no terminal. Contexto é a janela da conversa, não a cota Pro/Max. A fábrica inclui sua própria versão para software. Ambos funcionam sem consumir tokens de inferência.

O instalador conecta uma ponte Python à statusline dos projetos novos. Para uma configuração existente, use **Visão do projeto → Revisar conexão**: a prévia mostra as alterações antes de aplicar. A saída original continua no terminal. A ponte grava somente métricas públicas — contexto, modelo e custo estimado da sessão — em `.studio/runtime/statusline/<session>.json`, ignorado pelo Git. Não grava prompts, credenciais ou o transcript. O diretório é protegido contra links simbólicos.

O percentual exato de contexto depende de o Claude Code executar a statusline com esses campos. Em execução headless/SDK, a statusline pode não rodar; nesses casos o painel mostra os tokens realmente observados e calcula uma estimativa identificada somente quando também recebe a capacidade de contexto do modelo principal. Não inicia uma segunda consulta ao modelo para estimar esse número.

## Esforço

Opções: padrão do Claude Code, baixo, médio, alto, muito alto (`xhigh`) e máximo. A preferência fica salva no app e é enviada pelo SDK e ambiente nativos nos próximos envios. **Padrão** herda a configuração do CLI. A versão, o modelo e políticas administrativas podem limitar o esforço aplicado; quando o CLI o informa, a visão do projeto separa solicitado e aplicado. A configuração não altera uma execução já em andamento ou um processo externo observado.

O **Canvas do estúdio** é a tela principal: agentes podem ser arrastados, conexões indicam participação na mesma sessão, e os controles permitem zoom e enquadramento da equipe. O chat principal fica ao lado. Não há dados de demonstração na interface.

## Sessões existentes

Clique em **Sessões existentes**, procure uma conversa por título, projeto ou conta e escolha **Acompanhar**. O aplicativo descobre os últimos 80 transcripts em `~/.claude/projects`, nos perfis locais `~/.claude-*`, no diretório definido por `CLAUDE_CONFIG_DIR` e nos perfis adicionados. Não consulta a nuvem. Também permite acompanhar sessões de outros projetos Claude Code, mesmo sem o template de jogos.

No modo de acompanhamento, o painel lê os arquivos locais a cada 1,5 segundo e atualiza o histórico e as delegações observadas. Não modifica a sessão externa, não instala hooks nela e não chama o modelo. Uma delegação sem resultado é marcada **Observado**, pois apenas ler o transcript não prova que um processo ainda esteja executando. A atualização depende de quando o CLI grava seus dados em disco; não inclui tokens que ainda não foram gravados. Transcripts acima de 80 MB pausam o acompanhamento com uma mensagem.

Para conversar pelo aplicativo, encerre a execução no outro terminal e clique em **Retomar aqui**. Uma confirmação local explica essa transferência. O próximo envio retoma o identificador original da sessão com seu histórico. O aplicativo não injeta mensagens em um processo interativo já aberto, nem consegue garantir que o usuário encerrou esse processo. Não mantenha dois escritores na mesma sessão. Ao reiniciar o app, conecte novamente a sessão externa pelo seletor; ela não é assumida automaticamente.

## Leitura e aparência

O chat renderiza Markdown com títulos, listas, tabelas, citações e blocos de código com botão de copiar. O mesmo conteúdo aparece no chat lateral do canvas e no menu Chat principal. HTML embutido não é executado; imagens remotas não são carregadas automaticamente.

Em **Aparência**, no rodapé da barra lateral, escolha **Preto e branco** (padrão claro) ou **Escuro**. A preferência fica salva. As transições, entradas de cartões/mensagens e indicadores respeitam a preferência do sistema para reduzir movimento.

## Gerenciar contas

Cada cartão em **Contas Claude** tem ações para renomear, remover do aplicativo e atualizar o uso. Remover uma conta retira seu cadastro e participação no fallback; não apaga históricos, credenciais ou o perfil do CLI e não encerra o login em outros aplicativos. Contas já criadas automaticamente por versões anteriores podem ser removidas por essa ação.

Acompanhar uma sessão externa **não cria contas**. O diretório de origem do histórico é guardado separadamente. Se o CLI identificar o mesmo e-mail de uma conta cadastrada, ela é reutilizada. Caso contrário, a sessão continua em acompanhamento sem alterar os cadastros; para conversar depois da retomada, selecione uma conta conectada. Se necessário, o transcript é transferido para o perfil escolhido antes do primeiro envio.

## Assinaturas Pro/Max

Cada conta adicional tem seu próprio `CLAUDE_CONFIG_DIR`. Senhas e tokens ficam sob responsabilidade do login e armazenamento nativos do Claude Code. O aplicativo não pede API keys, não extrai tokens do Keychain e não consulta endpoints OAuth diretamente. Variáveis de API, OAuth e provedores alternativos herdadas do ambiente são removidas ao iniciar o CLI para evitar usar acidentalmente outro método de autenticação. Configurações pessoais/de projeto ainda podem definir credenciais; use perfis de assinatura sem `apiKeyHelper` ou variáveis de API nesses arquivos.

**Usar login local** referencia o perfil padrão existente, sem copiá-lo. O nome, e-mail informado pelo CLI, histórico do chat e eventos são salvos no diretório de dados local do Electron. No macOS: `~/Library/Application Support/Studio Monitor/`. Os perfis adicionais ficam na subpasta `profiles/`. Esse diretório contém conversas e dados pessoais; mantenha-o privado.

O SDK TypeScript oficial controla o processo CLI nativo e recebe mensagens em streaming. O Studio inicia novas execuções, retomadas e fallback com `permissionMode: "bypassPermissions"` e `allowDangerouslySkipPermissions: true`, conforme a preferência solicitada pelo usuário. Esse modo é herdado pelos subagentes. Não há confirmação rotineira para comandos e edições; perguntas do agente e solicitações explícitas ainda podem aparecer no painel. Regras `deny`, hooks e políticas administradas do Claude Code continuam aplicáveis. O Studio não altera o modo de um processo externo que está apenas acompanhando. Os hooks de observação do aplicativo são adicionais; os hooks e permissões do projeto continuam carregados. As regras de permissão existentes podem pré-autorizar ferramentas, conforme o comportamento do Claude Code.

## Medidor de uso

A leitura usa o comando estruturado `/usage` fornecido pelo CLI, quando disponível na versão instalada, e mostra as janelas de cinco horas e sete dias. O método correspondente do SDK é **experimental**, isolado em `refreshUsage` no motor. A consulta abre um processo de controle do CLI, sem enviar nenhum prompt ao modelo, com ferramentas, hooks e persistência desabilitados. Atualiza ao abrir o aplicativo, após login/importação e a cada 30 segundos, mesmo sem execução ativa. Também pode ser atualizada pelo botão de cada conta. Consultas simultâneas da mesma conta são agrupadas. O app não lança tarefas pagas para consultar saldo. Falhas aparecem no cartão; a última leitura válida conserva seu horário.

Se a versão instalada não suporta a leitura, ou o Claude não fornece a informação, o medidor exibe **Sem leitura**, nunca um percentual estimado. O contador de tokens descreve respostas observadas nesta conversa; não é o saldo total da assinatura nem uma cobrança.

## Agentes, skills e instruções

Em **Skills e instruções**, consulte as definições do projeto, do perfil usado na sessão e dos plugins anunciados pelo CLI. Cada item mostra sua origem e abre o conteúdo em Markdown. O catálogo de agentes e os nós do canvas também abrem um inspetor com instruções, modelo, ferramentas, skills declaradas e tarefa/resultado, quando disponíveis.

A biblioteca diferencia arquivos encontrados, recursos disponíveis na sessão e invocações de skills observadas. Instruções têm confirmação de carregamento apenas quando o hook `InstructionsLoaded` foi recebido. Uma invocação de Skill não garante que ela concluiu com sucesso. Em sessões externas, a atribuição de uso a agentes depende dos identificadores gravados no transcript. Os arquivos exibidos são os atuais; podem diferir da versão usada em uma sessão antiga.

O medidor mostra usado e disponível nas janelas de cinco horas e semanal. Horário de renovação e contagem regressiva são exibidos quando o CLI os fornece. O contador atualiza a cada segundo; os percentuais vêm de consultas a cada 30 segundos e de atualizações após eventos de execução, respeitando esse intervalo mínimo para consultas automáticas. Ao expirar uma janela, o app aguarda o dado novo, sem presumir saldo renovado.

A [comparação de mercado](docs/market-review-2026-11-02.md) documenta referências e próximos passos de produto.

## Fallback

O fallback é habilitado por padrão e pode ser desligado em Contas Claude ou no painel de uso. Quando o CLI informa um limite de assinatura:

- A conta entra em espera até o horário de renovação informado pelo Claude; sem esse horário, a espera local é de cinco minutos.
- A próxima conta conectada, habilitada e fora de espera é selecionada. Cada conta é tentada no máximo uma vez por envio.
- O transcript da sessão e os arquivos dos seus subagentes são copiados para o diretório equivalente do próximo perfil. Credenciais, configurações e outros projetos não são copiados.
- A sessão é retomada com seu identificador original e uma instrução para verificar o que já foi concluído antes de continuar.
- Sem histórico disponível, o app interrompe a troca em vez de perder o contexto silenciosamente. Sem outra conta disponível, a execução pausa e registra o motivo na atividade.

A retomada depende do formato local de sessões do Claude Code. Preservar o transcript e orientar o agente reduz repetições, mas **não garante execução exatamente uma vez** de comandos externos. Uma interrupção entre um efeito externo e seu registro no transcript continua sendo uma limitação. Erros comuns de rede/execução não disparam rotação de contas.

## Validação e empacotamento

```sh
npm test                 # testes do motor e sessões com dados temporários; sem consumo Claude
npm run build            # tipos e build da interface
npm run test:ui          # navegação Electron em perfil temporário; sem contas reais
npm run pack             # .app local
npm run dist:mac         # instalador DMG
```

Os testes cobrem isolamento de autenticação, seleção de fallback, transferência do transcript, limites, streaming, agentes, fila de permissões, persistência, falhas e navegação, além de descoberta e acompanhamento de sessões externas. Login real, leitura de cotas e continuidade entre duas assinaturas precisam ser validados com contas autenticadas pelo usuário. Nenhuma tarefa paga foi enviada durante a implementação.

O empacotamento local não inclui assinatura Developer ID ou notarização para distribuição pública.

Fontes: [CLI](https://code.claude.com/docs/en/cli-reference), [SDK](https://code.claude.com/docs/en/agent-sdk/typescript), [perfis e variáveis](https://code.claude.com/docs/en/env-vars), [hooks](https://code.claude.com/docs/en/hooks).

O canvas mantém os agentes temporários: nós concluídos ou interrompidos saem após oito segundos; o histórico e os detalhes continuam em Agentes. As conexões identificam delegações e retornos observados. O painel Comunicação reúne delegações, conclusões, falhas e fallback, sem supor mensagens privadas entre agentes. Sessões externas identificam delegações ainda sem resultado como observadas, sem afirmar que continuam executando.

Durante uma execução, o chat mostra um indicador animado, tempo decorrido, ferramenta atual e subagentes trabalhando. Perguntas identificam o agente que aguarda resposta. O painel do projeto distingue uma ponte configurada de uma medição recebida para a sessão atual. Dados de outra sessão não são reutilizados. Quando disponíveis, a última entrada/saída e a capacidade de contexto do modelo principal fornecidas pelo SDK permitem uma estimativa identificada no painel; sem capacidade informada, o app mostra apenas os tokens observados.

Os templates herdam o modelo da sessão e geram um contrato neutro em `.studio/template-core.json`, com papéis, workflows e capacidades. Os adaptadores executam Claude Code, OpenAI Codex e Antigravity (AGY) com os logins oficiais. A biblioteca separa skills do projeto, do template aplicado, da conta e de plugins, com identificação de personalizações. O chat inclui busca de slash commands ao digitar `/`, navegação pelo teclado e preservação dos argumentos. Veja [portabilidade dos templates](docs/template-portability.md).

O Studio agora instala sua própria statusline ao conectar/reabrir projetos, mantendo a
saída anterior e as permissões. Além da barra nativa, recebe métricas diretamente do SDK,
permitindo atualizar o monitor em execuções sem interface de terminal. A visão do projeto
separa etapa de trabalho e fase configurada do produto; o backlog tem aba própria, lista
ou quadro, filtros e itens de documentação registrados no índice.

Em **Conexões → Provedores**, verifique os logins locais e selecione qual programa usar. O seletor também fica no chat. Conversas e retomadas ficam separadas por projeto e provedor; trocar o executor não envia o histórico de outro provedor nem transfere suas credenciais. Deixe o modelo vazio no Codex/AGY para usar o padrão do programa. O esforço do AGY e do Codex pode ser configurado no Studio. Veja [execução com provedores](docs/providers.md).

O Studio também suporta **equipes com provedores mistos**: defina o provedor/modelo por
papel em **Conexões → Fallback e equipe**, ou use **Agentes → Criar agente**. O principal
pode delegar e receber resultados por uma ponte MCP local. O fallback entre provedores
segue inicialmente **Claude → Codex → AGY**, depois das contas Claude disponíveis,
com contexto parcial de continuidade e identificação explícita do provedor em uso.
