# Steps

## Step 1: Verificação neutra do vault e ponte com o CLI
- [x] manter o CLI como ponto de entrada principal
- [x] permitir inspeção do vault sem IA e sem mutações
- [x] expor a arvore de pastas e arquivos em formato legivel
- [x] ler metadados basicos dos arquivos, como titulo e preview
- [x] validar a integridade estrutural do vault sem assumir organizacao
- [x] manter a camada de vault isolada da logica de organizacao

## Step 2: Criacao e consolidacao do vault
- [x] formalizar o modulo `vault` como camada principal de leitura e verificação
- [ ] expandir o modelo para suportar mais tipos de arquivos e metadados
- [ ] adicionar verificacoes de consistencia e integridade do conteudo
- [x] definir contratos estaveis para consumo pela IA e pelo CLI
- [x] preparar o vault para evoluir sem acoplar regras de organizacao
- [ ] conectar a criacao do vault aos proximos fluxos do projeto quando o contrato estiver maduro
- [x] abstrair os comandos de leitura, validacao, busca e contexto em uma interface unica para o usuario comum
