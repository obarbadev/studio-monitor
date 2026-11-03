---
name: story-done
description: "Concluir uma história somente quando sua aceitação estiver demonstrada."
---
# /story-done

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Abra a história e confira todos os critérios de aceitação contra a evidência retida.
2. Não conclua com testes não executados, bloqueios relevantes ou falhas ainda abertas.
3. Quando os critérios estiverem atendidos, marque status: done, vincule provas e descreva o resultado.
4. Atualize production/state.yaml para a próxima história ready ou deixe activeStory/task nulos se não houver trabalho ativo.
5. Não crie commit, faça merge ou publique automaticamente. Informe o que foi concluído e o que resta.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
