# OrBullets

Sistema de gestão de uma loja de armas e munições. Controla o estoque de munições, cartuchos e insumos, o cadastro e a venda de armas, a produção do clube e os relatórios mensais.

Os dados ficam num banco local (SQLite), no computador da loja. Quando há internet, o aplicativo pode sincronizar uma cópia com o Supabase. A versão de uso diário é o aplicativo de desktop (Electron).

## O que cada parte faz

- **Estoque.** Mostra o estoque por tipo de produto, calibre e item. Registra entradas e saídas. Na saída, gera o termo em PDF.
- **Movimentações.** Lista as últimas entradas e saídas do estoque e permite reabrir o termo de uma saída.
- **Mapa mensal.** Guarda, mês a mês, os PDFs do relatório de estoque e do relatório de armas neste computador.
- **Cadastro.** Cadastra calibres, produtos (munição, cartucho e insumo), marcas e tipos de arma.
- **Clube.** Controla a produção de munição do clube: receitas, lotes, estoque de componentes e relatório.
- **Armas.** Cadastra armas, registra vendas e entregas e gera os documentos em PDF (papel de venda, contrato e comprovante de entrega). Separa armas em estoque, armas vendidas que ainda serão compradas e armas retiradas no mês. Armas ainda não recebidas não entram no mapa nem no relatório.
- **Configurações.** Liga o aviso de estoque baixo. O aviso vale para qualquer computador ligado a este servidor.

## Como rodar

```bash
npm install
npm run dev
```

O comando sobe a API local e a interface web. Para abrir o aplicativo de desktop:

```bash
npm run dev:electron
```

Para gerar o instalador:

```bash
npm run build:electron
```
