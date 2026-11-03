---
name: review
description: "Revisar uma mudança com foco em falhas e regressões relevantes."
---
# /review

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Leia o diff, os critérios de aceitação e os caminhos afetados.
2. Verifique contratos, estados de erro, autorização, persistência e integração conforme a mudança.
3. Se uma revisão independente for útil e a ferramenta estiver disponível, delegue ao code-reviewer com escopo somente de leitura.
4. Retorne achados por prioridade com arquivo, gatilho, consequência e correção mínima. Se não encontrar falhas, diga quais áreas verificou.
5. Não edite arquivos nem execute ações externas em uma tarefa de revisão sem autorização para corrigir.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
