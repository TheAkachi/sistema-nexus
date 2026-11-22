// Os vms de exemplo da seção 6 do docs/CONTRATO.md, copiados como estão (o tests/views/exemplos.test.mjs confere que
// continuam iguais ao contrato). "Hoje" é 20/10/2026 e a tolerância é de 10 dias. Os dados são fictícios.

// 6.1 Rotas e moldura
export const moldura={
  "usuario": {
    "id": "6f1c2a9e-0b7d-4c3e-9a51-2d8f4b6e7c10",
    "nome": "Lucas",
    "email": "lucas@exemplo.test",
    "papel": "admin"
  },
  "csrf": "4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6c",
  "pode": {
    "clientes": true,
    "assinaturas": true,
    "pagamentos": true,
    "cobrar": true,
    "importar": true,
    "equipe": true,
    "configuracoes": true,
    "auditoria": true
  },
  "modulos": {
    "interessados": false
  },
  "avisos": [
    {
      "tipo": "chave-pix",
      "texto": "Defina a chave Pix em Configurações. Sem ela, a mensagem de cobrança sai sem a chave.",
      "href": "/configuracoes"
    }
  ],
  "tela": "resumo",
  "filtros": {},
  "dados": {}
};

// 6.2 Entrar
export const entrarSenha={
  "etapa": "senha",
  "next": "/renovacoes",
  "motivo": "expirou",
  "email": "",
  "configurar": null
};

// 6.2 Entrar
export const entrarConfigurar={
  "etapa": "configurar",
  "next": "",
  "motivo": "",
  "email": "lucas@exemplo.test",
  "configurar": {
    "qrSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 37 37\" role=\"img\" aria-label=\"QR code do autenticador\"><path d=\"M0 0h7v1H0z\"/></svg>",
    "link": "otpauth://totp/Gest%C3%A3o%20Nexus:lucas%40exemplo.test?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Gest%C3%A3o%20Nexus&algorithm=SHA1&digits=6&period=30",
    "chave": "JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP",
    "emissor": "Gestão Nexus",
    "conta": "lucas@exemplo.test"
  }
};

// 6.3 Definir senha
export const definirSenha={
  "token": "0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0",
  "valido": true,
  "tipo": "convite",
  "email": "ana@exemplo.test",
  "nome": "Ana",
  "convidadoPor": "Lucas"
};

// 6.4 Resumo
export const resumo={
  "hoje": "2026-10-20",
  "mrr": 186700,
  "recebidoMes": 53600,
  "aRenovar30": {
    "qtd": 4,
    "valor": 43400
  },
  "inadimplentes": {
    "qtd": 1,
    "valor": 9900
  },
  "ativas": 23,
  "cobrarHoje": [
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c04",
      "cliente": {
        "id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f63",
        "nome": "Auto Peças Iguaçu",
        "responsavel": "Rita Alves",
        "whatsapp": "5521900000003"
      },
      "empresa": {
        "id": "auto-pecas-iguacu",
        "nome": "Auto Peças Iguaçu",
        "miniatura": "https://nexus.demo/midia/5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e/320.webp",
        "url": "https://nexus.demo/comercio/auto-pecas-iguacu"
      },
      "plano": {
        "id": "plano-premium",
        "nome": "Premium"
      },
      "valorCentavos": 9900,
      "ciclo": "mensal",
      "venceEm": "2026-10-02",
      "dias": -18,
      "situacao": "inadimplente",
      "ultimoContato": null,
      "linkWhatsapp": "https://wa.me/5521900000003?text=Ol%C3%A1%2C%20Rita%20Alves!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Premium%20da%20Auto%20Pe%C3%A7as%20Igua%C3%A7u%20venceu%20em%2002%2F10%2F2026%2C%20no%20valor%20de%20R%24%2099%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 2
    },
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01",
      "cliente": {
        "id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41",
        "nome": "Clínica Vida Plena",
        "responsavel": "Marina Souza",
        "whatsapp": "5521900000001"
      },
      "empresa": {
        "id": "clinica-vida-plena-centro",
        "nome": "Clínica Vida Plena · Centro",
        "miniatura": "https://nexus.demo/midia/3f2a9c1b7d4e5f60718293a4b5c6d7e8/320.webp",
        "url": "https://nexus.demo/comercio/clinica-vida-plena-centro"
      },
      "plano": {
        "id": "plano-premium",
        "nome": "Premium"
      },
      "valorCentavos": 9900,
      "ciclo": "mensal",
      "venceEm": "2026-10-15",
      "dias": -5,
      "situacao": "vencida",
      "ultimoContato": {
        "em": "2026-10-16T13:20:00.000Z",
        "por": {
          "id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67",
          "nome": "Bruno"
        },
        "tipo": "cobranca"
      },
      "linkWhatsapp": "https://wa.me/5521900000001?text=Ol%C3%A1%2C%20Marina%20Souza!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Premium%20da%20Cl%C3%ADnica%20Vida%20Plena%20%C2%B7%20Centro%20venceu%20em%2015%2F10%2F2026%2C%20no%20valor%20de%20R%24%2099%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 5
    },
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c03",
      "cliente": {
        "id": "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e52",
        "nome": "Padaria Pão Dourado",
        "responsavel": "Carlos Lima",
        "whatsapp": "5521900000002"
      },
      "empresa": {
        "id": "padaria-pao-dourado",
        "nome": "Padaria Pão Dourado",
        "miniatura": "",
        "url": "https://nexus.demo/comercio/padaria-pao-dourado"
      },
      "plano": {
        "id": "plano-avancado",
        "nome": "Avançado"
      },
      "valorCentavos": 18000,
      "ciclo": "trimestral",
      "venceEm": "2026-10-24",
      "dias": 4,
      "situacao": "a-vencer",
      "ultimoContato": null,
      "linkWhatsapp": "https://wa.me/5521900000002?text=Ol%C3%A1%2C%20Carlos%20Lima!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Avan%C3%A7ado%20da%20Padaria%20P%C3%A3o%20Dourado%20vence%20em%2024%2F10%2F2026%2C%20no%20valor%20de%20R%24%20180%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 1
    }
  ],
  "cobrarHojeTotal": 3
};

