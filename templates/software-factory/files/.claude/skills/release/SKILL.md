---
name: release
description: "Preparar e verificar uma entrega, com rollback e autorização explícita para publicar."
---
# /release

## Entradas

Use o pedido do usuário e `$ARGUMENTS`, se fornecido. Leia o contexto existente antes
de pedir informação adicional. Instruções do usuário e permissões da sessão prevalecem.

## Procedimento

1. Confirme versão, escopo, ambiente e resultados do quality-gate.
2. Gere notas de release e plano de implantação/rollback a partir das mudanças reais.
3. Verifique migrações, configuração e dependências que afetam o ambiente de destino.
4. Prepare artefatos localmente. Publique ou implante apenas se a ação e o destino já estiverem autorizados; caso contrário, apresente o resultado para aprovação.
5. Após a execução autorizada, confira saúde e comportamento; registre o que foi observado e como reverter.

## Saída

Resultado concreto, evidências verificadas e pendências. Cite arquivos reais e deixe
claro o que não foi executado. Não inicie outro fluxo além do necessário ao objetivo.
