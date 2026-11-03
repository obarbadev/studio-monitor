---
name: incident
description: "Investigar falhas com hipóteses, evidências e correção restrita."
---
# /incident

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Registre sintoma, impacto, início e ambiente. Preserve logs relevantes sem segredos.
2. Colete evidências antes de editar. Compare hipóteses com testes baratos e observações.
3. Quando houver causa plausível, aplique a menor correção autorizada e prove que o gatilho deixou de falhar.
4. Diferencie mitigação, causa e prevenção. Não faça mudanças destrutivas ou de produção como consequência implícita da investigação.
5. Documente resultado, limites e ações preventivas úteis em docs/operations/.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