// 6.5 Renovações
export const renovacoes={
  "janela": "vencidas",
  "contagem": {
    "vencidas": 2,
    "ate7": 1,
    "ate15": 1,
    "ate30": 4
  },
  "itens": [
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c04",
      "cliente": {
        "id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f63",
        "nome": "Auto Peças Iguaçu",
        "responsavel": "Rita Alves",
        "whatsapp": "5521900000003"
      },
      "empresa": {
        "id": "auto-pecas-iguacu",
        "nome": "Auto Peças Iguaçu",
        "miniatura": "https://nexus.demo/midia/5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e/320.webp",
        "url": "https://nexus.demo/comercio/auto-pecas-iguacu"
      },
      "plano": {
        "id": "plano-premium",
        "nome": "Premium"
      },
      "valorCentavos": 9900,
      "ciclo": "mensal",
      "venceEm": "2026-10-02",
      "dias": -18,
      "situacao": "inadimplente",
      "ultimoContato": null,
      "linkWhatsapp": "https://wa.me/5521900000003?text=Ol%C3%A1%2C%20Rita%20Alves!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Premium%20da%20Auto%20Pe%C3%A7as%20Igua%C3%A7u%20venceu%20em%2002%2F10%2F2026%2C%20no%20valor%20de%20R%24%2099%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 2
    },
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01",
      "cliente": {
        "id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41",
        "nome": "Clínica Vida Plena",
        "responsavel": "Marina Souza",
        "whatsapp": "5521900000001"
      },
      "empresa": {
        "id": "clinica-vida-plena-centro",
        "nome": "Clínica Vida Plena · Centro",
        "miniatura": "https://nexus.demo/midia/3f2a9c1b7d4e5f60718293a4b5c6d7e8/320.webp",
        "url": "https://nexus.demo/comercio/clinica-vida-plena-centro"
      },
      "plano": {
        "id": "plano-premium",
        "nome": "Premium"
      },
      "valorCentavos": 9900,
      "ciclo": "mensal",
      "venceEm": "2026-10-15",
      "dias": -5,
      "situacao": "vencida",
      "ultimoContato": {
        "em": "2026-10-16T13:20:00.000Z",
        "por": {
          "id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67",
          "nome": "Bruno"
        },
        "tipo": "cobranca"
      },
      "linkWhatsapp": "https://wa.me/5521900000001?text=Ol%C3%A1%2C%20Marina%20Souza!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Premium%20da%20Cl%C3%ADnica%20Vida%20Plena%20%C2%B7%20Centro%20venceu%20em%2015%2F10%2F2026%2C%20no%20valor%20de%20R%24%2099%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 5
    }
  ],
  "total": 2,
  "pagina": 1,
  "paginas": 1
};

// 6.6 Clientes
export const clientes={
  "itens": [
    {
      "id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f63",
      "nome": "Auto Peças Iguaçu",
      "responsavel": "Rita Alves",
      "whatsapp": "5521900000003",
      "empresas": 1,
      "planoPrincipal": {
        "id": "plano-premium",
        "nome": "Premium"
      },
      "situacao": "inadimplente",
      "status": "ativo"
    },
    {
      "id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41",
      "nome": "Clínica Vida Plena",
      "responsavel": "Marina Souza",
      "whatsapp": "5521900000001",
      "empresas": 2,
      "planoPrincipal": {
        "id": "plano-premium",
        "nome": "Premium"
      },
      "situacao": "vencida",
      "status": "ativo"
    },
    {
      "id": "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e52",
      "nome": "Padaria Pão Dourado",
      "responsavel": "Carlos Lima",
      "whatsapp": "5521900000002",
      "empresas": 1,
      "planoPrincipal": {
        "id": "plano-avancado",
        "nome": "Avançado"
      },
      "situacao": "a-vencer",
      "status": "ativo"
    },
    {
      "id": "3e4f5a6b-7c8d-4e9f-a0b1-2c3d4e5f6a74",
      "nome": "Studio Bella",
      "responsavel": "",
      "whatsapp": "",
      "empresas": 1,
      "planoPrincipal": {
        "id": "plano-avancado",
        "nome": "Avançado"
      },
      "situacao": "em-dia",
      "status": "ativo"
    }
  ],
  "total": 4,
  "pagina": 1,
  "paginas": 1
};

