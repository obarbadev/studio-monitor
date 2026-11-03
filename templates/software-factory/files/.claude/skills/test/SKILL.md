---
name: test
description: "Executar provas de aceitação e registrar o que foi realmente verificado."
---
# /test

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Derive o plano dos critérios da história, das mudanças e do risco.
2. Descubra os comandos reais nos manifestos, CI e instruções. Não invente um comando de teste nem adicione uma suíte sem necessidade.
3. Execute o caminho de sucesso e falhas pertinentes. Em UI, abra a aplicação e observe o fluxo; parse/compilação não bastam.
4. Registre comandos, ambiente, resultados e evidências em production/evidence e na história. Dados e credenciais de produção não são fixtures.
5. Diferencie teste automatizado, simulação, validação visual e integração real. Se algo ficou indisponível, documente a limitação.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
