# Distribuição

Repositório: https://github.com/obarbadev/studio-monitor

## Desenvolver a partir do código

Instale Node.js 24+ (CI usa 26), npm e Git. Execute:

```sh
npm ci
npm test
npm run dev
```

`npm run test:ui` exercita a interface Electron com contas e eventos simulados. A
suíte completa usa Python 3 e Bash e é executada em macOS. Os pacotes não incluem
logins, projetos pessoais ou CLIs globais do usuário. O SDK Anthropic continua
sendo uma dependência do aplicativo, com seus próprios avisos de licença.

## Gerar pacotes localmente

macOS, na arquitetura desejada:

```sh
npm run dist:mac -- --arm64
npm run dist:mac -- --x64
```

Windows x64, usando um ambiente Windows:

```sh
npm run dist:win
```

Os arquivos são gerados em `release/`. O comando `npm run release:checksums` gera
SHA256SUMS.txt. Certificados, senhas de assinatura e caches de conta não devem
entrar no repositório ou no pacote.

## Publicar uma release

1. Atualize a versão em package.json e package-lock.json e as notas da versão.
2. Rode os testes e faça commit em main.
3. Crie e publique a tag correspondente: por exemplo, `v0.1.0` para a versão 0.1.0.
4. A ação Release Electron valida o código, gera pacotes macOS arm64/x64 e Windows
   x64 e publica a prévia somente se todos os jobs passarem.
5. A release inclui os arquivos fonte da tag e hashes SHA-256 dos instaladores e
   arquivos compactados. Se um job falhar, não é publicada uma release incompleta.

O workflow usa somente contents:read nos builds e contents:write no job que
publica. Nenhuma chave de API de modelo ou assinatura é necessária. Runners e
armazenamento estão sujeitos à cota de GitHub Actions da conta.

## Limites da prévia

Os builds atuais não têm assinatura de publicador ou notarização. A configuração
não procura certificados locais automaticamente. Para distribuição assinada,
configure credenciais de assinatura como secrets de CI e adapte a configuração
macOS/Windows antes de remover essa indicação das notas. Não há atualizador
silencioso: a atualização é feita baixando a nova versão.

Os programas Claude Code, Codex e AGY devem ser instalados e autenticados pelo
usuário. No Windows são necessários executáveis nativos .exe disponíveis no PATH
ou nos overrides STUDIO_CLAUDE_PATH, STUDIO_CODEX_PATH e STUDIO_AGY_PATH; wrappers
.cmd não são executados pelo Studio. Para templates com hooks e statusline, instale
Git Bash e Python 3 e confira que `python3` funciona no ambiente desses programas.
O login Codex/AGY pelo botão abre Terminal no macOS; outros sistemas mostram o
comando para login manual. Validação por empacotamento não equivale a testar uma
conta real em cada plataforma.

## Licença e origem

A licença da aplicação está em LICENSE e package.json. O snapshot Donchitos e o
template de fábrica de software mantêm seus arquivos MIT independentes e os
créditos em THIRD_PARTY_NOTICES.md. Histórico e credenciais de execução ficam no
diretório de dados do aplicativo, fora da árvore publicada.

A versão 0.1.1 usa MIT para o aplicativo. Na publicação inicial, o GitHub Actions
foi impedido de iniciar por bloqueio de cobrança na conta. Os instaladores dessa
versão foram gerados localmente no macOS; o Windows é um cross-build e precisa
de validação real no Windows. O workflow permanece disponível para builds nativos
quando a conta for liberada.

A release 0.1.2 acrescenta o ícone próprio. Os ícones finais PNG, ICO e ICNS estão
versionados em build-resources. Para refazê-los a partir do PNG em um Mac, use
`npm run build:icons`. O Windows usa edição de recursos nativa do electron-builder
para aplicar ícone e versão; apenas a assinatura digital fica desabilitada.