// 6.7 Ficha do cliente
export const ficha={
  "id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41",
  "nome": "Clínica Vida Plena",
  "responsavel": "Marina Souza",
  "whatsapp": "5521900000001",
  "email": "marina@exemplo.test",
  "notas": "Prefere ser chamada pelo WhatsApp depois das 14h.",
  "status": "ativo",
  "criadoEm": "2026-10-01T11:02:13.000Z",
  "version": 3,
  "empresas": [
    {
      "id": "clinica-vida-plena-centro",
      "nome": "Clínica Vida Plena · Centro",
      "slug": "clinica-vida-plena-centro",
      "bairro": "Centro",
      "miniatura": "https://nexus.demo/midia/3f2a9c1b7d4e5f60718293a4b5c6d7e8/320.webp",
      "url": "https://nexus.demo/comercio/clinica-vida-plena-centro",
      "vinculadaEm": "2026-10-01T11:02:13.000Z",
      "acessosUrl": "https://nexus.demo/admin/acessos?empresa=clinica-vida-plena-centro"
    },
    {
      "id": "clinica-vida-plena-austin",
      "nome": "Clínica Vida Plena · Austin",
      "slug": "clinica-vida-plena-austin",
      "bairro": "Austin",
      "miniatura": "https://nexus.demo/midia/4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d/320.webp",
      "url": "https://nexus.demo/comercio/clinica-vida-plena-austin",
      "vinculadaEm": "2026-10-01T11:02:13.000Z",
      "acessosUrl": "https://nexus.demo/admin/acessos?empresa=clinica-vida-plena-austin"
    }
  ],
  "assinaturas": [
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01",
      "cliente": {
        "id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41",
        "nome": "Clínica Vida Plena"
      },
      "empresa": {
        "id": "clinica-vida-plena-centro",
        "nome": "Clínica Vida Plena · Centro",
        "miniatura": "https://nexus.demo/midia/3f2a9c1b7d4e5f60718293a4b5c6d7e8/320.webp",
        "url": "https://nexus.demo/comercio/clinica-vida-plena-centro"
      },
      "plano": {
        "id": "plano-premium",
        "nome": "Premium"
      },
      "valorCentavos": 9900,
      "ciclo": "mensal",
      "inicio": "2025-03-15",
      "venceEm": "2026-10-15",
      "diaBase": 15,
      "dias": -5,
      "situacao": "vencida",
      "status": "ativa",
      "suspensaEm": null,
      "canceladaEm": null,
      "motivo": "",
      "origem": "edirectory",
      "notas": "",
      "gerida": true,
      "sincronizacao": {
        "estado": "ok",
        "em": "2026-09-14T17:45:02.000Z",
        "erro": ""
      },
      "criadaEm": "2026-10-01T11:02:13.000Z",
      "atualizadaEm": "2026-10-01T11:02:13.000Z",
      "version": 5
    },
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02",
      "cliente": {
        "id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41",
        "nome": "Clínica Vida Plena"
      },
      "empresa": {
        "id": "clinica-vida-plena-austin",
        "nome": "Clínica Vida Plena · Austin",
        "miniatura": "https://nexus.demo/midia/4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d/320.webp",
        "url": "https://nexus.demo/comercio/clinica-vida-plena-austin"
      },
      "plano": {
        "id": "plano-avancado",
        "nome": "Avançado"
      },
      "valorCentavos": 6700,
      "ciclo": "mensal",
      "inicio": "2026-02-15",
      "venceEm": "2026-11-15",
      "diaBase": 15,
      "dias": 26,
      "situacao": "a-vencer",
      "status": "ativa",
      "suspensaEm": null,
      "canceladaEm": null,
      "motivo": "",
      "origem": "edirectory",
      "notas": "",
      "gerida": true,
      "sincronizacao": {
        "estado": "ok",
        "em": "2026-10-15T14:10:40.000Z",
        "erro": ""
      },
      "criadaEm": "2026-10-01T11:02:13.000Z",
      "atualizadaEm": "2026-10-15T14:10:40.000Z",
      "version": 4
    }
  ],
  "desempenho": {
    "como": "Visitas e contatos no guia dos visitantes que aceitaram a medição no site, da cópia das métricas lida uma vez por dia. Mês sem medição aparece em branco; o mês que os números não cobrem inteiro aparece como parcial.",
    "disponivel": true,
    "lidaEm": "2026-10-20T08:00:04.000Z",
    "medidoDesde": "2026-07-14",
    "meses": ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"],
    "empresas": [
      {
        "id": "clinica-vida-plena-centro",
        "nome": "Clínica Vida Plena · Centro",
        "naCopia": true,
        "atual": {"mes": "2026-10", "visitas": 205, "contatos": {"whatsapp": 27, "telefone": 3, "rota": 8, "site": 1}, "contatosTotal": 39, "parcial": true},
        "anterior": {"mes": "2026-09", "visitas": 312, "contatos": {"whatsapp": 41, "telefone": 6, "rota": 14, "site": 4}, "contatosTotal": 65, "parcial": false},
        "meses": [
          {"mes": "2026-05", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-06", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-07", "visitas": 180, "contatos": {"whatsapp": 22, "telefone": 5, "rota": 9, "site": 2}, "contatosTotal": 38, "parcial": true},
          {"mes": "2026-08", "visitas": 296, "contatos": {"whatsapp": 35, "telefone": 7, "rota": 12, "site": 3}, "contatosTotal": 57, "parcial": false},
          {"mes": "2026-09", "visitas": 312, "contatos": {"whatsapp": 41, "telefone": 6, "rota": 14, "site": 4}, "contatosTotal": 65, "parcial": false},
          {"mes": "2026-10", "visitas": 205, "contatos": {"whatsapp": 27, "telefone": 3, "rota": 8, "site": 1}, "contatosTotal": 39, "parcial": true}
        ]
      },
      {
        "id": "clinica-vida-plena-austin",
        "nome": "Clínica Vida Plena · Austin",
        "naCopia": false,
        "atual": {"mes": "2026-10", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": true},
        "anterior": {"mes": "2026-09", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
        "meses": [
          {"mes": "2026-05", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-06", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-07", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-08", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-09", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": false},
          {"mes": "2026-10", "visitas": null, "contatos": null, "contatosTotal": null, "parcial": true}
        ]
      }
    ]
  },
  "relatorio": {
    "mes": "2026-09",
    "rotulo": "setembro de 2026",
    "empresas": [
      {
        "id": "clinica-vida-plena-centro",
        "url": "https://nexus.demo/painel/clinica-vida-plena-centro/relatorio/2026-09",
        "linkWhatsapp": "https://wa.me/5521900000001?text=Ol%C3%A1%2C%20Marina%20Souza!%20Aqui%20%C3%A9%20do%20Nexus.%20Seu%20an%C3%BAncio%20teve%20312%20visitas%20e%2041%20contatos%20pelo%20WhatsApp%20em%20setembro.%20O%20relat%C3%B3rio%20de%20setembro%20de%202026%20da%20Cl%C3%ADnica%20Vida%20Plena%20%C2%B7%20Centro%20est%C3%A1%20neste%20link%3A%20https%3A%2F%2Fnexus.demo%2Fpainel%2Fclinica-vida-plena-centro%2Frelatorio%2F2026-09",
        "ultimoEnvio": {"em": "2026-10-02T13:05:00.000Z", "por": {"id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67", "nome": "Bruno"}}
      },
      {
        "id": "clinica-vida-plena-austin",
        "url": "https://nexus.demo/painel/clinica-vida-plena-austin/relatorio/2026-09",
        "linkWhatsapp": "https://wa.me/5521900000001?text=Ol%C3%A1%2C%20Marina%20Souza!%20Aqui%20%C3%A9%20do%20Nexus.%20O%20relat%C3%B3rio%20de%20setembro%20de%202026%20da%20Cl%C3%ADnica%20Vida%20Plena%20%C2%B7%20Austin%20est%C3%A1%20neste%20link%3A%20https%3A%2F%2Fnexus.demo%2Fpainel%2Fclinica-vida-plena-austin%2Frelatorio%2F2026-09",
        "ultimoEnvio": null
      }
    ]
  },
  "linhaDoTempo": [
    {
      "tipo": "contato",
      "em": "2026-10-16T13:20:00.000Z",
      "por": {
        "id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67",
        "nome": "Bruno"
      },
      "assinatura": {
        "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01",
        "empresa": "Clínica Vida Plena · Centro",
        "plano": "Premium"
      },
      "contato": {
        "id": "7b6a5f4e-3d2c-4b1a-9f8e-7d6c5b4a3f21",
        "assinaturaId": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01",
        "empresaId": null,
        "canal": "whatsapp",
        "tipo": "cobranca",
        "venceEm": "2026-10-15",
        "mes": null,
        "em": "2026-10-16T13:20:00.000Z",
        "por": {
          "id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67",
          "nome": "Bruno"
        }
      }
    },
    {
      "tipo": "pagamento",
      "em": "2026-10-15T14:10:40.000Z",
      "por": {
        "id": "a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21",
        "nome": "Ana"
      },
      "assinatura": {
        "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02",
        "empresa": "Clínica Vida Plena · Austin",
        "plano": "Avançado"
      },
      "pagamento": {
        "id": "5f4e3d2c-1b0a-4f9e-8d7c-6b5a4f3e2d11",
        "assinaturaId": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02",
        "valorCentavos": 6700,
        "pagoEm": "2026-10-15",
        "forma": "pix",
        "referencia": {
          "de": "2026-10-15",
          "ate": "2026-11-14"
        },
        "venceAntes": "2026-10-15",
        "venceDepois": "2026-11-15",
        "obs": "",
        "registradoPor": {
          "id": "a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21",
          "nome": "Ana"
        },
        "registradoEm": "2026-10-15T14:10:40.000Z",
        "estorno": null
      }
    },
    {
      "tipo": "relatorio",
      "em": "2026-10-02T13:05:00.000Z",
      "por": {"id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67", "nome": "Bruno"},
      "assinatura": null,
      "empresa": {"id": "clinica-vida-plena-centro", "nome": "Clínica Vida Plena · Centro"},
      "contato": {"id": "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e61", "assinaturaId": null, "empresaId": "clinica-vida-plena-centro", "canal": "whatsapp", "tipo": "relatorio", "venceEm": null, "mes": "2026-09", "em": "2026-10-02T13:05:00.000Z", "por": {"id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67", "nome": "Bruno"}}
    }
  ]
};

// 6.8 Cliente (criar e editar)
export const clienteNovo={
  "cliente": null
};

// 6.9 Assinatura (criar e editar)
export const assinaturaNova={
  "assinatura": null,
  "cliente": {
    "id": "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e52",
    "nome": "Padaria Pão Dourado",
    "empresas": [
      {
        "id": "padaria-pao-dourado",
        "nome": "Padaria Pão Dourado"
      }
    ]
  },
  "planos": [
    {
      "id": "plano-avancado",
      "nome": "Avançado",
      "pago": true,
      "precoCentavos": 6700
    },
    {
      "id": "plano-premium",
      "nome": "Premium",
      "pago": true,
      "precoCentavos": 9900
    }
  ],
  "ciclos": [
    "mensal",
    "trimestral",
    "semestral",
    "anual"
  ]
};

// 6.10 Registrar pagamento
export const pagamento={
  "assinatura": {
    "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01",
    "cliente": {
      "id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41",
      "nome": "Clínica Vida Plena"
    },
    "empresa": {
      "id": "clinica-vida-plena-centro",
      "nome": "Clínica Vida Plena · Centro",
      "miniatura": "https://nexus.demo/midia/3f2a9c1b7d4e5f60718293a4b5c6d7e8/320.webp",
      "url": "https://nexus.demo/comercio/clinica-vida-plena-centro"
    },
    "plano": {
      "id": "plano-premium",
      "nome": "Premium"
    },
    "valorCentavos": 9900,
    "ciclo": "mensal",
    "inicio": "2025-03-15",
    "venceEm": "2026-10-15",
    "diaBase": 15,
    "dias": -5,
    "situacao": "vencida",
    "status": "ativa",
    "suspensaEm": null,
    "canceladaEm": null,
    "motivo": "",
    "origem": "edirectory",
    "notas": "",
    "gerida": true,
    "sincronizacao": {
      "estado": "ok",
      "em": "2026-09-14T17:45:02.000Z",
      "erro": ""
    },
    "criadaEm": "2026-10-01T11:02:13.000Z",
    "atualizadaEm": "2026-10-01T11:02:13.000Z",
    "version": 5
  },
  "cliente": {
    "id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41",
    "nome": "Clínica Vida Plena"
  },
  "sugestao": {
    "valorCentavos": 9900,
    "pagoEm": "2026-10-20",
    "forma": "pix",
    "venceDepois": "2026-11-15"
  },
  "formas": [
    "pix",
    "dinheiro",
    "cartao",
    "boleto",
    "transferencia",
    "mercado-pago"
  ]
};

// 6.11 Importação
export const importacoes={
  "itens": [
    {
      "id": "8c7b6a5f-4e3d-4c2b-a1f0-9e8d7c6b5a31",
      "tipo": "edirectory",
      "status": "previa",
      "criadaEm": "2026-10-20T10:58:00.000Z",
      "criadaPor": {
        "id": "6f1c2a9e-0b7d-4c3e-9a51-2d8f4b6e7c10",
        "nome": "Lucas"
      },
      "linhas": 46,
      "resumo": {
        "novos": 3,
        "atualizados": 2,
        "iguais": 31,
        "semEmpresa": 1,
        "ignorados": 8,
        "erros": 2
      },
      "confirmadaEm": null
    },
    {
      "id": "8c7b6a5f-4e3d-4c2b-a1f0-9e8d7c6b5a30",
      "tipo": "edirectory",
      "status": "confirmada",
      "criadaEm": "2026-10-01T10:40:00.000Z",
      "criadaPor": {
        "id": "6f1c2a9e-0b7d-4c3e-9a51-2d8f4b6e7c10",
        "nome": "Lucas"
      },
      "linhas": 44,
      "resumo": {
        "novos": 42,
        "atualizados": 0,
        "iguais": 0,
        "semEmpresa": 4,
        "ignorados": 0,
        "erros": 2
      },
      "confirmadaEm": "2026-10-01T11:02:13.000Z"
    }
  ],
  "total": 2,
  "pagina": 1,
  "paginas": 1
};

// 6.12 Prévia da importação
export const importacao={
  "id": "8c7b6a5f-4e3d-4c2b-a1f0-9e8d7c6b5a31",
  "tipo": "edirectory",
  "status": "previa",
  "arquivo": {
    "sha256": "5d41402abc4b2a76b9719d911017c592ae0b9b3d7f1e2c3a4b5c6d7e8f9a0b1c",
    "linhas": 46,
    "separador": ",",
    "codificacao": "utf-8",
    "datas": "dia/mês"
  },
  "criadaEm": "2026-10-20T10:58:00.000Z",
  "criadaPor": {
    "id": "6f1c2a9e-0b7d-4c3e-9a51-2d8f4b6e7c10",
    "nome": "Lucas"
  },
  "expiraEm": "2026-10-21T10:58:00.000Z",
  "confirmadaEm": null,
  "resumo": {
    "novos": 3,
    "atualizados": 2,
    "iguais": 31,
    "semEmpresa": 1,
    "ignorados": 8,
    "erros": 2
  },
  "linhas": [
    {
      "linha": 2,
      "acao": "ignorar",
      "cliente": {
        "nome": "Clínica Vida Plena",
        "email": "marina@exemplo.test",
        "whatsapp": "5521900000001"
      },
      "empresa": {
        "id": "clinica-vida-plena-austin",
        "nome": "Clínica Vida Plena · Austin"
      },
      "sugestoes": [],
      "plano": {
        "id": "plano-avancado",
        "nome": "Avançado"
      },
      "valorCentavos": 6700,
      "ciclo": "mensal",
      "venceEm": "2026-10-15",
      "status": "ativa",
      "mudancas": [],
      "aviso": "Editada na gestão depois da importação.",
      "erro": ""
    },
    {
      "linha": 4,
      "acao": "atualizar",
      "cliente": {
        "nome": "Padaria Pão Dourado",
        "email": "carlos@exemplo.test",
        "whatsapp": "5521900000002"
      },
      "empresa": {
        "id": "padaria-pao-dourado",
        "nome": "Padaria Pão Dourado"
      },
      "sugestoes": [],
      "plano": {
        "id": "plano-avancado",
        "nome": "Avançado"
      },
      "valorCentavos": 18000,
      "ciclo": "trimestral",
      "venceEm": "2026-10-24",
      "status": "ativa",
      "mudancas": [
        "valorCentavos",
        "ciclo"
      ],
      "aviso": "",
      "erro": ""
    },
    {
      "linha": 7,
      "acao": "novo",
      "cliente": {
        "nome": "Studio Bela Forma",
        "email": "contato@exemplo.test",
        "whatsapp": ""
      },
      "empresa": null,
      "sugestoes": [
        {
          "id": "studio-bella",
          "nome": "Studio Bella"
        }
      ],
      "plano": {
        "id": "plano-avancado",
        "nome": "Avançado"
      },
      "valorCentavos": 6700,
      "ciclo": "mensal",
      "venceEm": "2026-11-03",
      "status": "ativa",
      "mudancas": [],
      "aviso": "Sem valor no arquivo: usado o preço do plano.",
      "erro": ""
    },
    {
      "linha": 12,
      "acao": "erro",
      "cliente": {
        "nome": "",
        "email": "",
        "whatsapp": ""
      },
      "empresa": null,
      "sugestoes": [],
      "plano": null,
      "valorCentavos": null,
      "ciclo": null,
      "venceEm": null,
      "status": null,
      "mudancas": [],
      "aviso": "",
      "erro": "Falta o título do anúncio."
    }
  ],
  "version": 1
};

// 6.13 Equipe
export const equipe={
  "itens": [
    {
      "id": "a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21",
      "email": "ana@exemplo.test",
      "nome": "Ana",
      "papel": "financeiro",
      "desativado": false,
      "doisFatores": true,
      "ultimoAcesso": "2026-10-20T13:02:00.000Z",
      "convitePendente": null,
      "version": 2
    },
    {
      "id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67",
      "email": "bruno@exemplo.test",
      "nome": "Bruno",
      "papel": "comercial",
      "desativado": false,
      "doisFatores": true,
      "ultimoAcesso": "2026-10-19T19:40:00.000Z",
      "convitePendente": null,
      "version": 1
    },
    {
      "id": "e2b4c6d8-1a3f-4b5d-9c7e-0f1a2b3c4d58",
      "email": "julia@exemplo.test",
      "nome": "Júlia",
      "papel": "leitura",
      "desativado": false,
      "doisFatores": false,
      "ultimoAcesso": null,
      "convitePendente": {
        "expira": "2026-10-23T12:00:00.000Z",
        "vencido": false
      },
      "version": 1
    },
    {
      "id": "6f1c2a9e-0b7d-4c3e-9a51-2d8f4b6e7c10",
      "email": "lucas@exemplo.test",
      "nome": "Lucas",
      "papel": "admin",
      "desativado": false,
      "doisFatores": true,
      "ultimoAcesso": "2026-10-20T14:58:00.000Z",
      "convitePendente": null,
      "version": 1
    },
    {
      "id": "f3c5d7e9-2b4a-4c6e-8d0f-1a2b3c4d5e69",
      "email": "rafael@exemplo.test",
      "nome": "Rafael",
      "papel": "comercial",
      "desativado": true,
      "doisFatores": true,
      "ultimoAcesso": "2026-09-30T18:12:00.000Z",
      "convitePendente": null,
      "version": 3
    }
  ]
};

// 6.14 Configurações
export const configuracoes={
  "chavePix": "pix@exemplo.test",
  "whatsappAtendimento": "5521900000000",
  "modeloMensagem": "Olá, {responsavel}! Aqui é do Nexus. A assinatura do plano {plano} da {empresa} {prazo}, no valor de {valor}. Para renovar, faça o Pix para a chave {chave_pix} e mande o comprovante por aqui. Obrigado!",
  "toleranciaDias": 10,
  "variaveis": [
    {
      "chave": "responsavel",
      "descricao": "Responsável pelo cliente (ou o nome do cliente, se não houver)",
      "exemplo": "Marina Souza"
    },
    {
      "chave": "cliente",
      "descricao": "Nome do cliente",
      "exemplo": "Clínica Vida Plena"
    },
    {
      "chave": "empresa",
      "descricao": "Empresa do guia (ou o nome do cliente, se não houver)",
      "exemplo": "Clínica Vida Plena · Centro"
    },
    {
      "chave": "plano",
      "descricao": "Nome do plano",
      "exemplo": "Premium"
    },
    {
      "chave": "valor",
      "descricao": "Valor de um ciclo",
      "exemplo": "R$ 99,00"
    },
    {
      "chave": "vencimento",
      "descricao": "Data do vencimento",
      "exemplo": "15/10/2026"
    },
    {
      "chave": "prazo",
      "descricao": "\"vence em…\", \"vence hoje\" ou \"venceu em…\"",
      "exemplo": "venceu em 15/10/2026"
    },
    {
      "chave": "chave_pix",
      "descricao": "Chave Pix das Configurações",
      "exemplo": "pix@exemplo.test"
    },
    {
      "chave": "desempenho",
      "descricao": "Visitas e contatos pelo WhatsApp do mês anterior no guia (fica vazia sem medição ou sem visitas)",
      "exemplo": "Seu anúncio teve 312 visitas e 41 contatos pelo WhatsApp em setembro."
    }
  ],
  "modeloRelatorio": "Olá, {responsavel}! Aqui é do Nexus. {desempenho} O relatório de {mes} da {empresa} está neste link: {link}",
  "variaveisRelatorio": [
    {"chave": "responsavel", "descricao": "Responsável pelo cliente (ou o nome do cliente, se não houver)", "exemplo": "Marina Souza"},
    {"chave": "cliente", "descricao": "Nome do cliente", "exemplo": "Clínica Vida Plena"},
    {"chave": "empresa", "descricao": "Empresa do guia do relatório", "exemplo": "Clínica Vida Plena · Centro"},
    {"chave": "mes", "descricao": "Mês do relatório", "exemplo": "setembro de 2026"},
    {"chave": "desempenho", "descricao": "Visitas e contatos pelo WhatsApp no mês do relatório (fica vazia sem medição ou sem visitas)", "exemplo": "Seu anúncio teve 312 visitas e 41 contatos pelo WhatsApp em setembro."},
    {"chave": "link", "descricao": "Endereço do relatório no painel do site (pede login)", "exemplo": "https://nexus.demo/painel/clinica-vida-plena-centro/relatorio/2026-09"}
  ],
  "atualizadoEm": "2026-10-20T11:00:00.000Z",
  "atualizadoPor": {
    "id": "6f1c2a9e-0b7d-4c3e-9a51-2d8f4b6e7c10",
    "nome": "Lucas"
  },
  "version": 2
};

// 6.15 Auditoria
export const auditoria={
  "itens": [
    {
      "id": "d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f51",
      "em": "2026-10-15T14:10:40.000Z",
      "acao": "pagamento_registrado",
      "recurso": {
        "tipo": "assinatura",
        "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02"
      },
      "por": {
        "id": "a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21",
        "nome": "Ana",
        "email": "ana@exemplo.test"
      },
      "antes": {
        "venceEm": "2026-10-15"
      },
      "depois": {
        "venceEm": "2026-11-15",
        "valorCentavos": 6700,
        "forma": "pix"
      },
      "ip": "203.0.113.7"
    }
  ],
  "total": 1,
  "pagina": 1,
  "paginas": 1,
  "opcoes": {
    "acoes": [
      "login",
      "login_falha",
      "pagamento_registrado",
      "pagamento_estornado"
    ],
    "pessoas": [
      {
        "id": "a3d9e8f1-5c2b-4e7a-8d10-9b6c5f4e3a21",
        "nome": "Ana"
      }
    ]
  }
};

// 6.16 Erro
export const erro={
  "status": 403,
  "mensagem": "O seu papel não permite abrir esta tela."
};

// 6.17 Indicadores
export const indicadores={
  "hoje": "2026-10-20",
  "meses": [
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
    "2026-03",
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-07",
    "2026-08",
    "2026-09",
    "2026-10"
  ],
  "recebido": {
    "como": "Pagamentos registrados com data no mês, menos os estornos feitos no mês. O estorno desconta no mês em que foi feito.",
    "meses": [
      {
        "mes": "2025-11",
        "centavos": 0,
        "pagos": {
          "qtd": 0,
          "centavos": 0
        },
        "estornados": {
          "qtd": 0,
          "centavos": 0
        },
        "parcial": false
      },
      {
        "mes": "2026-09",
        "centavos": 51700,
        "pagos": {
          "qtd": 6,
          "centavos": 61600
        },
        "estornados": {
          "qtd": 1,
          "centavos": 9900
        },
        "parcial": false
      },
      {
        "mes": "2026-10",
        "centavos": 53600,
        "pagos": {
          "qtd": 5,
          "centavos": 53600
        },
        "estornados": {
          "qtd": 0,
          "centavos": 0
        },
        "parcial": true
      }
    ],
    "total": 105300
  },
  "mrr": {
    "como": "Assinaturas que, no último dia de cada mês (hoje, no mês atual), já tinham começado e não estavam suspensas nem canceladas, cada uma com o valor de hoje dividido pelos meses do ciclo. As inadimplentes entram.",
    "meses": [
      {
        "mes": "2025-11",
        "centavos": 0,
        "assinaturas": 0,
        "parcial": false
      },
      {
        "mes": "2026-09",
        "centavos": 186700,
        "assinaturas": 21,
        "parcial": false
      },
      {
        "mes": "2026-10",
        "centavos": 196600,
        "assinaturas": 23,
        "parcial": true
      }
    ]
  },
  "movimento": {
    "como": "Novas pelo mês do início e canceladas pelo mês do cancelamento, com a receita mensal de cada uma.",
    "meses": [
      {
        "mes": "2025-11",
        "novas": {
          "qtd": 0,
          "centavos": 0
        },
        "canceladas": {
          "qtd": 0,
          "centavos": 0
        },
        "parcial": false
      },
      {
        "mes": "2026-10",
        "novas": {
          "qtd": 2,
          "centavos": 16600
        },
        "canceladas": {
          "qtd": 1,
          "centavos": 6700
        },
        "parcial": true
      }
    ]
  },
  "previsao": {
    "como": "Assinaturas ativas que vencem nos próximos 30 dias, por semana, com o valor de um ciclo. Atrasadas são as que já venceram e ainda não foram pagas.",
    "de": "2026-10-20",
    "ate": "2026-11-19",
    "semanas": [
      {
        "de": "2026-10-20",
        "ate": "2026-10-26",
        "qtd": 1,
        "centavos": 18000,
        "itens": [
          {
            "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02",
            "cliente": {
              "id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f62",
              "nome": "Padaria Pão Dourado"
            },
            "empresa": {
              "id": "padaria-pao-dourado",
              "nome": "Padaria Pão Dourado"
            },
            "plano": {
              "id": "plano-avancado",
              "nome": "Avançado"
            },
            "venceEm": "2026-10-24",
            "dias": 4,
            "valorCentavos": 18000,
            "situacao": "a-vencer"
          }
        ]
      },
      {
        "de": "2026-10-27",
        "ate": "2026-11-02",
        "qtd": 0,
        "centavos": 0,
        "itens": []
      },
      {
        "de": "2026-11-03",
        "ate": "2026-11-09",
        "qtd": 1,
        "centavos": 6700,
        "itens": []
      },
      {
        "de": "2026-11-10",
        "ate": "2026-11-16",
        "qtd": 2,
        "centavos": 18700,
        "itens": []
      },
      {
        "de": "2026-11-17",
        "ate": "2026-11-19",
        "qtd": 0,
        "centavos": 0,
        "itens": []
      }
    ],
    "total": {
      "qtd": 4,
      "centavos": 43400
    },
    "atrasadas": {
      "vencidas": {
        "qtd": 1,
        "centavos": 9900
      },
      "inadimplentes": {
        "qtd": 1,
        "centavos": 9900
      }
    }
  },
  "inadimplencia": {
    "como": "Assinaturas ativas vencidas há mais de 10 dias (a tolerância das Configurações), pelos dias de atraso, com o valor de um ciclo.",
    "qtd": 1,
    "centavos": 9900,
    "faixas": [
      {
        "de": 1,
        "ate": 30,
        "qtd": 1,
        "centavos": 9900
      },
      {
        "de": 31,
        "ate": 60,
        "qtd": 0,
        "centavos": 0
      },
      {
        "de": 61,
        "ate": 90,
        "qtd": 0,
        "centavos": 0
      },
      {
        "de": 91,
        "ate": null,
        "qtd": 0,
        "centavos": 0
      }
    ]
  },
  "planos": {
    "como": "Assinaturas ativas que não estão inadimplentes, com o valor dividido pelos meses do ciclo: a mesma conta da receita mensal do Resumo.",
    "itens": [
      {
        "plano": {
          "id": "plano-premium",
          "nome": "Premium"
        },
        "assinaturas": 12,
        "centavos": 118800
      },
      {
        "plano": {
          "id": "plano-avancado",
          "nome": "Avançado"
        },
        "assinaturas": 9,
        "centavos": 67900
      },
      {
        "plano": null,
        "assinaturas": 1,
        "centavos": 0
      }
    ],
    "assinaturas": 22,
    "mrr": 186700,
    "valorMedio": 8486
  },
  "audiencia": {
    "como": "Visitas e contatos dos visitantes que aceitaram a medição no site; buscas contadas pelo servidor do site, sem dado pessoal. Mês sem medição aparece em branco.",
    "disponivel": true,
    "atualizadaEm": "2026-10-20T08:00:41.000Z",
    "medidoDesde": {
      "contatos": "2026-07-28",
      "buscas": "2026-10-01"
    },
    "meses": [
      {
        "mes": "2025-11",
        "visitas": null,
        "contatos": null,
        "contatosTotal": null,
        "buscas": null,
        "buscasSemResultado": null,
        "parcial": false
      },
      {
        "mes": "2026-10",
        "visitas": 1240,
        "contatos": {
          "whatsapp": 96,
          "telefone": 21,
          "rota": 34,
          "site": 8
        },
        "contatosTotal": 159,
        "buscas": 310,
        "buscasSemResultado": 22,
        "parcial": true
      }
    ],
    "buscasMaisFeitas": [
      {
        "termo": "pizzaria",
        "vezes": 41
      },
      {
        "termo": "farmacia",
        "vezes": 17
      }
    ],
    "buscasSemResultado": [
      {
        "termo": "chaveiro 24 horas",
        "vezes": 6
      }
    ],
    "bairros": [
      {
        "bairro": "Centro",
        "vezes": 58
      }
    ],
    "categorias": [
      {
        "categoria": "alimentacao",
        "nome": "Alimentação",
        "vezes": 77
      }
    ]
  },
  "anunciantes": {
    "como": "Empresas com assinatura ativa na gestão, com as visitas e os contatos dos últimos 30 dias no guia. Em risco: vence em até 30 dias e recebeu menos de 5 contatos. Sem medição: o site não mede a empresa, porque ela não está publicada; fica fora das listas e do risco.",
    "disponivel": true,
    "atualizadaEm": "2026-10-20T08:00:41.000Z",
    "base": 22,
    "semMedicao": [
      {
        "empresa": {
          "id": "studio-bella",
          "nome": "Studio Bella"
        },
        "cliente": {
          "id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f63",
          "nome": "Studio Bella"
        },
        "assinatura": {
          "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c03",
          "venceEm": "2026-11-05",
          "dias": 16,
          "situacao": "a-vencer"
        }
      }
    ],
    "maisContatos": [
      {
        "empresa": {
          "id": "clinica-vida-plena-centro",
          "nome": "Clínica Vida Plena · Centro"
        },
        "cliente": {
          "id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f61",
          "nome": "Clínica Vida Plena"
        },
        "assinatura": {
          "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01",
          "venceEm": "2026-11-15",
          "dias": 26,
          "situacao": "a-vencer"
        },
        "visitas30": 412,
        "contatos30": 41,
        "contatos30Canais": {
          "whatsapp": 30,
          "telefone": 6,
          "rota": 4,
          "site": 1
        }
      }
    ],
    "menosContatos": [
      {
        "empresa": {
          "id": "padaria-pao-dourado",
          "nome": "Padaria Pão Dourado"
        },
        "cliente": {
          "id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f62",
          "nome": "Padaria Pão Dourado"
        },
        "assinatura": {
          "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02",
          "venceEm": "2026-10-24",
          "dias": 4,
          "situacao": "a-vencer"
        },
        "visitas30": 38,
        "contatos30": 2,
        "contatos30Canais": {
          "whatsapp": 2,
          "telefone": 0,
          "rota": 0,
          "site": 0
        }
      }
    ],
    "emRisco": [
      {
        "empresa": {
          "id": "padaria-pao-dourado",
          "nome": "Padaria Pão Dourado"
        },
        "cliente": {
          "id": "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f62",
          "nome": "Padaria Pão Dourado"
        },
        "assinatura": {
          "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02",
          "venceEm": "2026-10-24",
          "dias": 4,
          "situacao": "a-vencer"
        },
        "visitas30": 38,
        "contatos30": 2,
        "contatos30Canais": {
          "whatsapp": 2,
          "telefone": 0,
          "rota": 0,
          "site": 0
        }
      }
    ],
    "banners": [
      {
        "id": "padaria-pao-de-queijo",
        "titulo": "Pão de queijo em dobro",
        "empresa": {
          "id": "padaria-pao-dourado",
          "nome": "Padaria Pão Dourado"
        },
        "impressoes": 4210,
        "cliques": 63,
        "ctr": 0.015
      }
    ]
  },
  "funil": null
};

// Interessados (14.4 e 14.6, v0.13.0): a lista com a leitura, o Lead e o funil dos Indicadores, como no contrato.
export const leadsLista={
  "itens": [
    {"id": "5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e41", "codigo": "C4MN", "nome": "", "whatsapp": "", "situacao": "novo", "pedidoEm": "2026-10-20T09:30:00.000Z", "proximaAcao": "", "proximaEm": null},
    {"id": "6d2e3f4a-5b6c-4d7e-9f80-a1b2c3d4e5f2", "codigo": "A7K3", "nome": "Marta Souza", "whatsapp": "5521987654321", "situacao": "em-conversa", "pedidoEm": "2026-10-19T14:00:00.000Z", "proximaAcao": "Mandar a tabela de planos", "proximaEm": "2026-10-22"}
  ],
  "total": 2,
  "pagina": 1,
  "paginas": 1,
  "leitura": {"lidoEm": "2026-10-20T08:00:03.000Z", "erro": "", "tentadoEm": "2026-10-20T08:00:03.000Z"}
};
export const lead={
  "id": "6d2e3f4a-5b6c-4d7e-9f80-a1b2c3d4e5f2",
  "codigo": "A7K3",
  "texto": "Olá, Lucas! Tenho interesse em me tornar afiliado ao Nexus.\n\nMeu negócio é do ramo de alimentação. Ele fica em Nova Iguaçu.\n\nQuero ajuda para escolher o melhor plano.\n\nEnviado pelo site site.exemplo.test\nPedido A7K3",
  "respostas": {"ramo": "alimentacao", "local": "nova-iguacu", "plano": "conhecer"},
  "origem": "plano-premium",
  "pedidoEm": "2026-10-19T14:00:00.000Z",
  "recebidoEm": "2026-10-20T08:00:03.000Z",
  "nome": "Marta Souza",
  "whatsapp": "5521987654321",
  "situacao": "em-conversa",
  "motivoPerda": "",
  "perdidoEm": null,
  "proximaAcao": "Mandar a tabela de planos",
  "proximaEm": "2026-10-22",
  "notas": "Padaria em Austin.",
  "cliente": null,
  "virouClienteEm": null,
  "atualizadoEm": "2026-10-20T11:40:00.000Z",
  "version": 2
};
export const funil={
  "como": "Pedidos do cadastro do site pelo mês do pedido, convertidos pelo mês em que viraram cliente e perdidos pelo mês em que foram dados como perdidos. Os motivos e o tempo até virar cliente contam os 12 meses.",
  "meses": [
    {"mes": "2026-08", "novos": 1, "convertidos": 1, "perdidos": 0, "parcial": false},
    {"mes": "2026-09", "novos": 1, "convertidos": 1, "perdidos": 0, "parcial": false},
    {"mes": "2026-10", "novos": 4, "convertidos": 0, "perdidos": 3, "parcial": true}
  ],
  "motivosPerda": [{"motivo": "Preço alto", "qtd": 2}, {"motivo": "Sem resposta", "qtd": 1}],
  "tempoAteCliente": {"convertidos": 2, "medianaDias": 7}
};

// Régua de lembretes (15.4 e 15.5, v0.14.0): o que as Configurações ganham e a janela "Lembrar hoje", como no contrato.
export const configuracoesRegua={
  "etapas": [
    {"dias": 30, "nome": "30 dias antes"},
    {"dias": 15, "nome": "15 dias antes"},
    {"dias": 7, "nome": "7 dias antes"},
    {"dias": 1, "nome": "1 dia antes"},
    {"dias": 0, "nome": "No dia do vencimento"}
  ],
  "modelosLembrete": {"0": "", "1": "", "7": "", "15": "", "30": ""}
};
export const renovacoesLembrar={
  "janela": "lembrar",
  "contagem": {"vencidas": 2, "ate7": 1, "ate15": 1, "ate30": 4, "lembrar": 2},
  "etapas": [
    {"dias": 30, "nome": "30 dias antes"},
    {"dias": 15, "nome": "15 dias antes"},
    {"dias": 7, "nome": "7 dias antes"},
    {"dias": 1, "nome": "1 dia antes"},
    {"dias": 0, "nome": "No dia do vencimento"}
  ],
  "itens": [
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c03",
      "cliente": {"id": "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e52", "nome": "Padaria Pão Dourado", "responsavel": "Carlos Lima", "whatsapp": "5521900000002"},
      "empresa": {"id": "padaria-pao-dourado", "nome": "Padaria Pão Dourado", "miniatura": "", "url": "https://nexus.demo/comercio/padaria-pao-dourado"},
      "plano": {"id": "plano-avancado", "nome": "Avançado"},
      "valorCentavos": 18000,
      "ciclo": "trimestral",
      "venceEm": "2026-10-24",
      "dias": 4,
      "situacao": "a-vencer",
      "etapa": 7,
      "ultimoContato": {"em": "2026-10-09T14:05:00.000Z", "por": {"id": "c7e1b2a4-9f3d-4a6b-8e5c-1d2f3a4b5c67", "nome": "Bruno"}, "tipo": "lembrete", "etapa": 15},
      "linkWhatsapp": "https://wa.me/5521900000002?text=Ol%C3%A1%2C%20Carlos%20Lima!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Avan%C3%A7ado%20da%20Padaria%20P%C3%A3o%20Dourado%20vence%20em%2024%2F10%2F2026%2C%20no%20valor%20de%20R%24%20180%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 1
    },
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c02",
      "cliente": {"id": "0b9f6a3e-1c2d-4e5f-8a7b-9c0d1e2f3a41", "nome": "Clínica Vida Plena", "responsavel": "Marina Souza", "whatsapp": "5521900000001"},
      "empresa": {"id": "clinica-vida-plena-austin", "nome": "Clínica Vida Plena · Austin", "miniatura": "https://nexus.demo/midia/4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d/320.webp", "url": "https://nexus.demo/comercio/clinica-vida-plena-austin"},
      "plano": {"id": "plano-avancado", "nome": "Avançado"},
      "valorCentavos": 6700,
      "ciclo": "mensal",
      "venceEm": "2026-11-15",
      "dias": 26,
      "situacao": "a-vencer",
      "etapa": 30,
      "ultimoContato": null,
      "linkWhatsapp": "https://wa.me/5521900000001?text=Ol%C3%A1%2C%20Marina%20Souza!%20Aqui%20%C3%A9%20do%20Nexus.%20A%20assinatura%20do%20plano%20Avan%C3%A7ado%20da%20Cl%C3%ADnica%20Vida%20Plena%20%C2%B7%20Austin%20vence%20em%2015%2F11%2F2026%2C%20no%20valor%20de%20R%24%2067%2C00.%20Para%20renovar%2C%20fa%C3%A7a%20o%20Pix%20para%20a%20chave%20pix%40exemplo.test%20e%20mande%20o%20comprovante%20por%20aqui.%20Obrigado!",
      "version": 4
    }
  ],
  "total": 2,
  "pagina": 1,
  "paginas": 1
};

