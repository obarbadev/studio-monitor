# Critérios de qualidade

`minimal`: critérios de aceitação demonstrados e verificações relevantes à mudança.
`standard`: inclua revisão de contratos, integração e tratamento de falhas quando aplicável.
`full`: inclua evidências de segurança, acessibilidade, desempenho e rollback conforme o domínio.

Um requisito só passa quando a prova esperada existe. Testes devem detectar uma regressão real,
não repetir a implementação. Para UI, execute o fluxo visível; para API, verifique contrato e
caminhos de erro; para dados, demonstre compatibilidade e preservação. Não exija todos esses
itens para uma mudança que não os afeta.

`/quality-gate` retorna PASS, CONCERNS ou FAIL, cada um com evidência e pendências.
Ausência de ambiente é uma limitação explícita, não um teste aprovado.
Uma revisão independente é recomendada para mudanças de alto impacto, não para alterações triviais.
