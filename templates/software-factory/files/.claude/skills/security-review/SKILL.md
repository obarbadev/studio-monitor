---
name: security-review
description: "Revisar as fronteiras de confiança relevantes à mudança."
---
# /security-review

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Trace dados não confiáveis até ferramentas, arquivos, comandos, banco e serviços.
2. Verifique autorização, validação de caminhos, segredos e exposição de dados no escopo alterado.
3. Produza achados com cenários de exploração e correções na camada responsável.
4. Reproduza somente em ambiente autorizado, usando dados sintéticos. Não faça varreduras externas por conta própria.
5. Registre limites da revisão e pendências; não ofereça um selo genérico de segurança.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
