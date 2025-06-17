import prisma from "../config/database.js";

const checkAnalistaRole = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assumindo que o ID do usuário está disponível após autenticação
    const user = await prisma.usuario.findUnique({
      where: { id: userId }
    });

    if (!user || user.funcao !== 'analista') {
      return res.forbidden({ message: "Apenas analistas podem realizar operações com produtos." });
    }

    next();
  } catch (error) {
    return next(error);
  }
};

export const listProducts = async (req, res, next) => {
  /*
    #swagger.tags = ["Products"]
    #swagger.summary = "Lista todos os produtos"
    #swagger.description = "Endpoint para listar todos os produtos cadastrados. Apenas analistas podem acessar."
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['_page'] = {
      in: 'query',
      description: 'Número da página',
      required: false,
      type: 'integer'
    }
    #swagger.parameters['_limit'] = {
      in: 'query',
      description: 'Limite de itens por página',
      required: false,
      type: 'integer'
    }
    #swagger.responses[200] = {
      description: 'Lista de produtos retornada com sucesso',
      schema: {
        data: [{
          id: 1,
          nome: "Óleo de Motor",
          descricao: "Óleo sintético 5W30",
          precoMedio: 45.90
        }],
        meta: {
          totalItems: 1,
          currentPage: 1,
          totalPages: 1,
          itemsPerPage: 10,
          hasNextPage: false,
          hasPrevPage: false
        }
      }
    }
    #swagger.responses[403] = {
      description: 'Acesso negado',
      schema: { message: "Apenas analistas podem realizar operações com produtos." }
    }
  */
  try {
    await checkAnalistaRole(req, res, async () => {
      const { _page, _limit, _sort, _order } = req.query;

      const page = parseInt(_page) || 1;
      const limit = parseInt(_limit) || 10;
      const offset = (page - 1) * limit;

      const totalItems = await prisma.produto.count();
      const totalPages = Math.ceil(totalItems / limit);

      const order = _order?.toLowerCase() === "desc" ? "desc" : "asc";
      const validSortFields = ["id", "nome", "precoMedio"];
      const orderBy = validSortFields.includes(_sort) ? { [_sort]: order } : undefined;

      const products = await prisma.produto.findMany({
        skip: offset,
        take: limit,
        ...(orderBy && { orderBy })
      });

      return res.ok({
        data: products,
        meta: {
          totalItems,
          currentPage: page,
          totalPages,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    });
  } catch (error) {
    return next(error);
  }
};

export const getByName = async (req, res, next) => {
  /*
    #swagger.tags = ["Products"]
    #swagger.summary = "Busca produtos por nome"
    #swagger.description = "Endpoint para buscar produtos pelo nome"
    #swagger.parameters['nome'] = {
      in: 'query',
      description: 'Nome do produto',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = {
      description: 'Produtos encontrados com sucesso',
      schema: [{
        id: 1,
        nome: "Óleo de Motor",
        descricao: "Óleo sintético 5W30",
        precoMedio: 45.90
      }]
    }
    #swagger.responses[404] = {
      description: 'Nenhum produto encontrado',
      schema: { message: "Nenhum produto encontrado com este nome." }
    }
  */
  try {
    const { nome } = req.query;

    if (!nome) {
      return res.bad_request({ message: "O nome do produto é obrigatório para a busca." });
    }

    const products = await prisma.produto.findMany({
      where: {
        nome: {
          contains: nome,
          mode: 'insensitive' // Busca case-insensitive
        }
      }
    });

    if (products.length === 0) {
      return res.not_found({ message: "Nenhum produto encontrado com este nome." });
    }

    return res.ok(products);
  } catch (error) {
    return next(error);
  }
};

export const createProduct = async (req, res, next) => {
  /*
    #swagger.tags = ["Products"]
    #swagger.summary = "Cria um novo produto"
    #swagger.description = "Endpoint para criar um novo produto. Apenas analistas podem acessar."
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['body'] = {
      in: 'body',
      description: 'Dados do produto',
      required: true,
      schema: {
        nome: "Óleo de Motor",
        descricao: "Óleo sintético 5W30",
        precoMedio: 45.90
      }
    }
    #swagger.responses[201] = {
      description: 'Produto criado com sucesso',
      schema: {
        id: 1,
        nome: "Óleo de Motor",
        descricao: "Óleo sintético 5W30",
        precoMedio: 45.90
      }
    }
    #swagger.responses[400] = {
      description: 'Dados inválidos',
      schema: { message: "Todos os campos são obrigatórios." }
    }
    #swagger.responses[403] = {
      description: 'Acesso negado',
      schema: { message: "Apenas analistas podem realizar operações com produtos." }
    }
  */
  try {
    await checkAnalistaRole(req, res, async () => {
      const { nome, descricao, precoMedio } = req.body;

      if (!nome || !descricao || !precoMedio) {
        return res.bad_request({ message: "Todos os campos são obrigatórios." });
      }

      const product = await prisma.produto.create({
        data: {
          nome,
          descricao,
          precoMedio: parseFloat(precoMedio)
        }
      });

      return res.created(product);
    });
  } catch (error) {
    return next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  /*
    #swagger.tags = ["Products"]
    #swagger.summary = "Atualiza um produto existente"
    #swagger.description = "Endpoint para atualizar um produto pelo nome. Apenas analistas podem acessar."
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['nome'] = {
      in: 'path',
      description: 'Nome do produto',
      required: true,
      type: 'string'
    }
    #swagger.parameters['body'] = {
      in: 'body',
      description: 'Dados do produto',
      required: true,
      schema: {
        nome: "Óleo de Motor",
        descricao: "Óleo sintético 5W30",
        precoMedio: 45.90
      }
    }
    #swagger.responses[200] = {
      description: 'Produto atualizado com sucesso',
      schema: {
        id: 1,
        nome: "Óleo de Motor",
        descricao: "Óleo sintético 5W30",
        precoMedio: 45.90
      }
    }
    #swagger.responses[404] = {
      description: 'Produto não encontrado',
      schema: { message: "Produto não encontrado." }
    }
    #swagger.responses[403] = {
      description: 'Acesso negado',
      schema: { message: "Apenas analistas podem realizar operações com produtos." }
    }
  */
  try {
    await checkAnalistaRole(req, res, async () => {
      const { nome } = req.params;
      const { nome: novoNome, descricao, precoMedio } = req.body;

      const existingProduct = await prisma.produto.findFirst({
        where: {
          nome: {
            contains: nome,
            mode: 'insensitive'
          }
        }
      });

      if (!existingProduct) {
        return res.not_found({ message: "Produto não encontrado." });
      }

      const updatedProduct = await prisma.produto.update({
        where: { id: existingProduct.id },
        data: {
          nome: novoNome || existingProduct.nome,
          descricao: descricao || existingProduct.descricao,
          precoMedio: precoMedio ? parseFloat(precoMedio) : existingProduct.precoMedio
        }
      });

      return res.ok(updatedProduct);
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  /*
    #swagger.tags = ["Products"]
    #swagger.summary = "Remove um produto"
    #swagger.description = "Endpoint para remover um produto pelo nome. Apenas analistas podem acessar."
    #swagger.security = [{ "BearerAuth": [] }]
    #swagger.parameters['nome'] = {
      in: 'path',
      description: 'Nome do produto',
      required: true,
      type: 'string'
    }
    #swagger.responses[200] = {
      description: 'Produto removido com sucesso',
      schema: { message: "Produto deletado com sucesso." }
    }
    #swagger.responses[404] = {
      description: 'Produto não encontrado',
      schema: { message: "Produto não encontrado." }
    }
    #swagger.responses[403] = {
      description: 'Acesso negado',
      schema: { message: "Apenas analistas podem realizar operações com produtos." }
    }
  */
  try {
    await checkAnalistaRole(req, res, async () => {
      const { nome } = req.params;

      const existingProduct = await prisma.produto.findFirst({
        where: {
          nome: {
            contains: nome,
            mode: 'insensitive'
          }
        }
      });

      if (!existingProduct) {
        return res.not_found({ message: "Produto não encontrado." });
      }

      await prisma.produto.delete({
        where: { id: existingProduct.id }
      });

      return res.ok({ message: "Produto deletado com sucesso." });
    });
  } catch (error) {
    return next(error);
  }
}; 