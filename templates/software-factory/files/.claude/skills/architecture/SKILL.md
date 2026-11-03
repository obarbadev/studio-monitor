---
name: architecture
description: "Resolver decisões técnicas com um ADR proporcional ao impacto."
---
# /architecture

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Leia o requisito e trace o caminho atual entre interface, domínio, dados e serviços.
2. Defina o problema e os invariantes. Compare alternativas reais com critérios de compatibilidade, operação e complexidade.
3. Faça uma recomendação e registre o tradeoff. Para uma decisão autorizada, escreva um ADR em docs/architecture/.
4. Inclua contratos, falhas, verificação e migração/rollback quando afetados. Não adicione camadas ou provedores sem necessidade.
5. Se houver uma escolha material de produto ou custo ainda não autorizada, apresente-a ao usuário antes de implementá-la.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
