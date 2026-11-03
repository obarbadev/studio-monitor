---
name: refactor
description: "Reorganizar código preservando comportamento e contratos."
---
# /refactor

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Defina o comportamento que deve ser preservado e o ganho estrutural concreto.
2. Observe a implementação e rode a prova relevante antes de mover responsabilidades.
3. Faça a extração ou consolidação no escopo autorizado, sem adicionar funcionalidades.
4. Rode as mesmas verificações e revise o diff para mudanças acidentais.
5. Se detectar um bug independente, reporte-o; não o misture silenciosamente com a refatoração.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
