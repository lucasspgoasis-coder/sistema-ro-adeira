# Sistema de controle de roçadeiras

Painel para consultar os registros de uma planilha Google, filtrar operações e exportar relatórios em CSV, PDF e JPEG.

## Organização

```text
index.html                      Estrutura da página
assets/
  css/
    base.css                    Fonte, abas, animações e barras de rolagem
    dashboard.css               Aparência do painel e da exportação
  js/
    tailwind-config.js          Cores do tema
    app.js                      Leitura da planilha, filtros, indicadores e gráficos
    dashboard.js                Ajustes dos gráficos e controles dos relatórios
    report.js                   Geração dos arquivos para download
```

## Abrir e publicar

Abra `index.html` no navegador ou use um servidor local, como o Live Server do VS Code. É necessário acesso à internet para carregar a planilha, fontes e bibliotecas externas.

No GitHub Pages, publique a raiz do repositório e mantenha a pasta `assets` junto de `index.html`. Os caminhos são relativos e funcionam dentro do endereço do projeto.

## Manutenção

- A URL da planilha está em `CSV_URL`, no arquivo `assets/js/app.js`.
- A ordem dos scripts no HTML deve ser mantida: `app.js`, `dashboard.js` e `report.js`.
- PDF e JPEG usam o gerador de páginas de `report.js`. PDF gera um único arquivo com páginas A4 em sequência. JPEG gera uma única imagem vertical, com as seções uma abaixo da outra. Os indicadores gerais permanecem agrupados. Imagens extensas têm a resolução ajustada aos limites do navegador.
- Os arquivos usam UTF-8 para preservar os acentos.

## Limitação do acesso

A tela de login confere credenciais no JavaScript do navegador. Ela não protege os dados com autenticação no servidor. As credenciais e a URL da planilha podem ser consultadas no código; dados privados exigem autenticação e autorização no servidor.

## Conferência manual

Após alterações, confira o login, o carregamento da planilha, os filtros, todas as abas e os downloads de CSV, PDF e JPEG. Verifique também um filtro sem resultados e a visualização no celular.
