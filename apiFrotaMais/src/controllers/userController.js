import prisma from "../config/database.js";
import { hashPassword } from "../utils/bcrypt.js";
import bcrypt from "bcrypt";

export const login = async (req, res, next) => {
    /*
      #swagger.tags = ["Auth"]
      #swagger.summary = "Login"
      #swagger.responses[200]
    */
    try {
        const { email, senha } = req.body;
    
        // Busca o usuário no banco
        const user = await prisma.usuario.findUnique({
        where: { email },
        });
    
        if (!user) {
            return res.unauthorized();
        }
        
        const isMatch = await bcrypt.compare(req.body.senha, user.senha);
        if (!isMatch) {
            res.unauthorized();
        }
        
        req.user = user;
        next();
    } catch (error) {
        return next(error);
    }
}


export const list = async (req, res, next) => {
    /*
      #swagger.tags = ["Users"]
      #swagger.summary = "List all users"
      #swagger.security = [{ "BearerAuth": [] }]
      #swagger.parameters['_limit'] = {
        in: 'query',
        description: 'Number of items per page',
        required: false,
        type: 'integer',
        default: 10
      }
      #swagger.parameters['_sort'] = {
        in: 'query',
        description: 'Field to sort by (id, nome, email, login, funcao)',
        required: false,
        type: 'string'
      }
      #swagger.parameters['_order'] = {
        in: 'query',
        description: 'Order direction (asc or desc)',
        required: false,
        type: 'string',
        enum: ['asc', 'desc']
      }
      #swagger.parameters['funcao'] = {
        in: 'query',
        description: 'Filter by user role (analista or supervisor)',
        required: false,
        type: 'string',
        enum: ['analista', 'supervisor']
      }
      #swagger.responses[200] = {
        description: "List of users with pagination",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                data: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer" },
                      nome: { type: "string" },
                      email: { type: "string" },
                      login: { type: "string" },
                      funcao: { type: "string" }
                    }
                  }
                },
                meta: {
                  type: "object",
                  properties: {
                    totalItems: { type: "integer" },
                    currentPage: { type: "integer" },
                    totalPages: { type: "integer" },
                    itemsPerPage: { type: "integer" },
                    hasNextPage: { type: "boolean" },
                    hasPrevPage: { type: "boolean" },
                    filteredBy: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    */
    try {
      const page = parseInt(req.query._page) || 1;
      const limit = parseInt(req.query._limit) || 10;
      const offset = (page - 1) * limit;
      
      // Filtro de função
      const funcaoFilter = req.query.funcao;
      const validFuncoes = ['analista', 'supervisor'];
      
      // Construir where clause
      const whereClause = {};
      if (funcaoFilter && validFuncoes.includes(funcaoFilter.toLowerCase())) {
        whereClause.funcao = funcaoFilter.toLowerCase();
      }

      // Contar total de itens com o filtro aplicado
      const totalItems = await prisma.usuario.count({
        where: whereClause
      });
      
      const totalPages = Math.ceil(totalItems / limit);

      const order = req.query._order?.toLowerCase() === "desc" ? "desc" : "asc";
      const sort = req.query._sort;
      const validSortFields = ["id", "nome", "email", "login", "funcao"];
      const orderBy = validSortFields.includes(sort) ? { [sort]: order } : undefined;

      const users = await prisma.usuario.findMany({
        where: whereClause,
        skip: offset,
        take: limit,
        ...(orderBy && { orderBy }),
        select: {
          id: true,
          nome: true,
          email: true,
          login: true,
          funcao: true,
        },
      });

      return res.ok({
        data: users,
        meta: {
          totalItems,
          currentPage: page,
          totalPages,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          ...(funcaoFilter && validFuncoes.includes(funcaoFilter.toLowerCase()) && {
            filteredBy: funcaoFilter.toLowerCase()
          })
        }
      });
    } catch (error) {
      return next(error);
    }
};
  

export const getById = async (req, res, next) => {
    /*
      #swagger.tags = ["Users"]
      #swagger.summary = "Create new user"
      #swagger.security = [{ "BearerAuth": [] }]
      #swagger.responses[200]
    */
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.usuario.findUnique({
        where: { id },
        select: {
            id: true,
            nome: true,
            email: true,
            login: true,
            funcao: true,
        },
    });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

    return res.ok(res.hateos_item(user));
  } catch (error) {
    return next(error);
  }
};


export const create = async (req, res, next) => {
    /*
      #swagger.tags = ["Users"]
      #swagger.summary = "Create new user"
      #swagger.security = [{ "BearerAuth": [] }]
      #swagger.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                nome: { type: "string" },
                email: { type: "string", format: "email" },
                login: { type: "string" },
                senha: { type: "string" },
                funcao: { type: "string", enum: ["supervisor", "analista"] }
              },
              required: ["nome", "email", "login", "senha"]
            }
          }
        }
      }
      #swagger.responses[201] = {
        description: "User created successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "integer" },
                nome: { type: "string" },
                email: { type: "string", format: "email" },
                login: { type: "string" },
                funcao: { type: "string" }
              }
            }
          }
        }
      }
    */
    try {
      req.body.senha = await hashPassword(req.body.senha);
      const user = await prisma.usuario.create({
        data: req.body,
      });
      console.log(user);
      return res.created(res.hateos_item(user));
    } catch (error) {
      return next(error);
    }
  };
  

export const update = async (req, res, next) => {
     /*
      #swagger.tags = ["Users"]
      #swagger.summary = "Create new user"
      #swagger.security = [{ "BearerAuth": [] }]
      #swagger.responses[204]
    */
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.usuario.update({
      where: { id },
      data: req.body,
    });

    return res.no_content(res.hateos_item(user));
  } catch (error) {
    return res.status(404).json({ error: "Usuário não encontrado ou inválido." });
  }
};


export const remove = async (req, res, next) => {
     /*
      #swagger.tags = ["Users"]
      #swagger.summary = "Create new user"
      #swagger.security = [{ "BearerAuth": [] }]
      #swagger.responses[204]
    */
  try {
    const id = parseInt(req.params.id);
    await prisma.usuario.delete({ where: { id } });
    return res.no_content();
  } catch (error) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }
};
