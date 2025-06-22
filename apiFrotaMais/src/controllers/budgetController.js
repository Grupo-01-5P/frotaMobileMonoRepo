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

    // Buscar o orçamento para verificar se existe e obter dados necessários
    const orcamento = await prisma.orcamento.findUnique({
      where: { id },
    });

    if (!orcamento) {
      return res.status(404).json({ error: "Orçamento não encontrado." });
    }

    console.log("Removendo orçamento:", orcamento);

    // Executar todas as operações em uma única transação
    await prisma.$transaction(async (tx) => {
      // 1. Deletar os ProdutoOrcamento associados
      await tx.produtoOrcamento.deleteMany({
        where: { orcamentoId: id },
      });

      // 2. Deletar o orçamento
      await tx.orcamento.delete({
        where: { id },
      });

      // 3. ✅ CORREÇÃO: Voltar status da manutenção para "pendente" se existir
      if (orcamento.manutencaoId) {
        await tx.manutencao.update({
          where: { id: orcamento.manutencaoId },
          data: { status: "aprovada" }
        });
      }
    });

    return res.status(204).send(); // ou res.no_content() se você tem esse método customizado
  } catch (error) {
    if (error.code === 'P2025') { 
      // "Record to delete not found" - pode acontecer se o orçamento for deletado entre a verificação e a deleção
      return res.status(404).json({ error: "Orçamento não encontrado." });
    }
    
    console.error("Erro ao remover orçamento:", error);
    return next(error); // Outros erros são passados para o manipulador de erros global
  }
};

export const addProductToOrcamento = async (req, res, next) => {
  /*
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Adiciona um produto a um orçamento existente"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['orcamentoId'] = {
      in: 'path',
      description: 'ID do Orçamento',
      required: true,
      type: 'integer'
    }
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              produtoId: { type: "integer" },
              valorUnitario: { type: "number" },
              fornecedor: { type: "string" }
            },
            required: ["produtoId", "valorUnitario", "fornecedor"]
          }
        }
      }
    }
    #swagger.responses[201] = { description: "Produto adicionado com sucesso" }
    #swagger.responses[404] = { description: "Orçamento ou Produto não encontrado" }
    #swagger.responses[409] = { description: "Este produto já existe no orçamento" }
  */
  try {
    const orcamentoId = parseInt(req.params.orcamentoId);
    const { produtoId, valorUnitario, fornecedor } = req.body;

    // Usar transação para garantir a integridade dos dados
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verificar se o orçamento e o produto existem
      const orcamento = await tx.orcamento.findUnique({ where: { id: orcamentoId } });
      if (!orcamento) {
        // Lançar um erro customizado para ser capturado no catch do transaction
        throw new Error('ORCAMENTO_NOT_FOUND');
      }

      const produto = await tx.produto.findUnique({ where: { id: produtoId } });
      if (!produto) {
        throw new Error('PRODUTO_NOT_FOUND');
      }
      
      // 2. Verificar se a combinação produto-orçamento já existe
      const existingEntry = await tx.produtoOrcamento.findFirst({
        where: {
          orcamentoId: orcamentoId,
          produtoId: produtoId,
        },
      });

      if (existingEntry) {
        throw new Error('PRODUCT_ALREADY_IN_ORCAMENTO');
      }

      // 3. Criar a nova entrada em ProdutoOrcamento
      const newProdutoOrcamento = await tx.produtoOrcamento.create({
        data: {
          orcamentoId,
          produtoId,
          valorUnitario,
          fornecedor,
        },
        include: {
            produto: true // Incluir dados do produto na resposta
        }
      });

      return newProdutoOrcamento;
    });

    return res.status(201).json(result);
  } catch (error) {
    if (error.message === 'ORCAMENTO_NOT_FOUND') {
      return res.status(404).json({ error: "Orçamento não encontrado." });
    }
    if (error.message === 'PRODUTO_NOT_FOUND') {
      return res.status(404).json({ error: "Produto não encontrado." });
    }
    if (error.message === 'PRODUCT_ALREADY_IN_ORCAMENTO') {
        return res.status(409).json({ error: "Este produto já consta no orçamento." });
    }
    return next(error);
  }
};

export const removeProductFromOrcamento = async (req, res, next) => {
  /*
    #swagger.tags = ["Orçamentos"]
    #swagger.summary = "Remove um produto de um orçamento"
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['orcamentoId'] = {
      in: 'path',
      description: 'ID do Orçamento',
      required: true,
      type: 'integer'
    }
    #swagger.parameters['produtoId'] = {
      in: 'path',
      description: 'ID do Produto a ser removido',
      required: true,
      type: 'integer'
    }
    #swagger.responses[204] = { description: "Produto removido com sucesso" }
    #swagger.responses[404] = { description: "Associação Produto-Orçamento não encontrada" }
  */
  try {
    const orcamentoId = parseInt(req.params.orcamentoId);
    const produtoId = parseInt(req.params.produtoId);

    // Para deletar, precisamos do ID da tabela ProdutoOrcamento.
    // Primeiro, encontramos a entrada específica.
    const produtoOrcamentoEntry = await prisma.produtoOrcamento.findFirst({
        where: {
            orcamentoId: orcamentoId,
            produtoId: produtoId
        }
    });

    if (!produtoOrcamentoEntry) {
        return res.status(404).json({ error: "Produto não encontrado neste orçamento." });
    }

    // Agora deletamos usando o ID único da entrada.
    await prisma.produtoOrcamento.delete({
        where: {
            id: produtoOrcamentoEntry.id
        }
    });

    return res.no_content(); // Retorna 204 No Content
  } catch (error) {
    // Tratamento de erro caso o ID não seja um número válido, por exemplo.
    if (error instanceof TypeError || error instanceof ReferenceError) {
        return res.status(400).json({ error: "Parâmetros inválidos." });
    }
    return next(error);
  }
};