# Changelog

As mudanças do Studio Monitor são registradas por versão. Os pacotes 0.1.x são
prévias: não têm assinatura de publicador e ainda precisam de validação de uso
real em Windows e macOS Intel. As notas de cada release detalham esses limites.

## [0.1.3] — 2026-11-03

### Corrigido

- Fallback e equipe podem ser ajustados enquanto o agente principal executa uma
  tarefa: ativação, ordem, limite de agentes e provedor/modelo por papel.
- O envio em andamento conserva sua configuração inicial de fallback. Alterações
  passam a valer para o próximo envio e para novas tarefas Studio.
- A tela explica quando as alterações passam a valer e mostra os padrões de
  execução definidos pelo template quando não há configuração própria do projeto.

### Documentação

- Changelog versionado e texto de anúncio para Twitter/X.

## [0.1.2] — 2026-11-03

- Ícone próprio em preto e branco, aplicado à interface, ao Dock, aos aplicativos
  Windows/macOS e aos instaladores.
- Ícones PNG, ICO e ICNS e script para regenerar os formatos nativos.
- Primeira release pública de pacotes: Windows x64, macOS arm64 e x64, arquivos
  fonte ZIP/TAR.GZ e manifesto SHA-256.

## [0.1.1] — 2026-11-03

- Aplicação disponibilizada sob licença MIT.
- Documentação de distribuição, requisitos e limites dos builds locais.
- Créditos e licenças dos templates preservados, incluindo o snapshot Donchitos.

## [0.1.0] — 2026-11-03

- Código inicial publicado no repositório obarbadev/studio-monitor.
- Canvas com agentes transitórios, estados e comunicação; chat com Markdown,
  slash commands, atividade de execução e confirmação de interrupção.
- Conexões Claude Code Pro/Max, Codex e Antigravity (AGY), modelos e esforço,
  fallback entre contas Claude e entre provedores, equipe com provedores mistos.
- Biblioteca de instruções e skills com separação de projeto e template; templates
  de jogos e fábrica de software; visão de produto, backlog e telemetria própria.
- Configuração de CI e release. O GitHub Actions foi impedido de iniciar por
  bloqueio de cobrança da conta; os pacotes iniciais foram gerados localmente.

[0.1.3]: https://github.com/obarbadev/studio-monitor/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/obarbadev/studio-monitor/releases/tag/v0.1.2
[0.1.1]: https://github.com/obarbadev/studio-monitor/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/obarbadev/studio-monitor/tree/v0.1.0