export const SECOES={
  "15.4 As mensagens": [
    "configuracoesRegua"
  ],
  "15.5 Resumo e Renovações": [
    "renovacoesLembrar"
  ],
  "14.4 APIs": [
    "leadsLista",
    "lead"
  ],
  "14.6 O funil nos Indicadores": [
    "funil"
  ],
  "6.1 Rotas e moldura": [
    "moldura"
  ],
  "6.2 Entrar": [
    "entrarSenha",
    "entrarConfigurar"
  ],
  "6.3 Definir senha": [
    "definirSenha"
  ],
  "6.4 Resumo": [
    "resumo"
  ],
  "6.5 Renovações": [
    "renovacoes"
  ],
  "6.6 Clientes": [
    "clientes"
  ],
  "6.7 Ficha do cliente": [
    "ficha"
  ],
  "6.8 Cliente (criar e editar)": [
    "clienteNovo"
  ],
  "6.9 Assinatura (criar e editar)": [
    "assinaturaNova"
  ],
  "6.10 Registrar pagamento": [
    "pagamento"
  ],
  "6.11 Importação": [
    "importacoes"
  ],
  "6.12 Prévia da importação": [
    "importacao"
  ],
  "6.13 Equipe": [
    "equipe"
  ],
  "6.14 Configurações": [
    "configuracoes"
  ],
  "6.15 Auditoria": [
    "auditoria"
  ],
  "6.16 Erro": [
    "erro"
  ],
  "6.17 Indicadores": [
    "indicadores"
  ]
};

// Página com a moldura (6.1): a mesma pessoa, o mesmo csrf e os mesmos avisos, com a tela, os filtros e os dados de cada uma.
export const tela=(nome,dados,{filtros={},...resto}={})=>({...structuredClone(moldura),tela:nome,filtros,dados:structuredClone(dados),...resto});
// O pode de cada papel (contrato 3.1), para conferir o que cada um vê.
export const PODE={
  admin:{clientes:true,assinaturas:true,pagamentos:true,cobrar:true,importar:true,equipe:true,configuracoes:true,auditoria:true},
  financeiro:{clientes:false,assinaturas:true,pagamentos:true,cobrar:true,importar:false,equipe:false,configuracoes:false,auditoria:false},
  comercial:{clientes:true,assinaturas:true,pagamentos:false,cobrar:true,importar:false,equipe:false,configuracoes:false,auditoria:false},
  leitura:{clientes:false,assinaturas:false,pagamentos:false,cobrar:false,importar:false,equipe:false,configuracoes:false,auditoria:false}
};
export const comPapel=(vm,papel)=>({...vm,usuario:{...vm.usuario,papel},pode:{...PODE[papel]}});
