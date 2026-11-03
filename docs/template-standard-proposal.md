# Proposta: padrão aberto de templates do Studio

Status: proposta de produto e contrato público. O Studio já tem um manifesto
interno `template.json`, um núcleo neutro gerado e instalação com prévia de arquivos.
A importação de pacotes externos e o editor de templates descritos aqui ainda não
estão implementados. A proposta reaproveita esse instalador e seus registros de
origem, versão e hashes.

## O que um template representa

Um template é uma equipe e um modo de trabalhar para um domínio. Ele define
papéis, skills, workflows, etapas e documentos esperados. O projeto define stack,
objetivo e estado atual. O Studio define o executor, modelo, esforço e contas.

Exemplos: estúdio de jogos, fábrica de software, manutenção de legado, pesquisa ou
produção de conteúdo. Um template não precisa presumir um projeto novo: pode
começar por diagnóstico e adequação de documentação existente.

O pacote não deve incorporar contas, tokens, históricos de chat ou um modelo
obrigatório. Papéis podem recomendar um nível de capacidade, como rápido,
equilibrado ou profundo; o mapeamento para modelos é escolhido pelo usuário.

## Formato público recomendado

Pasta com `studio.template.json`, README, LICENSE e recursos Markdown. ZIP é um
transporte dessa mesma pasta, não um segundo formato. O manifesto público terá um
JSON Schema versionado, usado pelo aplicativo e por um comando de validação.
`template.json` dos templates atuais continua aceito por um adaptador de legado.

```text
meu-template/
  studio.template.json
  studio-template.schema.json
  README.md
  LICENSE
  agents/
    architect.md
    engineer.md
    reviewer.md
  skills/
    diagnose/SKILL.md
    adapt-docs/SKILL.md
    plan/SKILL.md
  workflows/
    start.md
    review.md
  files/
    docs/templates/brief.md
    docs/templates/decision.md
```

Exemplo de manifesto proposto:

```json
{
  "$schema": "./studio-template.schema.json",
  "schemaVersion": 1,
  "kind": "studio.template",
  "id": "minhaempresa.software-team",
  "name": "Meu time de software",
  "version": "1.0.0",
  "description": "Diagnosticar, documentar e evoluir projetos existentes.",
  "author": { "name": "Minha empresa" },
  "license": "MIT",
  "entrypoint": "start",
  "agents": [
    { "id": "architect", "file": "agents/architect.md", "capacity": "deep" },
    { "id": "engineer", "file": "agents/engineer.md", "capacity": "balanced" },
    { "id": "reviewer", "file": "agents/reviewer.md", "capacity": "deep" }
  ],
  "skills": [
    { "id": "diagnose", "directory": "skills/diagnose" },
    { "id": "adapt-docs", "directory": "skills/adapt-docs" },
    { "id": "plan", "directory": "skills/plan" }
  ],
  "workflows": [
    { "id": "start", "file": "workflows/start.md" },
    { "id": "review", "file": "workflows/review.md" }
  ],
  "stages": [
    { "id": "diagnosis", "label": "Diagnóstico" },
    { "id": "documentation-adoption", "label": "Adequação da documentação" },
    { "id": "implementation", "label": "Implementação" },
    { "id": "review", "label": "Revisão" }
  ],
  "capabilities": { "required": ["files.read"], "optional": ["files.write", "commands.run", "agents.delegate"] },
  "files": { "source": "files", "strategy": "preserve-customized" },
  "execution": { "maxParallelAgents": 3 }
}
```

A referência de schema é local ao pacote. O arquivo de schema ainda faz parte da
proposta e deverá acompanhar o exemplo oficial e o aplicativo. Depois pode ganhar
um endereço oficial versionado. Não depender de um serviço remoto para validar ou
usar um template local.

## Conteúdo dos recursos

Agentes: Markdown com nome, descrição, responsabilidades, capacidades e skills.
Skills: diretório com SKILL.md, podendo incluir referências e scripts relativos.
Workflows: instruções Markdown com entrada, passos, entregáveis e critérios de
conclusão. O MVP não precisa criar uma linguagem de programação para workflows.

As capacidades são semânticas. Cada adaptador traduz leitura, edição, comandos e
delegação para ferramentas do executor. Uma capacidade obrigatória sem suporte
impede a aplicação ao executor; opcionais ficam visivelmente indisponíveis. Hooks
específicos de um programa devem ser declarados como extensão daquele adaptador,
e não apresentados como portáveis.

