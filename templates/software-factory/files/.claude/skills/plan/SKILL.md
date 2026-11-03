---
name: plan
description: "Criar histórias pequenas com dependências e critérios de pronto."
---
# /plan

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Use o briefing aprovado e a arquitetura necessária, sem exigir documentos irrelevantes.
2. Crie production/epics/<slug>/story-*.md com o formato docs/templates/story.md. Inclua objetivo, aceitação, dependências e verificações.
3. Cada história deve entregar comportamento verificável. Evite histórias que apenas criem abstrações sem uso.
4. Classifique o estado como backlog ou ready. Atualize production/state.yaml com a próxima história e project.stage para Planning.
5. Identifique o caminho crítico e a primeira entrega. Não estime duração com precisão inventada.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
