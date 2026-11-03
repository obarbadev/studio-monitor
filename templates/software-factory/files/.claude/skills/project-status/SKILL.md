---
name: project-status
description: "Mostrar fase, backlog, bloqueios e evidências sem inventar progresso."
---
# /project-status

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Leia project.yaml, production/state.yaml e os cabeçalhos das histórias em production/epics.
2. Conte estados reais: backlog, ready, in_progress, blocked, review e done.
3. Mostre a tarefa ativa, bloqueios e o último resultado verificado. Diferencie estado configurado de inferência.
4. Aponte inconsistências como história inexistente ou done sem evidência. Não altere estados só para fazer o painel parecer atualizado.
5. Entregue um resumo curto com próxima ação concreta.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
