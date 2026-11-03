# Studio Monitor: comparação de mercado e próximos passos

Pesquisa em 2 de novembro de 2026. Foram consultados materiais oficiais dos quatro produtos. Trata-se de uma comparação documental, não de testes práticos ou medição de desempenho dos concorrentes. “OpenBot” refere-se ao produto de openbot.run, e não a projetos homônimos.

## O que aproveitar de cada referência

| Referência | Recursos documentados | Aplicação ao nosso estúdio |
| --- | --- | --- |
| [Maestri](https://www.themaestri.app/en/docs/intro) | Canvas espacial com terminais, notas Markdown, arquivos e conexões; organização por workspace e layout salvo. | Fazer do canvas um lugar de trabalho persistente. Fixar o briefing, plano e evidências do jogo junto dos agentes. |
| [OpenBot](https://openbot.run/) | Identidade e instruções por agente, comunicação e passagem de tarefas, troca de provedor preservando contexto e fila de mensagens com pausa/cancelamento. | Mostrar dono, objetivo e estado de cada tarefa. Permitir preparar a próxima solicitação enquanto o diretor trabalha, com fila visível. |
| [OpenMausBot](https://github.com/milind-soni/OpenMausBot) | Perfil e modelo por bot, aprovações na conversa, contextos por canal e importação de equipes por documentos estruturados. | Dar acesso às definições locais e separar configuração do agente, contexto do projeto e execução observada. O template Game Studios já oferece uma boa base de equipe portátil. |
| [Grok Bot](https://docs.x.ai/grok-bot/overview) | Agentes persistentes, memória, coordenação, passagens de tarefa e computador na nuvem que continua trabalhando com o cliente fechado. | Tornar continuidade e controle de execução explícitos. Nosso aplicativo local depende do computador ligado; continuar após fechar a interface exigiria um serviço separado. |

Os recursos dessa tabela são apresentados pelos próprios fornecedores. As propostas para o Studio Monitor são nossa avaliação, não afirmações de equivalência entre os produtos.

## Prioridade imediata: transparência da execução

Implementada nesta entrega:

- Uso consumido e disponível nas janelas de cinco horas e semanal, com horário local de renovação.
- Contagem regressiva atualizada a cada segundo; nova consulta ao CLI a cada 30 segundos e após eventos da execução, respeitando o intervalo mínimo entre consultas automáticas.
- Biblioteca de definições de agentes, skills e arquivos de instrução do projeto, do perfil da conta e dos plugins anunciados pelo CLI.
- Leitura das instruções em Markdown e visualização de modelo, ferramentas e skills declaradas por agente.
- Separação entre arquivos encontrados, capacidades anunciadas na sessão e invocações de skills observadas. Hooks de carregamento de instruções fornecem evidência adicional nas sessões iniciadas pelo app.

Essa separação resolve uma pergunta essencial: “o agente usou mesmo essa skill, ou ela apenas está instalada?”. Uma chamada observada à ferramenta Skill não prova que a execução terminou com sucesso. Em sessões externas, o painel só pode mostrar o que estiver registrado nos transcripts; instruções internas e decisões não expostas pelo CLI permanecem desconhecidas.

## Próximas melhorias recomendadas

| Ordem | Melhoria | Benefício e critério de aceitação |
| --- | --- | --- |
| 1 | Canvas salvo por projeto e sessão | Reabrir o projeto preserva posições, zoom e painéis. Evitar que uma mudança de estado reorganize o trabalho manual. |
| 2 | Briefing, plano e arquivos fixados no canvas | Cada tarefa aponta para documentos reais; um clique abre o GDD, código ou evidência correspondente. |
| 3 | Linha do tempo e fila de solicitações | Distinguir trabalhando, aguardando permissão, aguardando usuário, limite de conta e falha. Mostrar a próxima tarefa e permitir cancelar antes de executar. |
| 4 | Revisão de alterações e evidências do jogo | Exibir diff, testes executados e capturas de Godot/Unity/Unreal vinculados à tarefa. O usuário consegue avaliar o que mudou e a prova do resultado. |
| 5 | Histórico de conta e fallback | Registrar qual conta executou cada etapa, motivo e momento de troca, sem expor credenciais. Deixar visível quando a continuidade depende de intervenção. |
| 6 | Integrações com o motor do jogo | Ações explícitas para abrir projeto, executar cena/build e acompanhar erros do editor, com permissões e resultado registrados. |
| 7 | Serviço local de execução independente da janela | Só após definir encerramento, recuperação e controle de exclusividade. Fechar a janela não deve ter significado ambíguo para processos em andamento. |

A vantagem mais útil para este projeto é **um estúdio de jogos verificável**: conectar agentes às tarefas, instruções, arquivos alterados e evidências de execução do jogo. Um navegador automatizado ou centenas de conectores não substituem essa ligação.

## Limites e decisões

- Atualização de percentuais por consulta periódica não equivale a um fluxo contínuo do servidor. A interface informa a idade da leitura e não estima consumo entre consultas.
- Quando a janela expira, o painel aguarda uma leitura nova; não inventa saldo renovado.
- A biblioteca mostra os arquivos locais atuais. Eles podem ter mudado depois do início de uma sessão antiga; não devem ser apresentados como uma reconstrução exata do prompt daquela execução.
- Não é possível atribuir uma skill a um subagente sem um identificador de origem observado. Eventos sem essa associação ficam no histórico da sessão.
- Recursos dos concorrentes serviram como referência de produto; não foi copiado código deles.

## Fontes primárias complementares

- [Maestri — Maestro Mode](https://www.themaestri.app/en/docs/maestro)
- [Maestri — Notes](https://www.themaestri.app/en/docs/notes)
- [OpenMausBot — README oficial](https://raw.githubusercontent.com/milind-soni/OpenMausBot/main/README.md)
- [Grok Bot — FAQ](https://docs.x.ai/grok-bot/faq)
