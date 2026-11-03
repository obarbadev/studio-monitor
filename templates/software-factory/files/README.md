# Fábrica de Software

Template de equipe para Claude Code, inspirado na separação de agentes, skills,
regras, evidências e estado de produção do Claude Code Game Studios, de Donchitos.
As instruções de domínio deste template são próprias; os jogos continuam no template original.

Abra o Claude Code na raiz e execute `/start`. Para um produto existente, use `/adopt`.
A stack é descoberta no repositório e confirmada com você. Nenhum framework é instalado automaticamente.

Fluxo curto: `/start` → `/requirements` → `/plan` → `/implement` → `/test` → `/review` → `/story-done`.
Use `/architecture` quando houver uma decisão estrutural; `/security-review`, `/quality-gate`
e `/release` conforme o risco. `/incident`, `/refactor`, `/handoff` e `/retrospective` atendem manutenção.

- `project.yaml`: contexto e nível de processo do projeto.
- `.claude/agents`: especialidades; o agente principal coordena as tarefas.
- `.claude/skills`: procedimentos reutilizáveis.
- `.claude/rules`: regras condicionais para código, testes, dados e segurança.
- `docs/product`, `docs/architecture`, `docs/operations`: decisões e contexto.
- `production/epics`: histórias com critérios de aceitação e provas.
- `production/state.yaml`: épico, história e tarefa atuais.
- `production/evidence`: referências a verificações reais.

Rigor `minimal` é o padrão. Não crie documentação que não ajude a executar ou verificar o trabalho.
A conclusão de uma história exige provas; uma checagem sintática não substitui executar o fluxo.
A statusline mostra contexto, modelo, fase, rigor e progresso. A cota da conta é uma medição separada.

O instalador do Studio Monitor pode acrescentar uma ponte de telemetria local em `.studio/`.
Ela persiste somente métricas públicas da statusline, por sessão, e mantém a saída do terminal.
A instalação não inicia agentes, executa builds, publica código ou modifica a aplicação existente.

Requisitos: Claude Code atualizado, Git, Python 3 e Bash. No Windows, utilize um ambiente
com Bash e Python 3 acessíveis pelo Claude Code. Executáveis são os da máquina, não do template.
