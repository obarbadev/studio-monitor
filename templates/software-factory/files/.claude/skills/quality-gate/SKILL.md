---
name: quality-gate
description: "Avaliar a prontidão de uma entrega com critérios proporcionais ao risco."
---
# /quality-gate

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Leia .claude/docs/quality-gates.md e os critérios da entrega.
2. Verifique evidência de comportamento, integração e riscos realmente afetados.
3. Classifique PASS, CONCERNS ou FAIL e liste a prova de cada conclusão.
4. Crie uma pendência rastreável para preocupações não bloqueantes. Falhas de aceitação mantêm a história aberta.
5. Não trate uma revisão textual ou teste simulado como prova de uma integração que não foi executada.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
