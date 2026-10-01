# ⚡ GIRAVO Master Admin - Gestão que faz seu negócio girar

Painel administrativo centralizado para gerenciamento multi-tenant de oficinas, auto centers e revendas conectadas à plataforma GIRAVO.

## 🚀 Funcionalidades

- **Dashboard com Métricas em Tempo Real:** Total de oficinas, ativas, em período de teste (14d), vencidas e bloqueadas.
- **Gestão de Validade:** Renovação rápida (+30 dias e +1 ano) ou definição de data personalizada.
- **Bloqueio e Desbloqueio Instantâneo:** Suspende ou libera o acesso de qualquer oficina em tempo real.
- **Permissões Granulares de Módulos (Feature Flags):**
  - Ordens de Serviço & Orçamentos
  - Checklist Fotográfico da O.S. (Vistoria Digital)
  - Estoque de Peças
  - Frente de Caixa & PDV Balcão
  - Financeiro Completo
  - WhatsApp CRM
  - Relatórios Gerenciais
- **Gestão de Leads:** Acompanhamento e conversão em 1 clique de pedidos de teste gratuitos vindos da landing page.
- **Diagnóstico e Auto-Schema do Banco:** Detecção de tabelas e sincronização automática de banco.

## 🛠️ Tecnologias

- Next.js 15 (App Router)
- React 19
- TypeScript
- PostgreSQL (`pg`)
- Lucide React

## ⚙️ Variáveis de Ambiente

Crie o arquivo `.env.local` com:

```env
DATABASE_URL=postgresql://usuario:senha@host/banco?sslmode=require
POSTGRES_URL=postgresql://usuario:senha@host/banco?sslmode=require
MASTER_ADMIN_PASSWORD=admin
```

## 💻 Como Rodar Localmente

```bash
npm install
npm run dev
```

Acesse em `http://localhost:3005`.
