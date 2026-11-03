---
name: start
description: "Configurar a fábrica a partir do projeto e do objetivo do usuário."
---
# /start

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Leia CLAUDE.md, project.yaml e instruções existentes. Inspecione manifestos e o estado do repositório sem alterar código.
2. Identifique se é um projeto novo ou existente, a stack e os comandos de desenvolvimento/testes. Pergunte somente o que estiver faltando e mudar o resultado.
3. Confirme objetivo, público, restrições e nível de rigor. Use minimal por padrão; não configure serviço, nuvem ou framework por suposição.
4. Atualize os campos necessários de project.yaml preservando valores existentes. Defina project.name, project.domain, stack e project.stage com base em evidência.
5. Apresente o fluxo curto e sugira a próxima tarefa útil: /requirements ou /adopt. Não chame todo o time sem necessidade.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
