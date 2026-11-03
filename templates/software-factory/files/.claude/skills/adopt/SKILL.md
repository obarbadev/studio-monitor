---
name: adopt
description: "Integrar a fábrica a um produto existente sem reestruturar o repositório."
---
# /adopt

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Mapeie pontos de entrada, scripts, testes, arquitetura e convenções existentes.
2. Preserve alterações não commitadas e configurações já adotadas. Não mova arquivos, troque stack ou crie um projeto novo.
3. Registre no briefing o contexto mínimo para trabalhar e identifique lacunas que bloqueiam a primeira entrega.
4. Atualize project.yaml apenas com fatos confirmados. Defina uma primeira história pequena, com prova de aceitação.
5. Retorne os caminhos importantes e a próxima ação. Melhorias de arquitetura não necessárias ficam como sugestões.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