O padrão guarda a origem dos arquivos. Documentos e skills personalizados no
projeto conservam sua autoria; o Studio continua separando projeto e template.

## Experiência de criação

Em Templates, o usuário escolhe Criar template, Duplicar template ou Exportar
configuração do projeto. Um assistente coleta objetivo, papéis, skills, etapas e
entregáveis; o resultado é uma pasta editável, com manifesto e exemplos reais.
A criação pode começar de um time vazio ou dos templates atuais.

A prévia mostra equipe, etapas, comandos, arquivos de destino e capacidades
necessárias. A configuração de provedor/modelo por papel pode ser feita ali e fica
no projeto, sem contaminar o template distribuído com referências a contas.

## Importar e aplicar

Fluxo único: selecionar pasta/ZIP → validar e revisar prévia → aplicar ao projeto.
Depois, acrescentar importação de URL GitHub com referência fixada em commit ou tag.
Não exigir publicação para usar um template pessoal offline.

A validação verifica manifesto, versão, recursos referenciados, colisões de nomes,
licença, caminhos de destino e dependências declaradas. ZIPs passam por limites de
tamanho/quantidade, rejeição de caminhos fora da pasta e links simbólicos. Importar
não executa scripts do pacote. Scripts e hooks aparecem entre as alterações reais
que serão instaladas, pelo mesmo fluxo de prévia já existente no Studio.

O usuário recebe um resultado acionável: válido, incompatível ou arquivo/campo que
precisa corrigir. A importação para a biblioteca é separada da aplicação a um
projeto; importar por si só não escreve no código do projeto.

## Atualização, exportação e composição

Cada projeto registra ID, versão, origem e hash dos recursos aplicados. Atualizar
mostra um diff: criar, atualizar, preservar personalizado ou conflito. A atualização
não substitui arquivos personalizados automaticamente. O histórico permite restaurar
a versão anterior sem apagar mudanças de negócio.

Exportar gera a mesma pasta/ZIP, excluindo contas, credenciais, históricos, runtime,
logs e dependências instaladas. Preserva licença, créditos e origem do template base.

No MVP, um template principal por projeto. Depois, módulos de capacidades — como
segurança ou testes — com namespaces e resolução explícita de conflitos. Evitar
começar com herança múltipla, marketplace e execução remota: o contrato local e as
atualizações precisam funcionar primeiro.

## Entrega sugerida

1. Formalizar o schema e publicar um template mínimo de exemplo, com validação CLI.
2. Importar pasta e ZIP na biblioteca, usando a instalação com prévia existente.
3. Duplicar/exportar templates e criar um assistente para autores.
4. Atualização com diff e preservação das personalizações.
5. Importar versões fixadas do GitHub e, depois, catálogo comunitário e módulos.

Critério do primeiro ciclo: uma pessoa cria um template de três agentes sem editar
o código do Studio, importa por pasta e ZIP, aplica em dois projetos e executa com
os adaptadores disponíveis. Trocar provedor não exige reescrever o template; contas
permanecem configuradas exclusivamente no Studio. O teste também cobre um projeto
que está em adequação da documentação, e não apenas um projeto recém-criado.

## Biblioteca do usuário e arquitetura de implementação

Os templates que acompanham o aplicativo permanecem no pacote, como base somente
leitura. Templates importados vão para a biblioteca no diretório de dados do
usuário, separados por ID e versão. Duplicar um embutido gera um novo ID de autor,
com origem e licença preservadas. Atualizar o aplicativo não remove essa biblioteca.

A implementação pode ser dividida em cinco peças pequenas: leitor de pacote,
validador do manifesto, compilador para o núcleo neutro, adaptadores de provedores
e instalador com prévia. O compilador e o instalador atuais são a base; o importador
não deve duplicar as regras de merge, preservação e hashes já existentes.

O projeto mantém sua própria versão aplicada em .studio/template.json. O diff de
atualização compara três fontes: base aplicada, arquivo atual do projeto e nova
versão do template. Adicionar uma nova versão à biblioteca não atualiza projetos
automaticamente. No catálogo, a origem deve ser clara: embutido, meu template ou
importado de outro autor.
