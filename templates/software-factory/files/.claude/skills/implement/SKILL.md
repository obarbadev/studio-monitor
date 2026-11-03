---
name: implement
description: "Implementar a história escolhida e demonstrar seu comportamento."
---
# /implement

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Selecione uma história ready ou a tarefa explicitamente solicitada. Leia arquivos e invariantes antes de editar.
2. Atualize status para in_progress e production/state.yaml com o épico, história e tarefa; project.stage passa a Development.
3. Implemente o menor fluxo completo no padrão do repositório. Delegue recortes somente se houver benefício e ferramentas disponíveis.
4. Execute verificações relevantes. Registre evidência e limitações na história. Não expanda escopo para corrigir problemas independentes.
5. Quando o comportamento estiver implementado, use review ou blocked conforme as pendências. Só /story-done marca done.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
