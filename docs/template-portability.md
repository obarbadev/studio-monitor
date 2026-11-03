# Modelos e provedores

Os templates separam responsabilidades da escolha de modelo. Na instalação pelo Studio,
os agentes recebem `model: inherit` e as skills não recebem um modelo próprio.
O principal deve delegar sem selecionar outro modelo, salvo instrução explícita do usuário.
Rigor do processo e esforço de raciocínio continuam separados dessa política.

O snapshot do Donchitos incluído em `templates/game-studios/files` permanece intacto.
As adaptações ocorrem nos arquivos instalados, com aviso na prévia, preservando licença,
instruções de domínio, scripts e configurações de segurança. A documentação de tiers
instalada é substituída pela política de herança para não orientar novas fixações.

## Contrato neutro

Cada instalação gera `.studio/template-core.json`, com `schemaVersion: 1`:

- `roles`: identificador, descrição, instruções, workflows declarados e limites de cada papel.
- `workflows`: instruções e capacidades necessárias às skills.
- `modelPolicy`: herança da sessão, independente de família ou versão.
- `capabilities`: nomes neutros como `files.read`, `files.edit`, `commands.run` e `agents.delegate`.
- `capabilityPolicy`: capacidades declaradas ou herdadas do executor.
- `source`: localização e restrições de ferramentas no formato de origem, para auditoria e tradução.
- `resources`: arquivos do projeto necessários aos procedimentos e referências.
- `adapters`: Claude Code, OpenAI/Codex CLI e Gemini CLI disponíveis, sujeitos à instalação e ao login local.

O contrato descreve o template e usa o conteúdo efetivo das definições quando arquivos
personalizados são preservados. Uma escolha explícita de modelo em um arquivo personalizado
fica registrada como exceção na definição correspondente. Metadados ausentes ou inválidos
são sinalizados em `compatibility.issues`.

Os adaptadores de execução traduzem definições de agentes e skills para os programas
oficiais. Codex recebe `.codex/agents/studio_*.toml` e `.agents/skills/studio-*/SKILL.md`;
Gemini recebe `.gemini/agents/studio_*.md` e `.gemini/skills/studio-*/SKILL.md`.
Modelos dos agentes são herdados. Referências e scripts continuam usando os diretórios
originais do projeto, indicados nas definições exportadas.

A execução lê o conteúdo atual do projeto e atualiza somente arquivos gerados que ainda
correspondam aos hashes registrados em `.studio/adapters/<executor>.json`. Alterações
personalizadas impedem substituição e são apresentadas como erro. Definições geradas
obsoletas são removidas somente se permanecerem intactas. Regras e hooks exclusivos de
Claude não viram políticas dos outros programas automaticamente. No Gemini, ferramentas
sem equivalente são sinalizadas; no Codex, restrições declaradas de ferramentas dos
papéis são instruções, enquanto a política efetiva de acesso vem do executor.

Veja [execução com provedores](providers.md) para login, contexto, retomada e limites.

## Atualização e origem

Reinstalar o mesmo template oferece uma prévia. As definições ainda iguais ao hash registrado
podem receber a adaptação de modelo. Arquivos personalizados são preservados e sinalizados.
O Studio não altera automaticamente projetos só porque foram conectados.

A biblioteca separa projeto, template, conta e plugins. A origem vem de
`.studio/template.json`, com os hashes e a propriedade dos arquivos. Uma skill instalada pelo
template e depois modificada continua nesse grupo com o selo **Personalizada**. Um arquivo
que já era do projeto e foi preservado na instalação continua no grupo do projeto.
Sem registro de instalação válido, o Studio não atribui arquivos a um template pelo nome.

## Slash commands

O chat lista skills locais, comandos anunciados pela sessão e sugestões do template ao
digitar `/` ou clicar no botão `/`. Use as setas para navegar, Tab para completar e Enter
para enviar um comando completo. Argumentos seguem intactos para o executor. `/clear`
inicia uma conversa nova no Studio, sem mandar esse comando ao modelo.
Sessões externas em acompanhamento precisam ser retomadas antes de aceitar envios.
