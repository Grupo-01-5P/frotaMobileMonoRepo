import prisma from "../config/database.js";

export const list = async (req, res, next) => {
  /*
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Lista todos os orçamentos"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['_limit'] = {
      in: 'query',
      description: 'Número de itens por página',
      required: false,
      type: 'integer',
      default: 10
    }
    #swagger.parameters['_page'] = {
      in: 'query',
      description: 'Página atual',
      required: false,
      type: 'integer',
      default: 1
    }
    #swagger.parameters['_sort'] = {
      in: 'query',
      description: 'Campo para ordenação (id, descricaoServico, valorMaoObra, status)',
      required: false,
      type: 'string'
    }
    #swagger.parameters['_order'] = {
      in: 'query',
      description: 'Direção da ordenação (asc ou desc)',
      required: false,
      type: 'string',
      enum: ['asc', 'desc']
    }
    #swagger.responses[200] = {
      description: "Lista de orçamentos com paginação"
    }
  */
  try {
    const page = parseInt(req.query._page) || 1;
    const limit = parseInt(req.query._limit) || 10;
    const offset = (page - 1) * limit;

    const totalItems = await prisma.orcamento.count();
    const totalPages = Math.ceil(totalItems / limit);

    const order = req.query._order?.toLowerCase() === "desc" ? "desc" : "asc";
    const sort = req.query._sort;
    const validSortFields = ["id", "descricaoServico", "valorMaoObra", "status"];
    const orderBy = validSortFields.includes(sort) ? { [sort]: order } : undefined;

    const orcamentos = await prisma.orcamento.findMany({
      skip: offset,
      take: limit,
      ...(orderBy && { orderBy }),
      include: {
        manutencao: {
          select: {
            id: true, // Incluindo id da manutencao para referência
            veiculo: {
              select: {
                placa: true,
              },
            },
          },
        },
        oficina: { // Incluindo informações básicas da oficina
          select: {
            id: true,
            nome: true,
          }
        },
        produtos: {
          include: {
            produto: true,
          },
        },
      },
    });

    return res.ok({
      data: orcamentos,
      meta: {
        totalItems,
        currentPage: page,
        totalPages,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getById = async (req, res, next) => {
  /*
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Busca orçamento por ID"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.responses[200]
    #swagger.responses[404] = { description: "Orçamento não encontrado" }
  */
  try {
    const id = parseInt(req.params.id);
    const orcamento = await prisma.orcamento.findUnique({
      where: { id },
      include: {
        manutencao: {
          include: {
            veiculo: true,
          }
        },
        oficina: true,
        produtos: {
          include: {
            produto: true,
          },
        },
      },
    });
    if (!orcamento) return res.status(404).json({ error: "Orçamento não encontrado." });

    return res.ok(res.hateos_item(orcamento));
  } catch (error) {
    return next(error);
  }
};

export const create = async (req, res, next) => {
  /*
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Cria um novo orçamento"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              descricaoServico: { type: "string" },
              valorMaoObra: { type: "number" },
              status: { type: "string", default: "pendente", description: "Opcional. Default: 'pendente'" },
              dataEnvio: { type: "string", format: "date-time", description: "Opcional. Se não fornecido, usa a data atual." },
              manutencaoId: { type: "integer" },
              oficinaId: { type: "integer" },
              produtos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    produtoId: { type: "integer" },
                    valorUnitario: { type: "number" },
                    fornecedor: { type: "string" }
                  },
                  required: ["produtoId", "valorUnitario", "fornecedor"]
                },
                description: "Lista de produtos para o orçamento. Opcional."
              }
            },
            required: ["descricaoServico", "valorMaoObra", "manutencaoId", "oficinaId"]
          }
        }
      }
    }
    #swagger.responses[201] = { description: "Orçamento criado com sucesso" }
  */
  try {
    const { produtos, dataEnvio, ...restOfBody } = req.body;

    const dataParaCriar = {
      ...restOfBody,
      ...(dataEnvio && { dataEnvio: new Date(dataEnvio).toISOString() }), 
    };

    if (produtos && Array.isArray(produtos) && produtos.length > 0) {
      dataParaCriar.produtos = {
        create: produtos.map(produto => ({
          produtoId: produto.produtoId,
          valorUnitario: produto.valorUnitario,
          fornecedor: produto.fornecedor,
        })),
      };
    }

    const orcamento = await prisma.orcamento.create({
      data: dataParaCriar,
      include: { 
        manutencao: { include: { veiculo: true } },
        oficina: true,
        produtos: { include: { produto: true } },
      },
    });

    return res.created(res.hateos_item(orcamento));
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('manutencaoId')) {
      return res.status(409).json({ error: "Já existe um orçamento para esta manutenção." });
    }
    return next(error);
  }
};

export const update = async (req, res, next) => {
  /*
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Atualiza um orçamento existente"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              descricaoServico: { type: "string" },
              valorMaoObra: { type: "number" },
              status: { type: "string" },
              dataEnvio: { type: "string", format: "date-time" },
              manutencaoId: { type: "integer", description: "Atenção: alterar pode reassociar o orçamento." },
              oficinaId: { type: "integer" },
              produtos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    produtoId: { type: "integer" },
                    valorUnitario: { type: "number" },
                    fornecedor: { type: "string" }
                  },
                  required: ["produtoId", "valorUnitario", "fornecedor"]
                },
                description: "Lista completa de produtos. Substituirá os produtos existentes. Envie array vazio para remover todos os produtos."
              }
            }
          }
        }
      }
    }
    #swagger.responses[200] = { description: "Atualizado com sucesso, retorna o orçamento atualizado" }
    #swagger.responses[404] = { description: "Orçamento não encontrado" }
  */
  try {
    const id = parseInt(req.params.id);
    const { produtos, dataEnvio, ...restOfBody } = req.body;

    // Verificar se o orçamento existe
    const existingOrcamento = await prisma.orcamento.findUnique({ where: { id } });
    if (!existingOrcamento) {
      return res.status(404).json({ error: "Orçamento não encontrado." });
    }

    const updatedOrcamento = await prisma.$transaction(async (tx) => {
      // 1. Atualizar os campos escalares do Orcamento
      await tx.orcamento.update({
        where: { id },
        data: {
          ...restOfBody,
          ...(dataEnvio && { dataEnvio: new Date(dataEnvio).toISOString() }),
        },
      });

      // 2. Gerenciar a relação 'produtos' se 'produtos' for fornecido no corpo da requisição
      if (typeof produtos !== 'undefined') {
        // 2a. Remover todos os ProdutoOrcamento existentes para este orçamento
        await tx.produtoOrcamento.deleteMany({
          where: { orcamentoId: id },
        });

        // 2b. Criar os novos ProdutoOrcamento se a lista não for vazia
        if (Array.isArray(produtos) && produtos.length > 0) {
          await tx.produtoOrcamento.createMany({
            data: produtos.map(p => ({
              orcamentoId: id, // Associar ao orçamento atual
              produtoId: p.produtoId,
              valorUnitario: p.valorUnitario,
              fornecedor: p.fornecedor,
            })),
          });
        }
      }

      // 3. Buscar e retornar o orçamento completamente atualizado
      return tx.orcamento.findUnique({
        where: { id },
        include: {
          manutencao: { include: { veiculo: true } },
          oficina: true,
          produtos: { include: { produto: true } },
        },
      });
    });

    return res.ok(res.hateos_item(updatedOrcamento));
  } catch (error) {
     if (error.code === 'P2002' && error.meta?.target?.includes('manutencaoId')) {
      return res.status(409).json({ error: "Já existe um orçamento para esta manutenção." });
    }
    // P2025 é "Record to update not found", mas já verificamos a existência.
    // No entanto, pode acontecer em condições de corrida ou se a transação falhar por outro motivo.
    if (error.code === 'P2025') {
        return res.status(404).json({ error: "Operação falhou: Orçamento não encontrado." });
    }
    return next(error);
  }
};

export const remove = async (req, res, next) => {
  /*
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Remove um orçamento"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.responses[204] = { description: "Removido com sucesso" }
    #swagger.responses[404] = { description: "Orçamento não encontrado" }
  */
  try {
    const id = parseInt(req.params.id);

    // A transação garante que ambas as operações (ou nenhuma) sejam concluídas.
    // O Prisma geralmente lida com a ordem de exclusão de dependências,
    // mas a exclusão explícita de ProdutoOrcamento é mais segura.
    await prisma.$transaction(async (tx) => {
      // 1. Deletar os ProdutoOrcamento associados
      await tx.produtoOrcamento.deleteMany({
        where: { orcamentoId: id },
      });
      // 2. Deletar o Orcamento
      // Se o orçamento não existir, o Prisma lançará um erro P2025.
      await tx.orcamento.delete({
        where: { id },
      });
    });

    return res.no_content();
  } catch (error) {
    if (error.code === 'P2025') { // "Record to delete not found"
      return res.status(404).json({ error: "Orçamento não encontrado." });
    }
    return next(error); // Outros erros são passados para o manipulador de erros global
  }
};