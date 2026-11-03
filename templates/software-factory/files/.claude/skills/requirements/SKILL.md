---
name: requirements
description: "Definir um briefing curto e critérios de aceitação observáveis."
---
# /requirements

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Entenda usuário, problema, objetivo e restrições a partir do contexto já fornecido.
2. Separe comportamento obrigatório, exclusões e dúvidas que realmente impedem implementar.
3. Escreva docs/product/brief.md usando docs/templates/brief.md, com um exemplo concreto de sucesso.
4. Dê a cada critério uma forma de verificação. Não especifique tecnologia que o requisito não exige.
5. Se existir uma decisão relevante sem resposta, apresente opções e aguarde a escolha; continue trabalho independente.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
